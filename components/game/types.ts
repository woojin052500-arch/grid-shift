export const COLORS = ["red", "blue", "green", "yellow", "purple"] as const;
export type Color = (typeof COLORS)[number];

export type Block = { 
  id: string; 
  color: Color; 
  type?: "normal" | "bomb" | "rainbow" 
};

export const COLOR_STYLES: Record<Color, { bg: string; shadow: string; particle: string }> = {
  red:    { bg: "bg-red-400",    shadow: "shadow-red-400/60",    particle: "#f87171" },
  blue:   { bg: "bg-blue-400",   shadow: "shadow-blue-400/60",   particle: "#60a5fa" },
  green:  { bg: "bg-green-400",  shadow: "shadow-green-400/60",  particle: "#4ade80" },
  yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-400/60", particle: "#facc15" },
  purple: { bg: "bg-purple-400", shadow: "shadow-purple-400/60", particle: "#c084fc" },
};

export const COLOR_EMOJI: Record<Color, string> = {
  red: "🟥", blue: "🟦", green: "🟩", yellow: "🟨", purple: "🟪",
};

export const COLOR_SYMBOL: Record<Color, string> = {
  red:    "▲",
  blue:   "●",
  green:  "■",
  yellow: "◆",
  purple: "★",
};

export const GRID_SIZE = 8;
export const MAX_SWIPES = 30;
export const MAX_MOVES_CAP = 45;

export interface Particle { 
  id: string; 
  x: number; 
  y: number; 
  color: string; 
  vx: number; 
  vy: number; 
}

export type TutorialTarget = { 
  highlight: { row: number; col: number }; 
  swipeDir: "left" | "right" | "up" | "down"; 
  swipeIndex: number;
};
