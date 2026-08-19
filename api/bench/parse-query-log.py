#!/usr/bin/env python3
"""Computes p50/p95/mean query latency and cache hit rate from AlberFlowy's
[ALBERFLOWY_BENCH] log lines (emitted by src/plugin.cpp when ALBERFLOWY_BENCH_LOG is set).
Usage: parse-query-log.py <logfile>
"""
import re
import sys
import statistics

LINE_RE = re.compile(r"cache=(\w+) outcome=(\w+) latency_ms=([\d.]+)")


def percentile(sorted_vals, p):
    idx = min(len(sorted_vals) - 1, max(0, int(p * len(sorted_vals) + 0.9999) - 1))
    return sorted_vals[idx]


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    latencies = []
    hits = 0
    outcomes = {}

    with open(sys.argv[1]) as f:
        for line in f:
            if "ALBERFLOWY_BENCH" not in line or "latency_ms=" not in line:
                continue
            m = LINE_RE.search(line)
            if not m:
                continue
            cache, outcome, ms = m.group(1), m.group(2), float(m.group(3))
            latencies.append(ms)
            hits += cache == "hit"
            outcomes[outcome] = outcomes.get(outcome, 0) + 1

    n = len(latencies)
    if n == 0:
        print("No [ALBERFLOWY_BENCH] samples found in log.")
        sys.exit(1)

    latencies.sort()
    print(f"samples:        {n}")
    print(f"p50:            {statistics.median(latencies):.3f} ms")
    print(f"p95:            {percentile(latencies, 0.95):.3f} ms")
    print(f"mean:           {statistics.mean(latencies):.3f} ms")
    print(f"min / max:      {latencies[0]:.3f} / {latencies[-1]:.3f} ms")
    print(f"cache hit rate: {hits / n * 100:.1f}% ({hits}/{n})")
    print(f"outcomes:       {outcomes}")


if __name__ == "__main__":
    main()
