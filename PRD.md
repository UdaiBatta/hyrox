# PRD — HYROX Wall Ball Form-Check Prototype

| | |
|---|---|
| Owner | Udai |
| Status | Draft v1.2, 2026-11-21 (v1.1 depth/framing fixes; v1.2 scope cuts after simplicity review) |
| Deadline | **Monday 2026-11-23** (submission + walkthrough) |
| Scope | Part 1: Wall Balls only. Part 2 (IMU + EMG note) later |
| Stack | Python 3.11 only where it must be: Django + DRF API and the MediaPipe pipeline. **TypeScript (strict) for everything else**: React + Vite + shadcn/ui + three.js frontend, API types, eval script. No `.js` source files |

---

## 1. Problem and goal

HYROX judges call wall-ball no-reps by eye. Every no-rep has to be redone, and leaving before 100 valid reps is a disqualification (Rulebook 26/27, §8.8 p.36 and code 09 on p.45; there are no warnings at wall balls). Athletes training alone get no feedback on which reps would have been no-reps, or on when their form breaks down.

**Goal:** upload a recorded wall-ball set and get:
1. an accurate rep count,
2. a verdict on every rep (**proper / not proper / uncertain**) naming the exact rule that failed,
3. a playback view with a skeleton overlay, a live counter and live verdicts, plus a 3D skeleton view,
4. an end-of-set summary with fault frequency, how tempo changes, and 1–2 plain-language coaching takeaways.

**Hard constraints (from the assignment):**
- Rules only: thresholds on angles, positions and timings. **No trained or fine-tuned classifier.** Using pretrained trackers such as MediaPipe as-is is fine.
- Every rule and threshold lives in **one file** (`backend/analysis/rules.yaml`).
- Recorded video only; real time is not required.
- When tracking or the camera angle can't support a verdict, the output says **"not assessable from this view"** and never guesses. Those gaps feed Part 2.

### Non-goals (deliberately out)
- Automatically detecting which station is shown, multi-station timing and distance tracking (what AutoTrack does, see §3.1).
- Real-time phone inference, user accounts, multi-tenant deployment.
- Training or fine-tuning any model.
- Multiple people in frame. One athlete is assumed (brief, step 2: "one athlete in frame"). Next step: track 2–3 people and lock onto the athlete by following the same body frame to frame.
- OpenPose. Its licence is non-commercial research only, it needs a CUDA 11 era source build on Windows, and it has no 3D from one camera. MediaPipe (Apache 2.0) already gives feet, hands, face and multi-person if needed.
- SMPL body mesh (next steps only, see §9.3).
- An in-app threshold tuning UI. Tuning means editing `rules.yaml` and re-running; keypoints are cached.

---

## 2. Users and user stories

| User | Story | Acceptance |
|---|---|---|
| Athlete | I upload my set and see which reps a judge would no-rep, and why | Every failed rep lists the rule ID, name and measured value against the threshold |
| Coach | I see where in the set form degrades | Summary shows depth and tempo trends across reps, plus the most common fault |
| Evaluator (hiring team) | I can check that the rules come from the rulebook and the thresholds are justified | `rules.yaml` and the README cite rulebook pages; each threshold has a rationale |
| Evaluator | I can see where the system is unsure | Uncertain and not-assessable reps are shown visibly, never hidden |
| Developer | I can tune a threshold and re-run without re-tracking | Edit `rules.yaml`, re-run the CLI; cached keypoints are reused, so only stages 3–8 run |

---

## 3. Reference analysis

### 3.1 AutoTrack short (youtube.com/shorts/MFemCg25q6g): what it does
A phone or tablet films the athlete at each of the 8 stations. On screen:
- a pose skeleton overlay, plus **labelled equipment boxes** (SLED, ROWER, KETTLEBELL, SANDBAG, ball). This implies an object detector running alongside pose estimation;
- one big metric per station: metres for the distance stations, a rep count for wall balls (96 → 100);
- a side panel: station n/8, total station time, interval ("2.0 s/rep"), split times per station, "N reps to go".

**Inferred pipeline:** equipment detection → classify the station → pose → a station-specific counter → timer and splits → overlay.
**What it does not do:** judge form. That is exactly what we add.
**What we borrow:** the overlay style, a large rep counter, an s/rep interval readout and a progress bar.

