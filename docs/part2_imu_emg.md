# Part 2: adding IMU and EMG to the wall-ball form check

Worked example: the HYROX Wall Ball station built in Part 1. Numbers marked *(Part 1)* are measured on our 7 test clips
(48 reps); everything else is from the cited literature or is labelled as my assumption.

## 1. What computer vision could not see, and the sensor that fixes it

| Part 1 rule | What went wrong on video *(Part 1)* | Sensor that fixes it |
|---|---|---|
| **WB-01 depth, filmed from behind** | Hip and knee line up with the camera, so depth can only be *confirmed*, never failed. 20 of 21 rear-view reps were confirmed, 1 unassessable (ankles cropped), and none can ever be a no-rep | **Thigh IMU**: thigh angle against gravity is the same from any camera angle |
| **WB-01 depth, side-on** | On the filmed shallow-squat test, only **1 of 5** shallow reps got a confident no-rep. The other 4 were "can't judge", because the knee was weakly observed in a close-up. One of 2 borderline reps was confidently failed | **Thigh IMU** again: it measures the thigh segment directly, with no occlusion. IMU knee-flexion error against optical motion capture in squats is reported under ~4–6° [8] |
| **WB-04 two-handed throw** | The far wrist is hidden at release: judged on **0 of 27** side-on reps | **IMU on each wrist**: two hands on one ball push together, so both wrists should show the same upward acceleration peak at release; one-handed throws show one |
| **WB-05 ball reaches target** | Needs the ball tracked through its flight and two scale estimates that agree: judged on **11 of 27** side-on reps, none from behind | **Wrist IMUs**: release-to-catch time *T* gives the rise above the hands (≈ g·T²/8 if caught at release height), with no view of the ball needed |
| **Rep count with hidden joints** | Hips and knees hidden behind the body at the bottom (C4b: right knee hidden on 255 frames) | **Thigh IMU** cycles give the squat bottoms directly |

## 2. New insights that video can't give

- **Fatigue across the set (EMG).** As a muscle fatigues, the surface-EMG power spectrum shifts to lower frequencies
  and amplitude tends to rise [1, 2]. The coaching value is a warning *before* depth or pace drop: "your quads are
  tiring, depth will slip". Caveat: median frequency is most reliable in steady contractions. A wall-ball rep is
  dynamic, and the literature recommends time-frequency methods for that case [9]. I would treat this as a trend
  within one set, never as an absolute number.
- **Left/right asymmetry (two thigh IMUs, two quad EMG channels).** Per rep: the difference in thigh depth, drive
  speed and quad activation between legs, reported as a standard symmetry index. Video side-on sees one leg.
- **Which muscles do the work (EMG).** The throw should come from the hips and legs (quads, glutes), with the shoulders
  finishing. The share of activation, and the timing of quad onset vs front-shoulder onset, test the Part 1 coaching
  tip "finish the hip drive before the arms push". I found **no EMG study of the wall ball itself**, so expected
  patterns would have to be measured, not assumed.
- **Compensation patterns.** When legs fatigue, the arms take over: shoulder activation rises while hip drive speed
  falls and the throw still lands. Video sees only that the ball hit.
- **Power and tempo (IMU).** Hip vertical speed in the drive gives concentric power (body mass known). IMUs measuring
  bar velocity are mostly valid and reliable when the specific device has been validated [10]. A pelvis or thigh IMU
  also splits each rep into descent, bottom, drive, flight and catch, so a slow catch can be told apart from a slow
  squat.

## 3. Sensor placement, and how few we can get away with

| Sensor | Where | Gives |
|---|---|---|
| IMU ×2 | Front of each thigh, mid-femur, strapped (the front of the thigh moves least relative to the bone) | Depth from any view, squat bottoms, asymmetry, drive speed |
| IMU ×2 | Both wrists (a watch and a band) | Two-handed release, throw height from flight time, catch timing |
| IMU (optional) | Sacrum | Hip power and tempo phases |
| EMG ×3–4 | Vastus lateralis (both legs), gluteus maximus, anterior deltoid; SENIAM placement [3] | Fatigue, which muscles work, compensation |

**Minimum: 3 IMUs (1 thigh + 2 wrists).** That fixes every verdict gap in section 1. A second thigh IMU adds
asymmetry, and **one** EMG channel on the quad adds the fatigue trend. EMG is coaching value only. I would not let it
decide a rep.

## 4. Fusion approach

```
 video 30-60 fps ──► pose ─► depth, wrists, ball ──┐
 IMU 100-200 Hz ───► orientation filter [5] ───────┼─► per-rep features ─► rules WB-01…05 ─► verdict
 EMG 1-2 kHz ──────► envelope + spectrum per burst ┘   (one rep timeline)   (each source: value + confidence)
          └──── shared clock: device timestamps + sync event + cross-correlation ────┘
```

**Time synchronisation.**
1. **Device timestamps:** each stream keeps its own clock; nothing is resampled.
2. **One deliberate event:** a clap or a single jump at the start, visible in every stream. This is the standard
   manual practice; automatic event-based alignment exists [6].
