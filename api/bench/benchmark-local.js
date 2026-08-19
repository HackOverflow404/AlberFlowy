#!/usr/bin/env node
import { generateFlatItems, buildTree } from './gen-tree.js';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_SIZES = [100, 1000, 10000];
const SAMPLES = 50;

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(p * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    samples: samples.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    mean,
  };
}

function timeSync(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// Mirrors plugin.cpp's findNodeById used by both cache lookups and CRUD mutations.
function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNodeById(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (nodes[i].children?.length && removeNodeById(nodes[i].children, id)) return true;
  }
  return false;
}

function addOpResult(name, size, samples, results, tableRows, throughputLabel, throughputFn) {
  const s = stats(samples);
  results.push({ operation: name, size, ...s, throughput: throughputFn(s) });
  tableRows.push([
    name,
    String(size),
    String(s.samples),
    s.p50.toFixed(3),
    s.p95.toFixed(3),
    s.mean.toFixed(3),
    `${throughputFn(s).toFixed(0)} ${throughputLabel}`,
  ]);
}

function printTable(rows) {
  const headers = ['Operation', 'Tree Size', 'Samples', 'p50 (ms)', 'p95 (ms)', 'Mean (ms)', 'Throughput'];
  const all = [headers, ...rows];
  const widths = headers.map((_, i) => Math.max(...all.map((r) => String(r[i] ?? '').length)));
  const line = (cols) => cols.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

function benchmarkSize(size, results, tableRows) {
  console.log(`\n-- tree size ${size} --`);

  const flat = generateFlatItems(size);
  const ids = flat.map((i) => i.id);

  // sync/parse: flat items -> nested tree, the same restructuring workflowy.js's getTree() does.
  const parseSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    parseSamples.push(timeSync(() => buildTree(flat)));
  }
  addOpResult('sync_parse', size, parseSamples, results, tableRows, 'nodes/sec', (s) => size / (s.mean / 1000));

  const baseTree = buildTree(flat.map((i) => ({ ...i })));

  // cache lookup: findNodeById on the already-built tree (the plugin's per-query hit path).
  const lookupSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    lookupSamples.push(timeSync(() => findNodeById(baseTree, targetId)));
  }
  addOpResult('cache_lookup', size, lookupSamples, results, tableRows, 'lookups/sec', (s) => 1000 / s.mean);

  // create: clone base tree per sample (untimed) so every sample starts from the same size-N tree.
  const createSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const clone = structuredClone(baseTree);
    const parentId = ids[Math.floor(Math.random() * ids.length)];
    createSamples.push(
      timeSync(() => {
        const parent = findNodeById(clone, parentId);
        const target = parent ? parent.children : clone;
        target.push({ id: `new-${i}`, nm: `New node ${i}`, children: [], pr: 0 });
      })
    );
  }
  addOpResult('create', size, createSamples, results, tableRows, 'ops/sec', (s) => 1000 / s.mean);

  // edit: findNodeById + rename.
  const editSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const clone = structuredClone(baseTree);
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    editSamples.push(
      timeSync(() => {
        const node = findNodeById(clone, targetId);
        if (node) node.nm = 'edited';
      })
    );
  }
  addOpResult('edit', size, editSamples, results, tableRows, 'ops/sec', (s) => 1000 / s.mean);

  // complete/uncomplete: findNodeById + toggle cp.
  const completeSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const clone = structuredClone(baseTree);
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    completeSamples.push(
      timeSync(() => {
        const node = findNodeById(clone, targetId);
        if (node) {
          if (node.cp) delete node.cp;
          else node.cp = true;
        }
      })
    );
  }
  addOpResult('complete', size, completeSamples, results, tableRows, 'ops/sec', (s) => 1000 / s.mean);

  // delete: findNodeById-style recursive removal.
  const deleteSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const clone = structuredClone(baseTree);
    const targetId = ids[Math.floor(Math.random() * ids.length)];
    deleteSamples.push(timeSync(() => removeNodeById(clone, targetId)));
  }
  addOpResult('delete', size, deleteSamples, results, tableRows, 'ops/sec', (s) => 1000 / s.mean);
}

function main() {
  const sizeArgs = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const sizes = sizeArgs.length > 0 ? sizeArgs : DEFAULT_SIZES;

  console.log('='.repeat(72));
  console.log('AlberFlowy Local-Fixture Benchmark (no network)');
  console.log(`Tree sizes: ${sizes.join(', ')} | ${SAMPLES} samples per operation per size`);
  console.log('='.repeat(72));

  const results = [];
  const tableRows = [];

  for (const size of sizes) {
    benchmarkSize(size, results, tableRows);
  }

  console.log();
  printTable(tableRows);

  const outPath = path.join(__dirname, 'results-local.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), samplesPerOp: SAMPLES, sizes, results }, null, 2)
  );
  console.log(`\nRaw results written to ${outPath}`);
}

main();