### 3.2 Reddit "3D human mesh reconstruction + frame sync" (r/computervision 1xzss3r)
⚠️ Not verified: Reddit was blocked, so the post wasn't read. Projects like this typically run an HMR model (4DHumans, GVHMR) to get per-frame SMPL pose, then animate a skinned template mesh in three.js, synced to `video.requestVideoFrameCallback`. SMPL's licence is non-commercial.
**Our decision:** a 3D **skeleton** from MediaPipe world landmarks with the same sync mechanism (§9.3). The mesh is a next step.

---

## 4. Movement standard (source of truth)

From *HYROX Singles Rulebook, Season 2025/26, R1, §9.8 Wall Balls*, pp.26–27 (re-checked 2026-11-23 against the current *26/27* rulebook, §8.8 pp.34–35: same wording):

- Start: "standing tall (hips and knees extended), holding the wall ball with both hands". Picking the ball up from the ground and throwing it straight away is not allowed.
- "squats below parallel and throws the ball (with both hands) as they stand up, striking the correct target … counted as one repetition."
- Depth: "the racer's hips must descend lower than their knees (also known as; below parallel or below 90°)."
- After the ball hits the target, the racer either catches it and starts the next rep, or lets it hit the ground and **stands tall again before squatting**. Catching it after a bounce and carrying on is not allowed.
- Any breach → "no rep". "No warnings are given, it is either a rep or a no-rep." A no-rep must be redone; leaving with fewer than 100 valid reps is a DQ (26/27 code 09).
- Target height: women and women pro **2.70 m**, men and men pro **3.00 m**. Ball weight: women 4 kg; women pro and men 6 kg; men pro 9 kg. 100 reps.
- Digital targets register strikes automatically. **The judge assesses the starting position and squat depth** (p.27, Note 1). These are the two things our pose rules mirror most directly.
- §13.5 (p.34): any deviation from the movement standard → no rep.

Secondary sources used for the common faults judges call (shallow depth under fatigue, ball under the target, not resetting after a drop): Centr "Wall ball rulebook: what judges watch", Sundried judges' guide, Roxlyfe wall-ball guide. Links in §15.

---

## 5. Recording guide (you're recording the clips yourself)

Squat depth is a **vertical comparison of hip and knee** (§6.0). The geometry holds from any horizontal angle, but **the hip keypoint is only well-defined side-on**. Face-on, the thigh points at the lens and the model has to guess where the hip is. Side-on is therefore the primary view. This shapes everything.

| Setting | Value | Why |
|---|---|---|
| Camera position | **Side-on**, 90° to the athlete (lens perpendicular to the wall), **3.5–4 m** away | Hip and knee are clearly visible in the sagittal plane |
| Lens height | **~1 m (hip height)**, not eye level | A lens looking down exaggerates how low the nearer joint appears and biases hip-vs-knee |
| Orientation | **Portrait** | 1× phone lens at 3.5 m: landscape sees only **~2.7 m** of height (no room for a 3.0 m target plus feet); portrait sees **~4.8 m** and still ~2.7 m wide, enough for athlete and wall |
| Lens | **1× main camera**, never 0.5× ultra-wide | Ultra-wide barrel distortion bends verticals near the edges |
| Level | Phone **level**, using the camera's built-in level/grid | A tilted (rolled) camera rotates "vertical" and biases depth. Residual roll is corrected with `camera_roll_deg` (§6.0) |
| Framing | Whole body including feet at all times **and the target**; athlete roughly **centred** | Ankles needed for leg length; target for the stretch ball rule; centre has the least distortion |
| Resolution / fps | 1080p, **60 fps** if possible (30 minimum) | Bottom-of-squat timing; fewer motion-blurred wrists |
| Mount | Tripod or something static; no panning or zoom | Pixel thresholds assume a fixed camera |
| Lighting / clothing | Even light; shorts or fitted clothing, contrasting with the background | MediaPipe hip and knee accuracy suffers with baggy clothes |
| Scene | One person in frame | MediaPipe tracks a single person |

The phone will record with a rotation flag and usually a variable frame rate. That's expected; ingest handles it (§7, stage 1).

**Clips to record (8–15 reps each, trimmed later):**

| # | Clip | Purpose |
|---|---|---|
| C1 | Side-on, all good reps | Baseline; checks for false positives |
| C2 | Side-on, **deliberately mixed**: ~4 shallow squats, 1 ball dropped then picked up and thrown straight away, 1 throw well under the target, 1 one-handed throw | Every rule fires at least once |
| C3 | Side-on, a longer set (20–30 reps) at race pace | Fatigue, tempo-trend and summary demo |
| C4 | **Front-on**, a mix of good and shallow reps | Shows depth "not assessable from this view" honestly |
| C5 (opt.) | 45° oblique | Shows where the view boundary sits |

