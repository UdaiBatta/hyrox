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

**Still missing: a clip with clearly shallow (no-rep) squats filmed side-on.** None of the web footage shows
deliberate shallow reps clearly enough. Record C2 yourself (PRD §5) for that.

Labels for evaluation go in `../eval/labels/<clip>.csv` — label from 0.25× playback, not from the pipeline output.
