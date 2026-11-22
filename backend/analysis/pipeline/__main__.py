"""CLI: python -m analysis.pipeline <video> [--out DIR]   (run from backend/)"""
import argparse
from pathlib import Path

from . import run

ap = argparse.ArgumentParser(description="Wall-ball form check on one clip")
ap.add_argument("video", type=Path)
ap.add_argument("--out", type=Path, help="output folder (default media/videos/<clip name>)")
a = ap.parse_args()
out = a.out or Path("media/videos") / a.video.stem
res = run(a.video, out)

print(f"\nview: {res['view']}   fps: {res['fps']}   reps: {len(res['reps'])}   ignored dips: {len(res['ignored_dips'])}")
print(f"{'rep':>3} {'t(s)':>6}  {'verdict':<11} details")
for r in res["reps"]:
    detail = "; ".join(f"{rid} {x['status']}{'?' if x['low_confidence'] else ''} ({x['reason']})"
                       for rid, x in r["rules"].items() if rid != "WB-05")
    print(f"{r['n']:>3} {r['t_bottom']:>6.2f}  {r['verdict']:<11} {detail}")
s = res["summary"]
print(f"\nproper {s['proper']} / not proper {s['not_proper']} / uncertain {s['uncertain']}"
      f"   most common fault: {s['most_common_fault']}   tempo by thirds (s/rep): {s['tempo_thirds']}")
for t in s["takeaways"]:
    print(f"- {t}")
for w in res["warnings"]:
    print(f"! {w}")
print(f"\nwritten: {out / 'analysis.json'}")