While recording, **say the intended fault out loud** or note it down. Then **label each rep from 0.25× slow-motion playback**, not from memory. If possible, have a second person label C2 on their own as well, so you can report how often two humans agree (§11). Self-labelled data from the person who built the system is biased, and evaluators will ask.

---

## 6. Rules specification (`rules.yaml`)

### 6.0 How depth is measured

A single camera **cannot measure true distance from the lens**. MediaPipe outputs three kinds of coordinate, and we use them for different jobs:

| Output | What it is | Reliability | Used for |
|---|---|---|---|
| `x, y` (image) | Pixel position in the frame | Solid when the joint is visible | **All verdicts** |
| `z` (image) | Learned guess of depth relative to the hip midpoint | Noisy | Nothing (ignored) |
| World landmarks | Model's estimate of the 3D pose in metres, hip-centred | Plausible, not measured | 3D viewer only |

**Squat depth = a vertical comparison in the image.** Height is height whichever way the athlete faces, so the geometry doesn't care about the angle. What degrades off-side is **where the model places the hip**. So:

- **Side view:** depth from 2D image points.
- **Front / back view:** hip-vs-knee can't be measured (the thigh points along the camera axis). WB-01 falls back to a **hip-drop estimate**: hip height above the ankles at the bottom ÷ standing hip height, pass if ≤ 0.27 (0.30 − 0.03 borderline). Perspective makes squats look deeper from behind (same CrossFit athlete: 0.33–0.38 side-on, 0.23–0.25 from behind), so it can only **confirm** a clearly deep rep; anything else is `not_assessable`, never a no-rep. MediaPipe's 3D world estimate was tested and rejected (reads legal reps 0.33 L too deep from behind). Exact depth from any angle is carried into Part 2 (an IMU on the thigh measures its angle directly).
- **Ball tracking (display only, `pipeline/ball.py`, cached in `ball.json.gz`):** MediaPipe's COCO object detector found the medicine ball in only 0–40% of frames, and plain circle-finding latched onto gym plates. Instead the body is the reference: ball radius ≈ 0.19 × leg length; while held it's searched for only at the hands (fallback: the hands); from each rep's release it's followed by a **Kalman filter with gravity** (seeded from the first two sightings; 3σ gate; moving, ball-sized blobs above the shoulders with the athlete blanked out), caught when the predicted path returns to the hands (≤ 1.2 s), then smoothed backwards (Rauch–Tung–Striebel). Results and lessons: RESEARCH.md §3. Lost = hidden, never guessed. Shown as a ring on the video and a blue sphere in 3D (depth = hands' depth; in flight assumed). In flight a gravity parabola is fitted through the sightings: it fills gaps (blur, top of frame), removes stray detections, and — when its gravity matches the ball's size — carries the ring on to the catch (state 2, drawn dotted as "estimated"). Feeds WB-05.

**Corrections applied before any rule runs** (1 and 2 are hardcoded design decisions; only the roll is configurable):

1. **Left/right averaging.** Side-on, MediaPipe often flickers between the near and far leg. A swapped pair produces a fake depth jump. Use `hip_y = mean(L_hip_y, R_hip_y)` and `knee_y = mean(L_knee_y, R_knee_y)`. That's valid because side-on both legs sit at nearly the same height. Use a single side only when the other has visibility < 0.3.
2. **Per-rep normalisation.** `L` = median leg length (hip→knee + knee→ankle) over **that rep's frames**, not the whole clip. The athlete drifting toward or away from the wall changes their size in the frame.
3. **Roll correction.** `camera_roll_deg` in `rules.yaml` (default 0) rotates all points about the frame centre before measuring. It's a calibration setting for a slightly crooked clip.

Conventions: image coordinates, y grows downward, after the corrections above. Thresholds are expressed in units of `L`, so they're **scale-free**. Each rule returns `pass | fail | not_assessable` (plus a `low_confidence` flag) with the measured value and a reason.

### 6.1 No-rep rules (decide the verdict)

| ID | Rule | Source | Detection | Default threshold | Why this threshold | View |
|---|---|---|---|---|---|---|
| **WB-01** | Squat depth: hips lower than knees | p.26 depth bullet | At the rep's bottom (max hip y, taking the max over ±3 frames): `depth = (hip_y − knee_y) / L` with L/R-averaged hip and knee (§6.0) | **pass if depth ≥ −0.17** (calibrated; first guess −0.03); missing by < 0.03 → `low_confidence` (can't judge, not a no-rep). One-sided: passes aren't second-guessed, the margin is already in −0.17 | MediaPipe's "hip" is the hip-joint centre (sits above the hip crease) and its "knee" is the knee-joint centre (sits below the top of the knee). Joint-centre-below-joint-centre is stricter than the judge's crease-below-top-of-knee. **Calibrated on CrossFit's official standard video: legal reps measure −0.10 to −0.15 L, a deep squatter +0.09 to +0.18 L** (see rules.yaml). | Side ✅ / front-back: hip-drop estimate, pass or can't judge |
| **WB-02** | Standing tall at the start | p.26 start bullet | Before the first descent: max knee angle (hip-knee-ankle) ≥ T and hip angle (shoulder-hip-knee) ≥ T, held ≥ 0.2 s | **T = 160°** | Full extension is about 175–180°; pose jitter is ±5–10°; 160° separates "upright" from "quarter squat" | Side ✅ / front ⚠️ (knee angle OK, hip angle foreshortened) |
| **WB-03** | Reset after a drop (no pick-up-and-throw, no continuing after a bounce) | p.26 start and after-target bullets | If both wrists go below the knees between reps (ball picked up from the floor), the next rep needs a WB-02 stand-tall window between pick-up and descent | same T, 0.2 s | Pick-up-and-throw shows as wrists low → straight into a squat with no extended window | Side ✅ / front ✅ |
| **WB-04** | Two-handed throw | p.26 squat-and-throw bullet | At the release frame (wrist apex after the bottom): `wrist_dist / L ≤ 0.6` **and** both wrists above the nose | 0.6 L | A ball is ~35 cm across and L ~85 cm, so hands on a ball sit ~0.4 L apart; 0.6 leaves margin. L instead of shoulder width because side-on the shoulders overlap and their width collapses to ~0 | Front ✅ / side ⚠️: the far wrist is hidden on practically every side-on rep, so this rule is **not required** (a visible fail still = no-rep; hidden → warning, not uncertain) |
| **WB-05** | Ball reaches the target height | p.26 target bullet, p.27 heights | Ball tracked from video (`pipeline/ball.py`); peak height of the ball's top edge in metres, from the floor (ankles + 0.08 m). Pixels → metres by **two independent rulers**: the ball's diameter (0.35 m) and gravity (flight curvature = 9.81 m/s²); used only if they agree within 25% | **pass if peak ≥ 3.00 m men / 2.70 m women**; within 0.15 m → too close to call; ball left the top of the frame above the target → pass; rulers disagree / < 6 flight points → can't judge | Verified on C1b: rulers agree within 13–18%, peaks 2.90–3.15 m (men's 3 m target). Height only; left/right aim not checked. Not required: a confident miss is a no-rep | Side ✅ / front ❌ (target at a different depth) |

