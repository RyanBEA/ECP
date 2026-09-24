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
    if 'belowGradeWalls' in sel:
        # Only rows before v1.3.0 carry this key; their index is into the OLD three-option list.
        print('  (belowGradeWalls above = rows before v1.3.0, old list: [0]=3.09, [1]=3.46, [2]=3.90;'
              ' later rows are in below_grade below)')

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

    # below_grade_json: added in v1.3.0; absent from older exports, empty for older rows.
    bg = Counter()
    bg_level = Counter()
    bg_rsi = []
    for r in rows:
        raw = r.get('below_grade_json') or ''
        b = json.loads(raw) if raw else None
        if not b: bg['none'] += 1; continue
        mode = b.get('mode', '?')
        bg[mode] += 1
        if mode == 'simple':
            bg_level[f"{b.get('rsi')}/{b.get('points')}pts"] += 1
        elif mode == 'builder':
            bg[f"builder:{b.get('foundationType','?')}"] += 1
            if b.get('rsi') is not None: bg_rsi.append(float(b['rsi']))
            else: bg['builder:incomplete'] += 1
    print('\nbelow grade: ' + ', '.join(f'{k}={v}' for k, v in bg.most_common()))
    if bg_level:
        print('below grade simple levels (rsi/points): ' + ', '.join(f'{k}={v}' for k, v in sorted(bg_level.items())))
    if bg_rsi:
        print(f'below grade builder RSI: min {min(bg_rsi):.2f}  avg {sum(bg_rsi)/len(bg_rsi):.2f}  max {max(bg_rsi):.2f}')

if __name__ == '__main__':
    main()
