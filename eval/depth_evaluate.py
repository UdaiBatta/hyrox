"""Score WB-01 against video labels, including abstentions and reps missed by segmentation."""
import csv
import gzip
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from analysis.pipeline import analyze, load_config


def main():
    clips = defaultdict(list)
    with (ROOT / "eval/depth_labels.csv").open() as f:
        for row in csv.DictReader(f):
            clips[row["clip"]].append((float(row["t_bottom"]), row["depth"]))

    counts = Counter()
    extra = 0
    for clip, labels in clips.items():
        folder = ROOT / "backend/media/videos" / clip
        with gzip.open(folder / "frames.json.gz", "rt") as f:
            reps = analyze(json.load(f), load_config())["reps"]
        available = {r["n"]: r for r in reps}
        for bottom, expected in labels:
            candidates = [r for r in available.values() if abs(r["t_bottom"] - bottom) <= 0.5]
            call = "missed"
            if candidates:
                rep = min(candidates, key=lambda r: abs(r["t_bottom"] - bottom))
                del available[rep["n"]]
                rule = rep["rules"]["WB-01"]
                call = "unsure" if rule["low_confidence"] or rule["status"] == "not_assessable" else rule["status"]
            counts[expected, call] += 1
            print(f"{clip} {bottom:.2f}s: {expected} -> {call}")
        extra += len(available)

    print("\nlabel        pass  fail  unsure  missed")
    for depth in ("deep", "borderline", "shallow"):
        print(f"{depth:11} " + " ".join(f"{counts[depth, call]:5}" for call in ("pass", "fail", "unsure", "missed")))
    print(f"Extra detected reps: {extra}")


if __name__ == "__main__":
    main()