3. **Fine alignment:** cross-correlate the hip's vertical acceleration from video (second derivative of the tracked
   hip) with the thigh IMU's acceleration over the whole set.
4. **Clock drift:** re-run the correlation per rep and fit offset + drift.

Target: under one video frame (17–33 ms), checked from the fit's residual.

**Different sampling rates.** Streams aren't merged sample by sample. Each is reduced to **per-rep features** on the
shared timeline:
- **Video:** depth at the bottom.
- **IMU:** thigh angle, release time, peak hand speed, flight time.
- **EMG:** RMS envelope over about 50 ms windows; spectrum per burst.

The thigh IMU defines the rep timeline once synced, because it is denser and never occluded.

**Level of fusion** (signal / feature / decision, after [7]):

| Level | Used for | Why |
|---|---|---|
| **Signal** | Only *inside* the IMU: accelerometer + gyro → orientation [5] | Same physical quantity on one clock. Video pixels, motion and muscle voltage are different quantities, so mixing raw signals across them buys nothing |
| **Feature** | Continuous values measured twice: depth (video + thigh IMU), throw height (ball track + wrist flight time), combined by inverse-variance weighting | Two independent estimates of the same number |
| **Decision** | The verdict | Each source returns pass / fail / can't judge with a confidence, as Part 1 already does. Agree → confident. Disagree → **can't judge**, and the rep is logged for review. One source missing → the other decides. A judge can see *why* a rep was called |

## Close: the first two weeks with real sensor data

- **Days 1–3: capture.** 3–5 athletes, side and rear cameras, 2 thigh + 2 wrist IMUs, quad and shoulder EMG.
  Include deliberate shallow squats, one-handed throws and short throws: Part 1 has only five filmed shallow reps and
  no one-handed or short throws.
  Label every rep at 0.25× speed with two labellers.
- **Days 4–5: sync.** Build and validate it; residual under one frame on every recording.
- **Week 2a: thigh-IMU depth against side-on video.** Set the WB-01 threshold from both legal and illegal reps.
  Then test whether the thigh IMU makes rear-view footage judgeable. *This one result removes Part 1's biggest
  weakness.*
- **Week 2b: wrist IMUs.** Two-hand detection and flight-time throw height, checked against the reps where the video
  measured the ball.
- **Week 2c: EMG, if time allows.** Does the per-rep fatigue slope come *before* depth creep?

## What I'm unsure of

- **EMG in a sweaty, dynamic, full-body movement:** electrode movement and motion artefacts may swamp the fatigue
  signal.
- **Thigh-strap slip:** soft-tissue movement is a major IMU error source. I'd re-zero at every standing phase, but I
  haven't tested whether that is enough.
- **Thigh angle vs the judge's rule:** how a thigh angle maps to "hip crease below the top of the knee" needs
  calibrating per athlete.
- **Hand speed at release vs ball speed:** whether they are equal enough for the throw-height estimate.
- **Rep count and ball contact:** whether Women Open does 100 reps or 75 (secondary sources conflict), and whether a
  hit means the ball's top or its centre reaching the line. Part 1 assumes top; one source says centre. Both need the
  official rulebook.

## References
1. Cifrek M, Medved V, Tonković S, Ostojić S. Surface EMG based muscle fatigue evaluation in biomechanics. *Clin Biomech* 2009;24(4):327–340.
2. De Luca CJ. The use of surface electromyography in biomechanics. *J Appl Biomech* 1997;13(2):135–163. doi:10.1123/jab.13.2.135
3. Hermens HJ, Freriks B, Disselhorst-Klug C, Rau G. Development of recommendations for SEMG sensors and sensor placement procedures (SENIAM). *J Electromyogr Kinesiol* 2000;10(5):361–374. doi:10.1016/S1050-6411(00)00027-4
4. O'Reilly M, Caulfield B, Ward T, Johnston W, Doherty C. Wearable inertial sensor systems for lower limb exercise detection and evaluation: a systematic review. *Sports Med* 2018;48(5):1221–1246. doi:10.1007/s40279-018-0878-4
5. Madgwick SOH, Harrison AJL, Vaidyanathan R. Estimation of IMU and MARG orientation using a gradient descent algorithm. *IEEE ICORR* 2011.
6. Bannach D, Amft O, Lukowicz P. Automatic event-based synchronization of multimodal data streams from wearable and ambient sensors. *EuroSSC* 2009, LNCS 5741. doi:10.1007/978-3-642-04471-7_11
7. Hall DL, Llinas J. An introduction to multisensor data fusion. *Proc IEEE* 1997;85(1):6–23. doi:10.1109/5.554205
8. IMU vs optical motion capture for knee flexion in squats, sit-to-stand and walking (mean RMSD < 4–6°). *PLOS ONE*. doi:10.1371/journal.pone.0297899
9. Shifts in EMG spectral power during fatiguing dynamic contractions. *Muscle & Nerve*. PubMed 24122808
10. Validity and reliability of the inertial measurement unit for barbell velocity assessments: a systematic review. *Sensors* 2021. PubMed 33916801

Review [4], 47 studies, is the background for sections 1 and 3: most IMU exercise work so far validates measurements
and classifies exercise quality, with few user studies.
