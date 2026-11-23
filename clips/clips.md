# Test clips

Sourced from the web (the brief allows "pull your own from YouTube") until our own recordings exist.
YouTube clips are for evaluation only: keep them as links + timestamps in the submission, don't redistribute
the files. The Mixkit clip is under the Mixkit Stock Video Free License (free for commercial and personal use).

Raw downloads are in `raw/`. Final clips were cut with ffmpeg; multi-part clips are joined segments
from the **same camera position** (camera changes/fades removed, because a camera cut would break the
keypoint signal).

| Clip | View | Source | Segments used (original video time) | What's in it |
|---|---|---|---|---|
| `C1_side_studio.mp4` | Side | CrossFit, "The Wall Ball" — https://www.youtube.com/watch?v=fpUD0mcFp_0 | 0:06.0–0:13.5, 0:18.5–0:25.75, 0:30.5–0:33.75 | Demo reps, white studio, target in frame. Expected: good depth |
| `C1b_side_gym.mp4` | Side | Jacob Price, "Hyrox Wall Balls Full Guide 2026" — https://www.youtube.com/watch?v=-NDerrug4tk | 2:30.1–2:39.7 (one continuous segment) | Real gym, full body, deep reps. An earlier 3-segment version created a fake half-squat at a join, so it is kept continuous |
| `C2a_side_pickup_coach.mp4` | Side (slightly oblique) | The Fit Protocol, "HYROX360°#8 – Wall balls: STOP No-Reps" — https://www.youtube.com/watch?v=iQ0uMUzMmpU | 9:34–9:49 | Coach picks the ball up off the floor, then reps (tests WB-03 reset after pick-up) |
| `C2b_side_pickup_coach.mp4` | Side (slightly oblique) | same | 10:00–10:17 | Pick-up, then reps; depth varies (coach demonstrating standards) |
| `C4a_back_studio.mp4` | Behind | CrossFit, "The Wall Ball" (as C1) | 0:00.3–0:05.0, 0:14.5–0:17.25, 0:26.75–0:29.5 | Same athlete as C1, filmed from behind. Expected: depth "not assessable from this view" |
| `C4b_back_gym.mp4` | Behind / rear-oblique | Jacob Price (as C1b) | 5:08.2–5:30 | Continuous reps from behind, real gym |
| `C4c_back_mixkit.mp4` | Behind | Mixkit #52104 — https://mixkit.co/free-stock-video/a-young-woman-wearing-black-leggins-exercises-by-launching-a-52104/ | whole clip (0:00–0:15.6) | Free-licence clip, from behind |

Not used:
- Jacob Price 2:49–3:03 is a split screen of the same athlete (left: ball at chest, right: ball drops to the
  knees). Both are deep squats; "ball drops low" is a technique fault, not a rulebook no-rep. Crop one half with
  `ffmpeg -vf crop=742:821:191:130` (left) or `crop=742:821:988:130` (right) if needed.
- Race footage in the Jacob Price video: many athletes in frame (we assume one).

## Filmed squat-depth benchmark

These four continuous excerpts test WB-01 alone. Times below are seconds from the beginning of each source. The
first and last include an instructor beside the athlete, so the crop isolates the moving athlete. The full 36.5 s
`raw/crossfit_full.mp4` supplies the C1 calibration and C4a rear-view clips above. Counting it again as an
independent test would reuse the same movements.

| Clip stem | Source | Start | Duration | Crop at 1280×720 | Depth label |
|---|---|---:|---:|---|---|
| C2c_side_shallow | [CrossFit Games, Open 12.4](https://www.youtube.com/watch?v=lMJYvetSHvk&t=91s) | 91.5 | 8.5 | `480:720:330:0` | Four throws in the source's explicitly labelled insufficient-depth sequence. The caption covers the ankles. |
| C2d_side_borderline | [Hyrox Wall Ball Common Mistakes](https://www.youtube.com/watch?v=Y_7zAEzF96Y&t=65s) | 65.6 | 5.6 | Full frame | Two throws close to parallel. Visual review could not confidently resolve the crease against the knee. These are reviewer labels, without a second opinion. |
| C2e_side_deep | [CrossFit Games, Open 12.4](https://www.youtube.com/watch?v=lMJYvetSHvk&t=100s) | 100.7 | 9.2 | Full frame | Four throws with clearly deep squats. The source demonstrates a separate ball-handling fault. Only depth is scored here. |
| C2f_side_shallow | [CrossFit Games, Open 13.3](https://www.youtube.com/watch?v=cG9SWY4iqY0&t=92s) | 92.4 | 2.0 | `434:720:332:0` | The instructor identifies this throw as an insufficient-depth no-rep. The athlete and feet are visible. |

From a local copy of each source, trim with `ffmpeg -ss START -t DURATION -i SOURCE.mp4 -vf crop=CROP -an -c:v libx264 -crf 18 clips/STEM.mp4`.
Omit `-vf crop=CROP` for full-frame excerpts. Run `python -m analysis.pipeline ../clips/STEM.mp4` from `backend/`
to regenerate the cached tracks. The source videos stay local.

The per-rep times in [depth_labels.csv](../eval/depth_labels.csv) were recorded from the video before running the
judge. To extend the test, label every completed throw in each new clip, including borderline cases, before viewing
predictions. Have a second reviewer label the same original footage independently. Preserve disagreements for review.