**Rep verdict:**
- `not_proper`: any rule returns a confident `fail` (required or not).
- `proper`: every rule required for this view returns `pass`.
- `uncertain`: no confident fails, and at least one required rule is `not_assessable` or `low_confidence` (mean visibility of the involved landmarks < 0.6, or value within the borderline band), whether it passed or failed.
- WB-05 in the MVP is listed as "not assessable from video pose → see Part 2", **without** turning every rep into `uncertain`. A config flag `required: false` handles this.

### 6.2 Coaching metrics (never decide the verdict; feed the summary)

| ID | Metric | Detection | Note |
|---|---|---|---|
| CM-01 | Depth margin per rep | WB-01 value | Trend line across the set; flags "depth fading" |
| CM-02 | Cycle time | bottom-to-bottom time between consecutive reps | AutoTrack's "s/rep"; tempo trend |
| CM-04 | Pauses | gaps > 3 s between reps | Count and total rest time; "broken sets" |

Next steps, added only when a takeaway needs them: descent/ascent time, extension at throw, trunk lean, knee valgus (front view).

Every threshold sits in `rules.yaml` with `source:` and `rationale:` fields. Example:

```yaml
rules:
  WB-01:
    name: Squat depth – hips below knees
    source: "HYROX Singles Rulebook 25/26 R1, §9.8 p.26"
    rationale: "MediaPipe hip = joint centre (above crease), knee = joint centre (below top of knee); small negative margin compensates"
    required: true
    views: [side]
    params: { min_depth_ratio: -0.03, borderline: 0.02, bottom_window_frames: 3, min_visibility: 0.6 }

camera_roll_deg: 0   # calibration for a crooked clip
```

