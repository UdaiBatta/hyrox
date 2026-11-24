"""Stage 2: MediaPipe Pose Landmarker (heavy model, VIDEO mode) on every frame.

Stores image keypoints in pixels (x, y, visibility) so angles aren't distorted by the frame's
aspect ratio, and world landmarks (metres, hip-centred) for the 3D viewer.
"""
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions

MODEL = Path(__file__).resolve().parents[2] / "models" / "pose_landmarker_heavy.task"


def track(video, log=print):
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    opts = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO, num_poses=1)
    frames = []
    with vision.PoseLandmarker.create_from_options(opts) as landmarker:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            i = len(frames)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            r = landmarker.detect_for_video(img, round(i * 1000 / fps))
            kp = world = None
            if r.pose_landmarks:
                kp = [[round(p.x * w, 1), round(p.y * h, 1), round(p.visibility or 0, 3)] for p in r.pose_landmarks[0]]
                world = [[round(p.x, 4), round(p.y, 4), round(p.z, 4)] for p in r.pose_world_landmarks[0]]
            frames.append({"i": i, "t": round(i / fps, 4), "kp": kp, "world": world})
            if i % 100 == 0:
                log(f"pose: frame {i}")
    cap.release()
    return {"fps": fps, "width": w, "height": h, "n_frames": len(frames), "frames": frames}
