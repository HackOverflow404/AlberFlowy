#!/usr/bin/env node
import { fileURLToPath } from 'url';

// Deterministic PRNG so fixtures are reproducible across runs (mulberry32).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Matches the flat shape WorkFlowy's get_tree_data returns: {id, prnt, nm, cp?, pr}.
export function generateFlatItems(size, { seed = 1, maxChildrenPerNode = 8, completedFraction = 0.1 } = {}) {
  const rand = mulberry32(seed);
  const items = [];
  const ids = [];
  const childCount = new Map();

  for (let i = 0; i < size; i++) {
    let parentId = null;
    if (ids.length > 0 && rand() < 0.85) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = ids[Math.floor(rand() * ids.length)];
        if ((childCount.get(candidate) ?? 0) < maxChildrenPerNode) {
          parentId = candidate;
          break;
        }
      }
    }

    const id = `bench-${seed}-${i.toString(36)}`;
    const item = { id, prnt: parentId, nm: `Bench node ${i}`, pr: childCount.get(parentId) ?? 0 };
    if (rand() < completedFraction) item.cp = true;

    items.push(item);
    ids.push(id);
    if (parentId) childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1);
  }

  return items;
}

// Mirrors the flat-items -> nested-tree restructuring loop in workflowy.js's getTree().
export function buildTree(items) {
  const itemMap = new Map();
  for (const item of items) {
    item.children = [];
    itemMap.set(item.id, item);
  }
  return items.filter((item) => {
    const parent = itemMap.get(item.prnt);
    if (parent) {
      parent.children.push(item);
      return false;
    }
    return true;
  });
}

function main() {
  const [sizeArg, outFormat] = process.argv.slice(2);
  const size = Number(sizeArg ?? 100);
  if (!Number.isFinite(size) || size <= 0) {
    console.error('Usage: node gen-tree.js <size> [flat|tree]');
    process.exit(1);
  }

  const flat = generateFlatItems(size);
  const output = outFormat === 'tree' ? buildTree(flat.map((i) => ({ ...i }))) : flat;
  console.log(JSON.stringify(output, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