---

## 7. Pipeline architecture

```
           ┌──────────── backend (Django, Python 3.11) ────────────┐
upload ──► │ 1 ingest  → 2 pose → 3 clean → 4 view/quality → 5 segment │
           │                                   ↓                 │
           │          8 summary ◄── 7 verdicts ◄── 6 rules (yaml)  │
           └───────────────┬──────────────────────────────────────┘
                           ▼  JSON (frames, reps, summary)
           ┌────────── frontend (React + shadcn + three.js) ────────┐
           │ video + 2D overlay │ 3D skeleton │ timeline │ summary  │
           └─────────────────────────────────────────────────────────┘
```

| # | Stage | Implementation | Output |
|---|---|---|---|
| 1 | **Ingest** | `ffprobe` for metadata (including the rotation side-data); `ffmpeg` re-encodes to H.264 with **rotation baked into the pixels** (ffmpeg autorotates by default; the output carries no rotation flag), **constant fps** (`-fps_mode cfr -r <source rate, max 60>`), max 1080p on the long edge; `-movflags +faststart`. Clips arrive already trimmed (§5). **Every later stage reads only `normalized.mp4`.** OpenCV ignores rotation flags, and phone clips are variable-frame-rate, so skipping this means a sideways person and an overlay that drifts | `normalized.mp4`, fps, frame count, width/height |
| 2 | **Pose** | MediaPipe **Pose Landmarker (Tasks API), `pose_landmarker_heavy.task`, RunningMode.VIDEO**, frame timestamps from fps | per frame: 33 × (x, y, z, visibility, presence) image-normalised, plus 33 × world (x, y, z) in metres, hip-centred |
| 3 | **Clean** | Roll correction (`camera_roll_deg`); gaps ≤ 5 frames linearly interpolated; Savitzky–Golay smoothing (window ≈ 0.15 s, order 2; `scipy.signal.savgol_filter`) on x and y; L/R-averaged hip, knee and ankle series (§6.0); raw values kept for display | `frames_clean` |
| 4 | **View and quality** | View from torso geometry: `r = shoulder_width / torso_length`. r < 0.5 → side, otherwise front (median over the clip; threshold in yaml). Each rule declares the views it can judge; other views give `not_assessable`. Per-frame quality = mean visibility of hips, knees, ankles, wrists | `view`, per-frame `quality` |
| 5 | **Segment reps** | Signal `s(t)` = L/R-averaged hip y / clip-median L (per-rep L is applied later, in the rules). Bottoms = `scipy.signal.find_peaks(s, prominence ≥ 0.25, distance ≥ 0.8 s)`. Rep start = the last local minimum of `s` (standing) before the bottom; rep end = release frame (min wrist y after the bottom) or the next start. A rep must have its descent and ascent inside the clip | `reps[]` with start / bottom / release / end frames |
| 6 | **Rules** | `rules.py`: one small function per rule ID, reading params from yaml, returning `{status, value, threshold, reason}` | per rep, per rule results |
| 7 | **Verdicts** | Aggregation as in §6.1 | `rep.verdict`, `rep.failed_rules[]` |
| 8 | **Summary** | Totals, proper / not / uncertain counts, fault histogram, cycle-time series with a first-third vs last-third comparison, depth margin by thirds, pauses. **Takeaways are deterministic templates** chosen by thresholds (for example: if last-third depth fails are at least twice the first-third rate → "Your depth faded after rep N; slow the descent once you hit rep N."). No LLM | `summary{}` |

**Why find_peaks on hip height rather than knee angle:** hip height is the movement's main motion, behaves well in every view, and stays robust when one knee is occluded. Knee angle collapses in front view (foreshortening).

**Determinism:** stages 3–8 are pure functions of the stage-2 keypoints and `rules.yaml`. Stage 2 is cached per video (`frames.json.gz`), so re-running after editing `rules.yaml` takes seconds.

### 7.1 Data contracts

`GET /api/videos/{id}/frames/` (gzip):
```json
{ "fps": 60, "width": 1920, "height": 1080,
  "landmark_names": ["nose", "..."],
  "frames": [ { "i": 0, "t": 0.0, "kp": [[x_px,y_px,vis], ...33] | null, "world": [[x,y,z], ...33] | null } ] }
```

