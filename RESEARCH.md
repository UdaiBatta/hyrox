# Research note: improving accuracy and stability

Scope: what the literature says about the three weak points found while building the prototype, and a ranked
plan to fix them. (1) 2D/3D body accuracy, (2) ball detection and tracking over time, (3) judging form like a
human judge. Figures quoted below are each paper's own reported numbers unless marked as ours.

## 0. Where the prototype stands (measured on our clips)

| Area | What we use now | Where it breaks (ours) |
|---|---|---|
| 2D body points | MediaPipe Pose Landmarker heavy (BlazePose GHUM) | Side-on, the far leg and wrist are hidden; their guessed positions are wrong (visibility ~0.4). Two-handed-throw check can't see the far wrist on 9/9 side-on reps |
| 3D skeleton | Our lift: 2D points + depth from bone length + movement priors (sagittal plane side-on, left/right symmetry front-on) | Before the priors, a hidden leg read as 0.8 m of depth and a rounding spine tipped the body flat. Priors fix side-on; front/back depth is still a guess |
| Ball | Body-referenced tracker: circle at the hands, moving ball-sized blob in flight, gravity parabola fit | MediaPipe's COCO "sports ball" detector found the ball in 0–40% of frames. Ours places it in 90–100% on most clips but drops whole flights on tightly framed clips (C2) |
| Target (WB-05) | Peak height in metres from two rulers (ball size, gravity) | Rulers agree within 13–18% on C1b; judged only side-on with enough flight points |

## 1. Papers and what they found

### A. 2D body keypoints (the input to everything)

