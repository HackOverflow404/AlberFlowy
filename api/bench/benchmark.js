#!/usr/bin/env node
import { WorkFlowyClient } from '../workflowy.js';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLES = 50;
const CACHE_TTL_MS = Number(process.env.WORKFLOWY_BENCH_CACHE_TTL_MS ?? 10000); // mirrors plugin.cpp's refreshTimer interval
const HIT_RATE_INTERVAL_MS = Number(
  process.env.WORKFLOWY_BENCH_HIT_INTERVAL_MS ?? Math.round(CACHE_TTL_MS / 5)
);
const BENCH_MARKER = '[bench]';
const READ_ONLY = process.argv.includes('--read-only');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(s) {
  return (s ?? '').replace(/<[^>]*>/g, '');
}

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

async function timeAsync(fn) {
  const start = performance.now();
  const result = await fn();
  return { result, elapsed: performance.now() - start };
}

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Mirrors the C++ Albert plugin's cachedTree: one full-tree snapshot, time-based TTL, no per-node invalidation.
class TtlTreeCache {
  constructor(client, ttlMs) {
    this.client = client;
    this.ttlMs = ttlMs;
    this.tree = null;
    this.fetchedAt = 0;
  }

  async get() {
    const now = Date.now();
    if (this.tree !== null && now - this.fetchedAt < this.ttlMs) {
      return { tree: this.tree, hit: true };
    }
    this.tree = await this.client.getTree();
    this.fetchedAt = Date.now();
    return { tree: this.tree, hit: false };
  }

  invalidate() {
    this.tree = null;
    this.fetchedAt = 0;
  }
}

// createNodeCustom's id is generated client-side and only echoed back inside the
// push_and_poll transaction payload, so it has to be dug out the same way plugin.cpp does.
function extractCreatedId(pushAndPollResult) {
  const txnJson = pushAndPollResult?.results?.[0]?.server_run_operation_transaction_json;
  if (!txnJson) throw new Error('no server_run_operation_transaction_json in response');
  const txn = JSON.parse(txnJson);
  const treesStr = txn.ops[0].data.project_trees;
  return JSON.parse(treesStr)[0].id;
}

function abort(message) {
  console.error(`\n[ABORT] ${message}`);
  process.exit(1);
}

function addOpResult(name, samples, results, tableRows, note = '') {
  const s = stats(samples);
  results.operations[name] = s;
  tableRows.push([
    name,
    String(s.samples),
    s.p50.toFixed(1),
    s.p95.toFixed(1),
    s.mean.toFixed(1),
    note,
  ]);
}

function printTable(rows) {
  const headers = ['Operation', 'Samples', 'p50 (ms)', 'p95 (ms)', 'Mean (ms)', 'Notes'];
  const all = [headers, ...rows];
  const widths = headers.map((_, i) => Math.max(...all.map((r) => String(r[i] ?? '').length)));
  const line = (cols) => cols.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

// Requires a WorkFlowy node whose name contains the [bench] marker, so a
// misconfigured/missing env var can never point CRUD writes at real data.
async function verifyScratchParent(client) {
  const parentId = process.env.WORKFLOWY_BENCH_PARENT_ID;
  if (!parentId) return null;

  const tree = await client.getTree();
  const node = findNodeById(tree, parentId);
  if (!node) {
    abort(
      `WORKFLOWY_BENCH_PARENT_ID=${parentId} was not found in your WorkFlowy tree. ` +
        `Refusing to run CRUD benchmarks against an unverifiable node.`
    );
  }

  const name = stripHtml(node.nm);
  if (!name.toLowerCase().includes(BENCH_MARKER)) {
    abort(
      `Node "${name}" (${parentId}) does not contain the required "${BENCH_MARKER}" marker in its name. ` +
        `Refusing to run CRUD benchmarks against a node that isn't clearly dedicated scratch space. ` +
        `Create a node named e.g. "${BENCH_MARKER} scratch" in WorkFlowy, copy its id, and set ` +
        `WORKFLOWY_BENCH_PARENT_ID=<id>.`
    );
  }

  return { id: parentId, name };
}

async function runCrudBenchmarks(client, parentId, results, tableRows) {
  const ids = [];

  console.log(`Running: createNodeCustom x${SAMPLES}`);
  const createSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const { result, elapsed } = await timeAsync(() =>
      client.createNodeCustom(`${BENCH_MARKER} node ${i}`, parentId)
    );
    createSamples.push(elapsed);
    try {
      ids.push(extractCreatedId(result));
    } catch (err) {
      console.warn(`  warning: could not extract id for sample ${i}: ${err.message}`);
    }
    process.stdout.write(`\r  ${i + 1}/${SAMPLES}`);
  }
  console.log();
  addOpResult('createNodeCustom', createSamples, results, tableRows, `${ids.length}/${SAMPLES} ids tracked`);

  if (ids.length === 0) {
    abort(
      'createNodeCustom did not yield any usable node ids; cannot safely continue with ' +
        'edit/complete/delete phases (there would be nothing to clean up). Aborting CRUD benchmarks.'
    );
  }

  console.log(`Running: editNode x${ids.length}`);
  const editSamples = [];
  for (let i = 0; i < ids.length; i++) {
    const { elapsed } = await timeAsync(() => client.editNode(`${BENCH_MARKER} edited ${i}`, ids[i]));
    editSamples.push(elapsed);
    process.stdout.write(`\r  ${i + 1}/${ids.length}`);
  }
  console.log();
  addOpResult('editNode', editSamples, results, tableRows);

  console.log(`Running: completeNode x${ids.length}`);
  const completeSamples = [];
  for (let i = 0; i < ids.length; i++) {
    const { elapsed } = await timeAsync(() => client.completeNode(ids[i]));
    completeSamples.push(elapsed);
    process.stdout.write(`\r  ${i + 1}/${ids.length}`);
  }
  console.log();
  addOpResult('completeNode', completeSamples, results, tableRows);

  console.log(`Running: uncompleteNode x${ids.length}`);
  const uncompleteSamples = [];
  for (let i = 0; i < ids.length; i++) {
    const { elapsed } = await timeAsync(() => client.uncompleteNode(ids[i]));
    uncompleteSamples.push(elapsed);
    process.stdout.write(`\r  ${i + 1}/${ids.length}`);
  }
  console.log();
  addOpResult('uncompleteNode', uncompleteSamples, results, tableRows);

  console.log(`Running: deleteNode x${ids.length} (also cleans up scratch nodes)`);
  const deleteSamples = [];
  const failedDeletes = [];
  for (let i = 0; i < ids.length; i++) {
    try {
      const { elapsed } = await timeAsync(() => client.deleteNode(ids[i]));
      deleteSamples.push(elapsed);
    } catch (err) {
      failedDeletes.push(ids[i]);
    }
    process.stdout.write(`\r  ${i + 1}/${ids.length}`);
  }
  console.log();
  addOpResult('deleteNode', deleteSamples, results, tableRows);

  if (failedDeletes.length > 0) {
    console.error(
      `\n[WARNING] Failed to delete ${failedDeletes.length} scratch node(s); ` +
        `manual cleanup needed under parent ${parentId}: ${failedDeletes.join(', ')}`
    );
  }
}