`GET /api/videos/{id}/analysis/`:
```json
{ "view": "side",
  "reps": [ { "n": 1, "start": 12, "bottom": 48, "release": 71, "end": 80,
      "verdict": "not_proper",
      "rules": { "WB-01": {"status":"fail","low_confidence":false,"value":-0.11,"threshold":-0.03,"reason":"hip 0.11 L above knee"},
                 "WB-05": {"status":"not_assessable","reason":"ball not tracked by pose"} } } ],
  "summary": { "total": 12, "proper": 8, "not_proper": 3, "uncertain": 1,
     "fault_counts": {"WB-01": 3}, "most_common_fault": "WB-01",
     "cycle_times": [2.1, 2.0, "..."], "tempo_thirds": [2.0, 2.1, 2.6], "pauses": 1,
     "takeaways": ["..."] },
  "warnings": ["Front-on view: squat depth (WB-01) not assessable from this view"] }
```

---

## 8. Backend (Django + DRF)

**Layout**
```
backend/
  manage.py
  config/            settings.py, urls.py
  analysis/
    models.py        Video
    views.py         DRF viewsets
    pipeline/
      ingest.py      ffmpeg/ffprobe
      pose.py        MediaPipe → frames.json.gz
      signals.py     clean, view, segment
      rules.py       one function per rule id
      summary.py
    rules.yaml       ← every threshold lives here
    tests/test_pipeline.py
  media/videos/{id}/ original.mp4, normalized.mp4, frames.json.gz, analysis.json
```

**Model** (one is enough):
`Video(id UUID, title, original FileField, status [uploaded|processing|done|failed], fps, n_frames, view, error, created_at)`. Analysis is a JSON file on disk, not a table.

**Endpoints**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/videos/` | multipart `file`, optional `title`; returns `{id,status}` and starts processing |
| GET | `/api/videos/` | list (library page) |
| GET | `/api/videos/{id}/` | status (poll every 1 s while processing) |
| GET | `/api/videos/{id}/video/` | normalised mp4 |
| GET | `/api/videos/{id}/frames/` | keypoints (§7.1) |
| GET | `/api/videos/{id}/analysis/` | reps, verdicts, summary |

**Processing:** `concurrent.futures.ThreadPoolExecutor(max_workers=1)` inside Django. No Celery or Redis. *Ceiling: one process, one job at a time, jobs lost on restart. Upgrade to Celery + Redis if this ever serves more than one user.* SQLite.

**Gotchas to handle**
- Django's dev server doesn't answer HTTP Range requests, so `<video>` seeking breaks. **Fix:** the frontend fetches the mp4 as a blob and plays it from `URL.createObjectURL`. Clips are under 100 MB, so this is fine.
- CORS: no dependency needed; use the Vite dev proxy `/api → http://localhost:8000`.
- MediaPipe wheels: **use Python 3.11** (`py -3.11 -m venv .venv`). The system default 3.14 is not supported.
- Upload limit: set `DATA_UPLOAD_MAX_MEMORY_SIZE` / `FILE_UPLOAD_MAX_MEMORY_SIZE` (stream to disk); accept mp4/mov only and check with ffprobe (the trust boundary).

**Dependencies:** `backend/requirements.txt` (django, djangorestframework, mediapipe, numpy, scipy, PyYAML; mediapipe brings OpenCV) plus system `ffmpeg` (already installed).

---

## 9. Frontend (TypeScript strict: React + Vite + Tailwind + shadcn/ui + three.js)

- `tsconfig` with `"strict": true`; Vite `react-ts` template; R3F/drei typings.
- `src/api/types.ts` mirrors the §7.1 JSON contracts by hand (`Video`, `FramesData`, `Analysis`, `Rep`, `RuleResult`, `Verdict = "proper" | "not_proper" | "uncertain"`). One file, no codegen; update it whenever `analysis.json` changes.
- `src/api/client.ts`: typed `fetch` wrappers per endpoint.

### 9.1 Screens
1. **Library / Upload:** shadcn `Card` grid of videos with a status `Badge`; upload `Dialog` (file only); status `Badge` shows "processing" until done.
2. **Analysis view:**

```
┌───────────────────────────────┬─────────────────────────┐
│  VIDEO + 2D skeleton overlay   │   3D skeleton (three.js) │
│  HUD: [ REP 7 / 12 ]           │   orbit, floor grid,     │
│       [ ✔ PROPER | ✖ WB-01 ]  │   bones coloured by      │
│       2.1 s/rep                │   current-rep verdict    │
├───────────────────────────────┴─────────────────────────┤
│ Timeline: ▮▮▮▯▮▮▮ (rep segments green/red/grey, click=seek) │
│ Hip-height signal chart with bottoms + thresholds          │
├─────────────────────────────────────────────────────────┤
│ Rep table (n, verdict, failed rule, depth, cycle time)    │
└─────────────────────────────────────────────────────────┘
 End of clip → Summary Sheet: totals, fault bar chart, tempo
 line chart, depth-margin chart, 1–2 takeaways, warnings
```

