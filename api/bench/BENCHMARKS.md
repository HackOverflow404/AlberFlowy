# AlberFlowy Benchmarks

Three tools, three code paths:

| Tool | Targets | Network |
|---|---|---|
| `bench/benchmark.js` | Node CLI sync/CRUD (`api/workflowy.js`), TTL cache wrapper | real WorkFlowy account |
| `bench/benchmark-local.js` + `bench/gen-tree.js` | tree parse / cache lookup / CRUD *algorithms* only | none — synthetic fixtures |
| `ALBERFLOWY_BENCH_LOG` in `src/plugin.cpp` | live Albert plugin query path (`Plugin::items()`) | none in the hot path (warm cache) |

## Methodology

- Percentiles are nearest-rank p50/p95 over N=50 samples per operation (`benchmark.js`, `benchmark-local.js`) or ~100+ samples pulled from real query logs (`parse-query-log.py`).
- "Cache" throughout means the C++ plugin's model: one full-tree snapshot (`cachedTree`), refreshed on a 10s timer, no per-node invalidation. `benchmark.js`'s `TtlTreeCache` and the local fixture benchmark's `cache_lookup` op both mirror this, not a request-driven LRU.
- Cache hit/miss in the plugin log is: hit = `cachedTree` already populated when the query started; miss = still waiting on the first fetch. It is not measuring staleness.
- CRUD benchmarks against the real account run only under a dedicated node whose name contains the literal marker `[bench]`, verified before any writes; the script aborts loudly rather than guessing if that can't be confirmed.

## Machine

- CPU: AMD Ryzen 9 7940HS (8c/16t)
- RAM: 14 GiB
- OS: Ubuntu 26.04 LTS, kernel 7.0.0-29-generic (x86_64)
- Node: v25.2.1
- Albert: 35.1.0, Qt 6.10.2

## Datasets

- **Real account**: the user's live WorkFlowy tree (read-only sync benchmarks) plus a persistent `[bench] scratch` node for CRUD, cleaned up (deleted) at the end of every CRUD run.
- **Synthetic fixtures**: `gen-tree.js`, seeded/deterministic, sizes **100 / 1,000 / 10,000** nodes, max 8 children per node, ~10% marked complete. Flat `{id, prnt, nm, cp?, pr}` shape matches WorkFlowy's raw `get_tree_data` response.

## Reproduction

```bash
cd api

# 1. Real-account sync/cache (+ CRUD if WORKFLOWY_BENCH_PARENT_ID is set and verified)
npm run bench                 # full suite — CRUD costs 50 WorkFlowy item-creation quota
npm run bench --read-only     # sync/cache only, no writes, no quota cost

# 2. Local fixtures, no network
npm run bench:local           # sizes 100, 1000, 10000
node bench/benchmark-local.js 500 5000   # custom sizes

# 3. Plugin query latency (requires the instrumented plugin installed — see below)
sudo cmake --install ../build
ALBERFLOWY_BENCH_LOG=1 albert > /tmp/albert-bench.log 2>&1 &
# drive ~100 queries: Alt+Space (hotkey) -> type "wf <anything>" (trigger) -> Esc -> repeat
python3 bench/parse-query-log.py /tmp/albert-bench.log
```

WorkFlowy free-tier accounts cap item creation at 100/month — `npm run bench`'s CRUD phase spends 50 of that per run.

## Headline results

| Metric | Result |
|---|---|
| Warm- vs. cold-cache sync speedup | cold mean 265.6 ms → warm mean 0.002 ms (**~124,000x**); warm is a plain in-memory return, not a smaller network call |
| CRUD p95 latency (real account) | **828–879 ms** across create/edit/complete/uncomplete/delete (worst: `deleteNode` at 879.2 ms) — dominated by the two sequential legs every mutating op pays (`getUserData` + `push_and_poll`) |
| Query latency, live plugin, warm cache | p50 **0.71 ms**, p95 **1.71 ms** (112 real samples) — pure in-memory tree traversal, no network |
| Max tree size benchmarked | **10,000 nodes** (synthetic) — `sync_parse` throughput peaks ~5.1M nodes/sec at 1,000 nodes then drops to ~3.1M at 10,000; `cache_lookup` degrades from ~44.5K to ~3.1K lookups/sec over the same range (linear tree-search cost) |

Full raw data: `bench/results.json` (real account), `bench/results-local.json` (synthetic) — both gitignored, contain real/generated content respectively.