| Paper | Finding | What it means for us |
|---|---|---|
| **BlazePose GHUM Holistic** (Google, 2022) [arXiv 2206.11678](https://arxiv.org/pdf/2206.11678.pdf) | The model behind MediaPipe. One pass predicts 2D + 3D landmarks; a GHUM body model keeps 3D poses plausible. Heavy model: 68.1 mAP 2D, 36 mm mean 3D error in the authors' table | Our baseline. Its 3D ("world") output is a learned guess. We measured it reading the same legal squats 0.33 leg-lengths too deep from behind |
| **RTMPose** (2023) [arXiv 2303.07399](https://arxiv.org/abs/2303.07399) | 75.8% AP on COCO at 90+ FPS on a CPU; designed for deployment | Drop-in upgrade candidate for 2D accuracy at similar speed. Worth an A/B on depth calls |
| **ViTPose** (NeurIPS 2022) [arXiv 2204.12484](https://arxiv.org/pdf/2204.12484) | Plain vision transformers reach 80.9 AP on COCO test-dev (largest model) | The accuracy ceiling for 2D; heavy, offline use only. RTMPose's own paper notes such transformers are costly to deploy |

### B. 3D pose and world grounding (the "perception beyond the video")

| Paper | Finding | What it means for us |
|---|---|---|
| **VideoPose3D** (CVPR 2019) [paper](https://ai.meta.com/research/publications/3d-human-pose-estimation-in-video-with-temporal-convolutions-and-semi-supervised-training/) | Dilated temporal convolutions over a 2D keypoint *sequence* lift it to 3D; works with any 2D detector | The classic proof that time helps 3D: a whole sequence of 2D points beats one frame. CC BY-NC ([fork README](https://github.com/na018/VideoPose3D)) |
| **MotionBERT** (ICCV 2023) [repo](https://github.com/walter0807/motionbert), [paper](https://ar5iv.labs.arxiv.org/html/2210.06551) | Pretrained motion representation; 3D pose 37.2 mm MPJPE on Human3.6M; up to 243-frame sequences; 17-keypoint H36M input | Easiest learned upgrade for our 3D view: feed our 2D sequence (remapped from 33 to 17 points), get a 3D sequence |
| **HMR 2.0 / 4DHumans** (ICCV 2023) [paper](https://openaccess.thecvf.com/content/ICCV2023/html/Goel_Humans_in_4D_Reconstructing_and_Tracking_Humans_with_Transformers_ICCV_2023_paper.html), [repo](https://github.com/shubham-goel/4d-humans) | Transformer predicts a full 3D body mesh from each frame; tracking in 3D keeps identities through occlusion | Gives a body *mesh* (the "extra scope" 3D model) and handles multiple people at a race |
| **WHAM** (CVPR 2024) [paper](https://openaccess.thecvf.com/content/CVPR2024/papers/Shin_WHAM_Reconstructing_World-grounded_Humans_with_Accurate_3D_Motion_CVPR_2024_paper.pdf), [arXiv](https://arxiv.org/abs/2312.07531) | Lifts 2D keypoint sequences using motion-capture data, fuses video features, predicts **foot–ground contact** to stop foot sliding. First video method to beat image methods on per-frame accuracy while staying smooth | Directly fixes "floating" and sliding feet; research-only code |
| **GVHMR** (SIGGRAPH Asia 2024) [repo](https://github.com/zju3dv/GVHMR), [arXiv](https://arxiv.org/html/2409.06662v1) | Estimates pose in a **gravity-view** frame (gravity + camera view direction), so the body is upright and grounded in the world | The closest match to "know the person is standing vertically". Needs SMPL (MPI registration); research licence ([note](https://huggingface.co/ryanrudes/gvhmr)) |

### C. Temporal smoothing of pose

| Paper | Finding | What it means for us |
|---|---|---|
| **SmoothNet** (ECCV 2022) [arXiv](https://arxiv.org/abs/2112.13715), [repo](https://github.com/cure-lab/SmoothNet) | Jitter is uneven: most frames are slightly off, occluded or rare poses give long bad stretches that low-pass filters can't fix. A temporal-only network per joint improves smoothness *and* per-frame accuracy; works on 2D and 3D from any estimator | We use a fixed Gaussian/Savitzky–Golay smoother. SmoothNet is a plug-in after MediaPipe for the long occluded stretches (the hidden far side) |

### D. Ball detection and tracking over time

| Paper / method | Finding | What it means for us |
|---|---|---|
| **TrackNetV3** (ACM MMAsia 2023) [paper](https://people.cs.nycu.edu.tw/~yushuen/data/TrackNetV3.pdf), [repo](https://github.com/qaz812345/TrackNetV3) | Heatmap network over **several consecutive frames** plus an estimated background; a second module repairs gaps along the predicted trajectory by inpainting. 97.51% accuracy vs 57.82% for YOLOv7 on fast shuttlecocks in their table | The strongest evidence that *multi-frame input + trajectory repair* beats single-frame detection for fast balls. Needs labelled frames of wall balls to train |
| **SAM 2** (Meta, ICLR 2025) [paper](https://arxiv.org/html/2408.00714v1), [site](https://ai.meta.com/sam2) | Click or box an object once; a **memory bank** carries it through the video; an occlusion head says when it's hidden; it re-finds the object when it reappears. Trained on 35.5M masks / 50.9K videos | Fits our setup: we already know where the ball is (at the hands) on the first frame. Prompt SAM 2 there, get a ball mask on every frame. Known weakness: distractors can creep into memory before a failure (SAMURAI and similar fix this) |
| **Grounding DINO** (2023) [arXiv](https://arxiv.org/html/2303.05499v5) | Text-prompted detection: 52.5 AP on COCO without COCO training; often paired with SAM | "medicine ball" as a text prompt instead of COCO's fixed "sports ball" class. Use to (re)initialise SAM 2 if it loses the ball |
| **CoTracker** (ECCV 2024) [paper](https://www.ecva.net/papers/eccv_2024/papers_ECCV/html/7890_ECCV_2024_paper.php), [site](https://co-tracker.github.io) | Tracks many points *jointly*; can follow points through occlusion and outside the camera view | Track points on the ball's surface as a group: robust to blur and partial occlusion by hands |
| **ByteTrack** (ECCV 2022) [arXiv](https://arxiv.org/abs/2110.06864) | Keep **low-confidence** detections and match them to existing tracks using Kalman-filter motion prediction; recovers occluded objects that thresholding throws away | Our tracker discards weak sightings. ByteTrack's second-stage matching would keep blurred and partly hidden ball sightings |
| **Kalman + physics** (baseball and basketball tracking) [basketball, physics-based](https://ir.lib.nycu.edu.tw/bitstream/11536/7427/1/000264595500004.pdf), [baseball, Kalman](https://www.cecs.uci.edu/~papers/icme06/pdfs/0001813.pdf), [review](https://arxiv.org/pdf/2509.18451) | Seed a track from two nearby candidates, predict with a Kalman filter, accept candidates near the prediction, reject trajectories that break physics. Limitation: plain projectile models break when the ball's path isn't a single parabola ([2025](https://arxiv.org/html/2506.05763v1)) | Our parabola fit is the offline version of this. A Kalman filter with gravity in its motion model would make the *search* principled (prediction plus uncertainty) instead of our hand-tuned search windows. A wall-ball flight is two parabolas (up to the wall, bounce back), so model the wall contact |

### E. Judging exercise form (the closest prior work to this project)

| Paper | Finding | What it means for us |
|---|---|---|
| **Pose Trainer** (Stanford, 2020) [arXiv 2006.11718](https://arxiv.org/abs/2006.11718) | OpenPose plus **geometric rules** on joint vectors gives useful form feedback on 4 exercises; evaluation is only as good as the pose estimator | Validates our design (pose → readable rules). Same lesson we hit: pose errors become verdict errors |
| **AIFit** (CVPR 2021) [paper](https://openaccess.thecvf.com/content/CVPR2021/html/Fieraru_AIFit_Automatic_3D_Human-Interpretable_Feedback_Models_for_Fitness_Training_CVPR_2021_paper.html), [Fit3D](https://fit3d.imar.ro/) | 3D pose → rep segmentation → compares the trainee to **trainer-derived standards**; a strictness dial (0 = very critical … 1 = relaxed); Fit3D dataset with 3D ground truth for 37+ exercises | Our leniency question has a precedent: expose a strictness setting instead of one hard threshold. Fit3D is a source of 3D ground truth to check our lift |
| **Fitness-AQA** (ECCV 2022) [arXiv 2202.14019](https://arxiv.org/abs/2202.14019) | Off-the-shelf 2D/3D pose estimators fail on real gym video (occlusion by equipment, loose clothes); self-supervised features that exploit the repetitive cycle of reps beat them on squat/row/press error detection | Warns that pose-only judging hits a ceiling in real gyms. Their trick, using the rep cycle, matches our segmentation |
| **RepNet** (CVPR 2020) [paper](https://openaccess.thecvf.com/content_CVPR_2020/html/Dwibedi_Counting_Out_Time_Class_Agnostic_Video_Repetition_Counting_in_the_CVPR_2020_paper.html), [blog](https://research.google/blog/repnet-counting-repetitions-in-videos/) | Counts repetitions of *any* action from a self-similarity matrix; no exercise-specific training | An independent rep counter to cross-check our hip-based segmentation (flags missed or extra reps) |

## 2. Improvement plan, ranked by impact for effort

### Ball: "temporal vision" (the question asked)

The pattern across TrackNetV3, SAM 2, CoTracker and the Kalman papers is the same: **decide from many frames, not
one**. The ball is small, blurred and partly hidden in any single frame, but its path over time is constrained
(at the hands, or flying under gravity).

1. **Kalman filter with gravity, plus an offline smoother** (½ day, no new dependencies). **Done — see §3.**
   State `[x, y, vx, vy]`, with gravity in the motion model (`ay` = g in pixels, from the ball-size ruler).
   - The prediction and its uncertainty give the search window each frame, replacing our hand-tuned windows.
   - Weak sightings are still used, weighted by their noise (the ByteTrack lesson).
   - A Rauch–Tung–Striebel backward pass smooths the whole clip with no lag.
   - Model the flight as two parabolas split at the wall contact.
   - Expected gain: fewer dropped flights on clips like C2, and a smoother ring.
2. **SAM 2 video propagation** (½–1 day, GPU; our RTX 4060 is enough).
   - Prompt with a box around our held-ball circle on the first good frame.
   - Propagate through the clip; the ball is the mask's centre and size, and "hidden" comes from the occlusion head.
   - Keep the Kalman/physics layer as a sanity check: reject masks that jump against gravity.
   - Expected gain: the biggest single jump in coverage and position accuracy. It also measures the ball's real
     size every frame, which tightens the size ruler for WB-05.
3. **Grounding DINO "medicine ball"** to re-initialise SAM 2 when it loses the ball (½ day).
4. **Only with labelled data: a TrackNet-style multi-frame model** fine-tuned on our own clips
   (~2k labelled frames). This is the end state for a product; overkill for the assignment.

How to know it worked: label the ball centre on every 5th frame of 4 clips. Report (a) coverage, the % of frames
with a ball; (b) the % within half a ball-radius of the label; (c) WB-05 height error against the known 3.00 m
target on our own recordings.

### 3D skeleton

1. **Done:** movement priors (sagittal plane side-on, symmetry front/back); upright and grounded.
2. **GVHMR** (1 day: SMPL registration, conda env, GPU). Run offline per clip, store joints next to
   `frames.json.gz`, and draw them in the existing 3D view. Gravity-aligned by design; the best answer to "upright".
   - **WHAM** is the alternative if foot sliding matters more.
   - **HMR 2.0** gives the full body mesh for the "extra scope" 3D model.
3. **MotionBERT** if a lighter learned option is wanted: our 2D sequence in, 3D sequence out (½ day).
4. **SmoothNet** after MediaPipe for long occluded stretches (½ day).

### Verdict accuracy (what the company will care about most)

1. **Ground-truth labels first.** Label your own side-on recordings rep by rep at 0.25× (PRD §5), with a second
   labeller. Every improvement above should be judged by agreement with the human judge, not by eye.
2. **A/B the 2D model:** MediaPipe vs RTMPose (and ViTPose offline) on the same labelled reps. Compare depth-call
   agreement and how often the far side is hidden.
3. **Strictness setting (AIFit):** expose the WB-01 margin as "strict / standard / lenient", with the calibrated
   −0.17 L as "standard".
4. **Cross-check rep counting with RepNet** on the same clips.

### Suggested order

- **Before submission:** item 1 of the ball plan (Kalman + smoother), because it needs no new models and fixes the
  dropped flights; then the labelled-clip evaluation, because it turns "looks better" into numbers.
- **Next step (state it in the write-up):** SAM 2 for the ball, GVHMR for 3D, RTMPose A/B for 2D.
- **Part 2 link:** a thigh IMU measures depth from any camera angle. That removes the front/back depth guess that
  no single-camera method fully solves.

## 3. Result: gravity Kalman tracker (implemented 2026-11-22, `backend/analysis/pipeline/ball.py`)

**What was built:**
- State `[x, y, vx, vy]`, with gravity as a known acceleration (from the ball-size ruler).
- The search window is the 3σ gate from the filter's own uncertainty; sightings are weighted by how complete the
  blob is.
- Sideways speed may change sharply (the wall bounce); vertical may not.
- A Rauch–Tung–Striebel backward pass smooths each flight; a position is drawn only where the smoothed σ is under
  one ball radius.

**Lessons on the way (each one a real failure, fixed):**
1. **Starting from a guess at the release frame sent the filter off the top of the frame.** "Release" is when the
   wrists peak, by which time the ball is already several radii up. Fix: seed from the first two real sightings
   (position + velocity), as the classic ball-tracking papers do. Always keep searching, and cap speed at
   12 m/s.
2. **"Hands below shoulders = caught" is false:** athletes lower empty hands to wait for the ball. Fix: caught when
   the *predicted path* comes back down to the hands, or the ball is sighted at the hands while falling. The catch
   is then fed to the filter as a final sighting, so the smoother brings the path down to the hands.
3. **Averaging the two rulers leaked the gravity fit's noise into the height** (a 3.0 m throw read 2.71 m).
   Fix: the ball's size measures; gravity only checks it (more than 12.5% apart = too close to call, more than
   25% = can't judge).

**Before → after** (frames: seen / filled by the filter / hidden; throws whose gravity curve could be fitted):

| Clip | Before | After |
|---|---|---|
| C1b side gym | 57 / 18 / 0 · 4/4 | 63 / 12 / 0 · 4/4 |
| C1 studio | 69 / 28 / 42 · 5/9 | 59 / 47 / 42 · 7/9 (WB-05 judged on 6/9, was 4/9) |
| C2a coach | 46 / 32 / 18 · 3/6 | 63 / 32 / 27 · 6/6 |
| C2b coach | 31 / 0 / 36 · 1/8 | 58 / 34 / 39 · 5/8 |
| C4b back gym | 169 / 72 / 1 · 11/12 | 168 / 79 / 0 · 11/12 |
| C4a back studio | 36 / 14 / 3 · 5/5 | 36 / 11 / 8 · 5/5 |

**Still wrong (checked by eye):**
- On some C1 descents the filled ring sits about one radius above the ball.
- One C1 catch is called a few frames early.
- A fast return past the hands can be missed, because blanking the arms also hides the ball there.

**Open finding:** on both coach clips (C2a/b) the gravity ruler is a consistent ~0.68× the size ruler. A constant
factor points to the clip, not the tracker. Likely the video's timing (an edited or slowed segment changes apparent
gravity by the square of the speed factor) or a different ball size. WB-05 correctly says "can't judge" there.

**Next:** SAM 2 for the near-hands frames (the remaining errors), then the labelled-frame evaluation.
