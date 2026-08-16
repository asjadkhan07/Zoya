export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "alert" | "vision";

export type GestureType = 
  | "none" 
  | "open_palm" 
  | "closed_fist" 
  | "point" 
  | "pinch" 
  | "two_hands" 
  | "swipe_left" 
  | "swipe_right";

export interface UserTrackingData {
  present: boolean;
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (top to bottom)
  distanceMeters: number; // e.g. 0.5 to 3.0
  headTiltX: number;
  headTiltY: number;
  emotion: "neutral" | "focused" | "surprised" | "happy";
  lastDetectedTimestamp: number;
}

export interface HandTrackingData {
  detected: boolean;
  gesture: GestureType;
  x: number; // normalized -1 to 1
  y: number; // normalized -1 to 1
  depthZ: number; // 0.1 to 2.0 (pinch or depth scale)
  landmarks?: { x: number; y: number; z: number }[];
}

export interface MemoryItem {
  id: string;
  category: "note" | "reminder" | "preference" | "command";
  title: string;
  content: string;
  time: string;
  timestamp: number;
}

export interface CompanionState {
  paired: boolean;
  pairingCode: string;
  deviceName?: string;
  lastSeen?: number;
}

export interface VisionAnalysisResult {
  text: string;
  audio?: string | null;
  timestamp: number;
}