shadcn components: `Card, Badge, Button, Dialog, Table, Sheet, Alert` (for "not assessable" warnings), `Chart` (Recharts) for the tempo, depth and signal charts.

### 9.2 Frame sync (shared by 2D and 3D)
```ts
video.requestVideoFrameCallback(function tick(_, meta) {
  const i = Math.round(meta.mediaTime * fps);   // constant-fps video from ingest
  setFrame(i);                                    // drives overlay canvas + 3D + HUD
  video.requestVideoFrameCallback(tick);
});
```
- **2D overlay:** a `<canvas>` sized to the video's displayed rectangle, drawing the 33 landmarks and connections. Landmarks with visibility < 0.5 are drawn dashed or faded, which is honesty made visible.
- **Live counter and verdict:** the counter increments when `i ≥ rep.bottom`. The verdict badge appears when `i ≥ rep.release` (the moment a judge would call it), shown for that rep until the next rep's bottom.

### 9.3 3D view
- `@react-three/fiber` + `drei` (`OrbitControls`, `Grid`). The 33 MediaPipe **world landmarks** (metres, hip origin) become sphere joints and cylinder or `Line` bones. Flip y (MediaPipe y points down). Bone colour follows the verdict. Pin the floor to the min ankle y over the clip. Cheap, already-computed data, about 150 lines.
- Next step: an SMPL body mesh (HMR model offline, skinned mesh in three.js, same sync loop). Non-commercial licence.

---

## 10. Repo structure

```
Hyrox/
  PRD.md
  README.md            setup, run, rules + sources + thresholds, decisions, limitations
  backend/             (§8)
  frontend/            Vite React TS app (src/api/{types,client}.ts, src/pages, src/components/{VideoOverlay,Skeleton3D,Timeline,Summary}.tsx)
  clips/               trimmed clips + clips.md (source, timestamps, intended faults)
  eval/
    labels/C1.csv      rep_n, bottom_time_s, expected_verdict, expected_fault
    evaluate.ts        count accuracy + verdict agreement → prints a table for the README.
                       Runs with `node eval/evaluate.ts …` (Node 24 strips types natively: no build, no deps)
  docs/part2_imu_emg.md   (later)
```

---

## 11. Acceptance criteria and evaluation

**P0 (must ship Monday)**
1. Uploading C1–C4 processes end to end with no manual steps.
2. Rep count is within ±1 of the hand count on every side-on clip.
3. Per-rep verdicts agree with hand labels on **≥ 80 %** of reps on C1 + C2 (side-on). Every disagreement is listed in the README with a frame screenshot and the reason.
4. On C4 (front/back), clearly deep reps pass on the hip-drop estimate; others show **can't judge**, never a no-rep, with an `Alert` explaining the view.
4a. A phone clip recorded in portrait with a rotation flag and variable frame rate plays upright, with no overlay drift by the end of the clip.
5. Playback shows the 2D overlay, a live counter and a live verdict in sync (no visible drift at 60 fps).
6. The 3D skeleton plays in sync.
7. The summary shows totals, the most common fault, the tempo chart and trend, and 1–2 takeaways.
8. `rules.yaml` holds every threshold with its source and rationale; the README mirrors it.

**Self-check:** `backend/analysis/tests/test_pipeline.py` uses synthetic keypoints (5 reps, one shallow) and asserts 5 reps are found and exactly one WB-01 fail. `backend/analysis/tests/test_api.py` uploads a generated test video and checks the full API flow, plus rejection of a non-video. Run both with `python manage.py test` from `backend/`.

**Evaluation script:** `node eval/evaluate.ts backend/media/videos/<id>/analysis.json eval/labels/C2.csv` prints count error, verdict agreement and a confusion table. Paste the output into the README.

**Label quality:** labels are made from 0.25× slow-motion playback. If a second person labels C2 (`eval/labels/C2_b.csv`), `evaluate.ts` also prints human-vs-human agreement. That is the realistic ceiling for system-vs-human agreement, and the README should state it either way.

---

## 12. Plan (Sat → Mon)