async function main() {
  console.log('='.repeat(72));
  console.log('AlberFlowy WorkFlowy Benchmark');
  console.log('Sync/cache benchmarks are read-only against your real tree.');
  console.log('CRUD benchmarks run ONLY under a dedicated scratch node whose name must');
  console.log(`contain "${BENCH_MARKER}" — verified before any writes happen.`);
  console.log('='.repeat(72));

  const client = new WorkFlowyClient();
  const results = {
    generatedAt: new Date().toISOString(),
    config: { samples: SAMPLES, cacheTtlMs: CACHE_TTL_MS, hitRateIntervalMs: HIT_RATE_INTERVAL_MS },
    operations: {},
  };
  const tableRows = [];

  console.log(`\nRunning: full-tree sync, cold (no cache) x${SAMPLES}`);
  const coldSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const { elapsed } = await timeAsync(() => client.getTree());
    coldSamples.push(elapsed);
    process.stdout.write(`\r  ${i + 1}/${SAMPLES}`);
  }
  console.log();
  addOpResult('full_tree_sync_cold', coldSamples, results, tableRows, 'real network, no cache');

  console.log(`Running: full-tree sync, warm cache x${SAMPLES}`);
  const cache = new TtlTreeCache(client, CACHE_TTL_MS);
  await cache.get(); // prime
  const warmSamples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const { elapsed } = await timeAsync(() => cache.get());
    warmSamples.push(elapsed);
  }
  addOpResult('full_tree_sync_warm', warmSamples, results, tableRows, `TTL=${CACHE_TTL_MS}ms, in-memory`);

  console.log(`Running: cache hit-rate simulation x${SAMPLES} (interval ${HIT_RATE_INTERVAL_MS}ms)`);
  cache.invalidate();
  let hits = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const { result } = await timeAsync(() => cache.get());
    if (result.hit) hits++;
    process.stdout.write(`\r  ${i + 1}/${SAMPLES}`);
    if (i < SAMPLES - 1) await sleep(HIT_RATE_INTERVAL_MS);
  }
  console.log();
  const hitRate = hits / SAMPLES;
  results.cache_hit_rate = { hits, total: SAMPLES, rate: hitRate };
  tableRows.push(['cache_hit_rate', String(SAMPLES), '-', '-', '-', `${(hitRate * 100).toFixed(1)}% (${hits}/${SAMPLES})`]);

  let parentInfo = null;
  if (!READ_ONLY) {
    parentInfo = await verifyScratchParent(client);
  }

  if (!parentInfo) {
    console.log(
      '\nSkipping CRUD benchmarks (read-only mode). Set WORKFLOWY_BENCH_PARENT_ID to a ' +
        `dedicated node whose name contains "${BENCH_MARKER}" to enable them.`
    );
  } else {
    console.log(`\nCRUD benchmarks confined to node "${parentInfo.name}" (${parentInfo.id})`);
    await runCrudBenchmarks(client, parentInfo.id, results, tableRows);
  }

  console.log();
  printTable(tableRows);

  const outPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRaw results written to ${outPath}`);
}

main().catch((err) => {
  console.error('\n[ERROR]', err?.message ?? err);
  process.exit(1);
});
