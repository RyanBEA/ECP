#!/usr/bin/env python3
"""Summarize an ECP print-telemetry CSV (from pull-events.sh).

Usage: summarize.py EVENTS.csv [--final-only]
  --final-only  keep only the last event per session (a session = one page load),
                which approximates "one finalized design per user visit".
"""
import csv, json, sys
from collections import Counter, defaultdict

def load(path):
    with open(path, newline='') as f:
        return list(csv.DictReader(f))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__); sys.exit(2)
    rows = load(args[0])
    if '--final-only' in sys.argv:
        last = {}
        for r in rows:
            last[r['session_id']] = r          # CSV is oldest-first
        rows = list(last.values())
    if not rows:
        print('no events'); return

    n = len(rows)
    sessions = len({r['session_id'] for r in rows})
    first, last = rows[0]['created_at'][:10], rows[-1]['created_at'][:10]
    print(f'events: {n}   sessions: {sessions}   range: {first} .. {last}')

    by_tier = defaultdict(lambda: {'n': 0, 'met': 0, 'pts': 0.0})
    for r in rows:
        t = by_tier[r['tier']]
        t['n'] += 1; t['met'] += r['met'] == 'true'; t['pts'] += float(r['total_points'])
    print('\ntier  events  met%   avg pts')
    for tier in sorted(by_tier):
        t = by_tier[tier]
        print(f"  {tier}   {t['n']:6d}  {100*t['met']/t['n']:4.0f}%  {t['pts']/t['n']:6.1f}")

    sel = defaultdict(Counter)
    for r in rows:
        for cat, idx in json.loads(r['selections_json'] or '{}').items():
            sel[cat][idx] += 1
    print('\nselections (category: option index → count; indices per docs/data-layer.md)')
    for cat in sorted(sel):
        picks = ', '.join(f'[{i}]×{c}' for i, c in sorted(sel[cat].items()))
        print(f'  {cat:22s} {picks}')

    wall = Counter()
    rsi = []
    for r in rows:
        w = json.loads(r['wall_json']) if r['wall_json'] else None
        if not w: wall['none'] += 1; continue
        wall[w.get('mode', '?')] += 1
        if w.get('mode') == 'builder':
            wall[f"builder:{w.get('wallType','?')}/{w.get('assemblyType','?')}"] += 1
            if w.get('rsi') is not None: rsi.append(float(w['rsi']))
    print('\nwalls: ' + ', '.join(f'{k}={v}' for k, v in wall.most_common()))
    if rsi:
        print(f'builder RSI: min {min(rsi):.2f}  avg {sum(rsi)/len(rsi):.2f}  max {max(rsi):.2f}')

if __name__ == '__main__':
    main()