| When | Work | Done when |
|---|---|---|
| **Sat 21 pm** | Record C1–C4; trim; write labels CSVs. Python venv; `pose.py` + `signals.py` as a CLI on one clip; plot the hip signal | Reps found on C1 |
| **Sat 21 eve** | `rules.yaml` + `rules.py` + `summary.py`; calibrate WB-01 on C1/C2; synthetic test | Verdicts printed for C1–C4 |
| **Sun 22 am** | Django project, model, endpoints, thread worker | curl flow works |
| **Sun 22 pm** | Vite + shadcn scaffold; upload/library; video overlay + sync; HUD; timeline | Live counter and verdicts on screen |
| **Sun 22 eve** | 3D skeleton; summary sheet + charts | Full UI on all clips |
| **Mon 23 am** | `evaluate.ts`, README (rules table, limitations, failure screenshots), next-steps list | P0 checklist ticked |
| **Mon 23 pm** | 3–5 min screen recording; Part 2 note; buffer | Submitted |

Order matters: **the CLI pipeline works before any UI.** If time runs out, the CLI plus README is still an honest submission.

---

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hip/knee keypoints jitter around the threshold at the bottom | Flip-flopping depth verdicts | Smoothing; use the max over a ±3-frame window at the bottom; `low_confidence` band of ±0.02 around the threshold |
| MediaPipe swaps near/far leg side-on | Fake depth jumps | L/R averaging (§6.0) |
| Phone rotation flag / variable frame rate | Sideways pose, overlay drift | Ingest bakes in rotation and forces constant fps; all stages read `normalized.mp4` |
| Camera not level, too high, or ultra-wide lens | Biased depth | Recording guide (level, hip-height, 1×); `camera_roll_deg` override |
| Target not in frame | WB-05 impossible | Portrait framing at 3.5–4 m (§5) |
| Athlete drifts toward or away from the camera | Thresholds off in pixels | Per-rep leg-length normalisation |
| Self-labelled ground truth | Inflated accuracy | Slow-motion labelling; second labeller; human-vs-human agreement reported |
| Ball occludes the face and wrists at release | WB-04 unreliable | Visibility gate → not_assessable; documented |
| Baggy shorts hide the hip | Depth bias | Recording guide; noted in limitations |
| Athlete partly leaves the frame | Lost reps | Quality gate; the rep gets `uncertain` with reason "landmarks out of frame" |
| MediaPipe install issues | Blocks everything | Done: Python 3.11 venv, `mediapipe==1.2.3` (Tasks API only; the legacy `solutions` API no longer ships) |
| Scope creep (Django + React + three.js in 2.5 days) | Unfinished app | CLI first (§12); UI pieces in priority order: overlay → HUD → summary → 3D |
| The 15 s / judge standard is stricter than our camera can see | False "proper" | We report `uncertain` rather than `proper` whenever a required rule can't be checked |

---

## 14. Open questions

1. Reddit post: paste the text or repo link so §3.2 and §9.3 reflect what it actually does.
2. Division for your clips (sets the target height label for WB-05 and the README): men 3.00 m or women 2.70 m?
3. Do you want an annotated MP4 export (overlay burned in) for the demo, or will a screen recording of the app do? (Default: screen recording, so no export code.)
4. Part 2: deferred, per your call.

---

## 15. Sources

- HYROX Singles Rulebook 26/27 (current season): §8.8 Wall Balls pp.34–36; §12.5 penalty codes p.45. <https://hyrox.co.in/rulebooks/>
- HYROX Singles Rulebook 2025/26 R1 (first draft of the rules): §9.8 Wall Balls pp.26–27; penalties p.32 (code 015); §13.2, §13.5 p.34. <https://hyroxdach.com/wp-content/uploads/2025/06/25_26-Singles-Rulebook_en_R1.pdf>
- Centr, "Wall ball rulebook: what judges watch every HYROX rep": <https://centr.com/blog/show/f429ca4a-3798-494f-9924-d02c7440a83f/wall-ball-rulebook-what-judges-watch-every-hyrox-rep>
- Sundried, "HYROX penalties and movement standards: a judge's guide": <https://www.sundried.com/blogs/guide/hyrox-penalties-and-movement-standards-a-judges-guide>
- Roxlyfe, HYROX wall balls guide: <https://roxlyfe.com/hyrox-wall-balls-guide/>
- Red Bull, "How to train for wall balls": <https://www.redbull.com/int-en/how-to-train-for-wall-balls>
- MediaPipe Pose Landmarker (Tasks API): <https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker>
- AutoTrack reference short: <https://www.youtube.com/shorts/MFemCg25q6g>
