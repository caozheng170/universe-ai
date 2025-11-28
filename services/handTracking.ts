import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { HandData } from "../types";

let handLandmarker: HandLandmarker | undefined;
let runningMode: "IMAGE" | "VIDEO" = "VIDEO";

export const initializeHandTracker = async (): Promise<void> => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 1
  });
};

export const detectHand = (video: HTMLVideoElement): HandData | null => {
  if (!handLandmarker) return null;

  const startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);

  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];

    // Calculate "Openness"
    // We measure the distance of finger tips to the wrist (landmark 0)
    // Normalized by the scale of the hand (wrist to middle finger mcp)
    
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
    const mcp = landmarks[9]; // Middle finger MCP (knuckle)

    // Rough hand size scale
    const handSize = Math.sqrt(
        Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2)
    );

    let totalTipDist = 0;
    tips.forEach(tipIdx => {
        const tip = landmarks[tipIdx];
        const dist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        totalTipDist += dist;
    });

    const avgDist = totalTipDist / 5;
    
    // Heuristic: If fingers are extended, avgDist is large relative to handSize.
    // Closed fist: avgDist is close to handSize (or less for thumb tuck).
    // Ratio ~ 1.8+ is open, ~ 0.8 is closed.
    
    const rawOpenness = (avgDist / handSize);
    
    // Map 1.0 (fist) -> 2.2 (flat hand) to 0 -> 1 range
    const clampedOpenness = Math.min(Math.max((rawOpenness - 0.8) / 1.4, 0), 1);

    return {
      isOpen: clampedOpenness > 0.5,
      openness: clampedOpenness,
      x: landmarks[9].x, // Use middle knuckle as center
      y: landmarks[9].y
    };
  }

  return null;
};