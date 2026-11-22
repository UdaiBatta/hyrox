# Part 2: where IMU and EMG close the camera's gaps

The prototype (Part 1) says **"not assessable from this view"** instead of guessing. Those answers are the
shopping list for sensors. This note takes each gap we measured on our clips, names the sensor that fills it, and
gives a fusion plan that could be built on top of the existing pipeline without changing how verdicts are made.

## 1. The gaps, measured (from Part 1's output on 7 clips, 48 reps)

| Gap | What the camera does today | How often (our clips) |
|---|---|---|
| **G1. Squat depth from the front or behind** (WB-01) | Hip and knee line up with the camera. A hip-drop estimate can confirm a clearly deep rep but **can never call a no-rep** | Every rep filmed from behind (21/21 on C4a/b/c) |
| **G1b. Squat depth even side-on** (WB-01) | Where MediaPipe puts the hip point varies by athlete: two athletes at about parallel measure 20° apart in thigh angle, so one threshold lets a rep ~15–20° above parallel pass for some athletes (README, shallow-rep test) | All side-on athletes; size depends on the athlete |
| **G2. Two-handed throw** (WB-04) | The far wrist is hidden at release side-on (and often from behind) | Not assessable on 27/27 side-on reps, 11/12 on C4b |
| **G3. Ball reaches the target** (WB-05) | Needs the ball tracked through the flight, side-on only, plus two rulers that agree | Not assessable on 16/27 side-on reps and on every front/back rep |
| **G4. Fatigue before it shows** | Video sees depth fade and slower tempo only *after* they happen | n/a (coaching) |
| **G5. Hidden joints at the bottom of the squat** | Arms and the far leg are estimated, not seen (shown faded/dashed) | C4b: 255 frames with the right knee hidden |

## 2. Sensor per gap

| Gap | Sensor and placement | What it measures | Why it works |
|---|---|---|---|
| **G1, G1b depth** | IMU on the **front of each thigh** (mid-femur), 100+ Hz, accelerometer + gyro | Thigh pitch against gravity. "Hips below knees" ≈ thigh past horizontal | Independent of camera angle. At the bottom of the squat the leg is turning around, so acceleration is near zero and gravity is a clean reference (orientation error ~2–5° with a complementary filter) |
| **G2 two hands** | IMU in **both wrists** (watch + band, or two bands) | Upward acceleration peak of each hand at release | Two hands on a 9 kg ball push together: both wrists peak within ~50 ms with similar magnitude. A one-handed throw shows one spike |
| **G3 target** | The same **wrist IMUs** | (a) Hand vertical speed *v* at release → peak = release height + *v*²/2g. (b) Release-to-catch time *T* (push peak to catch impact spike) → rise above release ≈ g*T*²/8 | Two physics estimates that need no view of the ball. (b) is robust: timing spikes are sharp and drift-free |
| **G4 fatigue** | **EMG** on the quads (vastus lateralis) and front shoulder (anterior deltoid); fabric electrodes in shorts/top | Median frequency falls and RMS amplitude rises as a muscle fatigues | Predicts the depth fade a few reps before it shows. Quad onset vs deltoid onset also checks the coaching tip "finish the hip drive before the arm push" |
| **G5 hidden joints** | Thigh + **shin** IMUs | Knee angle directly | Replaces the inverse-kinematics guess for the far knee in the 3D view |

**Minimum useful kit:** 2 thigh IMUs + 2 wrist IMUs. That closes G1–G3, the three gaps that change verdicts.
EMG (G4) is coaching value, not judging.

## 3. Fusion plan

**Principle: keep the rule engine; sensors become extra evidence per rule.** Every rule already returns
`{status, value, low_confidence, reason}`. Each sensor gets the same interface, so fusion is a small, explainable
decision per rule, not a black box.

### 3.1 Time sync (the step that makes or breaks fusion)
1. **Coarse:** at the start of the set the athlete stands tall (WB-02 already requires it) and does one quick squat
   or a clap. That shows as a sharp event in both streams.
2. **Fine:** cross-correlate the **hip's vertical acceleration from video** (second derivative of the smoothed hip
   track, already computed) with the **thigh IMU's vertical acceleration** over the whole set. The peak gives the
   offset.
3. **Drift:** repeat the correlation per rep and fit a line (offset + clock drift).

   Target: under one video frame (17–33 ms), checked by the residual of the fit.

### 3.2 Calibration
- **Zero:** the standing-tall phase before rep 1 (and every WB-03 reset) gives "thigh vertical", which re-zeroes each
  thigh IMU against strap slip.
- **Body scale:** the video already measures leg length *L*. It maps IMU angles onto the same joint-centre
  depth definition as the side-on rule (the −0.17 L threshold), so camera and IMU depth mean the same thing.
- **No magnetometer:** gym steel distorts it, and gravity is the only reference we need.

### 3.3 Decision per rule

| Video | Sensor | Result |
|---|---|---|
| Confident | Agrees | Confident verdict (higher confidence shown) |
| Confident | Disagrees beyond tolerance | **Can't judge**, and the rep is logged for calibration review |
| Not assessable / borderline | Confident | Sensor decides (reason says "from thigh sensor") |
| Not assessable | Missing or noisy | **Can't judge**, as today |

For continuous values (depth, ball peak height) both sources are combined by **inverse-variance weighting**, then
the existing threshold and borderline band apply. The "can't call a no-rep from behind" restriction on WB-01 is
lifted only when the thigh IMU is present and confident.

### 3.4 Validation before trusting it
1. Film side-on (camera = reference) with the IMUs on. Measure IMU-vs-video agreement on depth and two-hand calls,
   rep by rep.
2. Pass bar: ≥ 95 % agreement on clear reps, and disagreements only inside the borderline band.
3. Then film the same athletes from behind and confirm the IMU still agrees with the side camera.
4. Ball height: compare wrist-IMU peak estimates with the video's measured peaks on C1b-style clips, where both
   rulers agree.

### 3.5 Failure modes and handling
- **Strap slip:** re-zero at each standing phase; flag when the standing angle drifts more than 10°.
- **Catch impacts look like throws:** classify by phase. A push is an upward peak after the squat; a catch is a
  downward impact after a free-fall gap.
- **EMG sweat and electrode shifts:** use relative change within a set (frequency slope), never absolute amplitude.
- **Missing sensor:** the system falls back to today's camera-only behaviour, including "can't judge".

## 4. What this buys, in one line per rule
- **WB-01:** depth judged from any camera angle. Front/back filming becomes valid.
- **WB-04:** two-handed throw judged on every rep, not ~0 %.
- **WB-05:** target height estimated on every rep, with video as a cross-check when it can see the ball.
- **Summary:** "your quads are fatiguing, depth will fade in ~5 reps" *before* the no-reps start.
