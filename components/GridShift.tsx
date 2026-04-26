"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getTopScores, submitScore, LeaderboardEntry } from "@/lib/supabase";

const COLORS = ["red", "blue", "green", "yellow", "purple"] as const;
type Color = (typeof COLORS)[number];

// Block type with unique ID for layout animations
type Block = {
  id: string;
  color: Color;
  type?: 'normal' | 'bomb' | 'rainbow';
};

const COLOR_STYLES: Record<Color, { bg: string; shadow: string; particle: string }> = {
  red:    { bg: "bg-red-400",    shadow: "shadow-red-400/60",    particle: "#f87171" },
  blue:   { bg: "bg-blue-400",   shadow: "shadow-blue-400/60",   particle: "#60a5fa" },
  green:  { bg: "bg-green-400",  shadow: "shadow-green-400/60",  particle: "#4ade80" },
  yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-400/60", particle: "#facc15" },
  purple: { bg: "bg-purple-400", shadow: "shadow-purple-400/60", particle: "#c084fc" },
};

const GRID_SIZE = 8;
const MAX_SWIPES = 20;

// Generate unique IDs for blocks
function genId() {
  return Math.random().toString(36).substr(2, 9) + Date.now();
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function getCountryCode(): string {
  try {
    const locale = navigator.language || "en-US";
    const parts = locale.split("-");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "US";
  } catch {
    return "KR";
  }
}

function createRandomGrid(): Block[][] {
  const grid: Block[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null) as unknown as Block[]
  );

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let block: Block;
      do {
        block = {
          id: genId(),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          type: 'normal',
        };
      } while (createsImmediateMatch(grid, r, c, block));
      grid[r][c] = block;
    }
  }

  return grid;
}

function createsImmediateMatch(grid: Block[][], r: number, c: number, block: Block): boolean {
  const isMatchable = (cell: Block | null) =>
    !!cell && (cell.type === 'normal' || cell.type === 'rainbow' || cell.type === 'bomb');

  const normalColors = (cells: Array<Block | null>) =>
    cells.filter((cell): cell is Block => !!cell && cell.type === 'normal').map((cell) => cell.color);

  const checkSquare = (row: number, col: number) => {
    const cells = [
      row === r && col === c ? block : grid[row][col],
      row === r && col + 1 === c ? block : grid[row][col + 1],
      row + 1 === r && col === c ? block : grid[row + 1][col],
      row + 1 === r && col + 1 === c ? block : grid[row + 1][col + 1],
    ];

    if (cells.some((cell) => !cell)) return false;

    const normals = normalColors(cells);
    if (normals.length === 0) return false;
    const targetColor = normals[0];
    if (normals.some((color) => color !== targetColor)) return false;

    return cells.every((cell) => cell && isMatchable(cell));
  };

  if (r > 0 && c > 0 && checkSquare(r - 1, c - 1)) return true;
  if (r > 0 && c < GRID_SIZE - 1 && checkSquare(r - 1, c)) return true;
  if (r < GRID_SIZE - 1 && c > 0 && checkSquare(r, c - 1)) return true;
  if (r < GRID_SIZE - 1 && c < GRID_SIZE - 1 && checkSquare(r, c)) return true;

  return false;
}

function shiftRow(grid: Block[][], rowIdx: number, dir: number): Block[][] {
  const newGrid = grid.map((row) => [...row]);
  const row = newGrid[rowIdx];
  if (dir === 1) {
    const last = row.pop()!;
    row.unshift(last);
  } else {
    const first = row.shift()!;
    row.push(first);
  }
  newGrid[rowIdx] = row;
  return newGrid;
}

function shiftCol(grid: Block[][], colIdx: number, dir: number): Block[][] {
  const newGrid = grid.map((row) => [...row]);
  const col = newGrid.map((row) => row[colIdx]);
  if (dir === 1) {
    const last = col.pop()!;
    col.unshift(last);
  } else {
    const first = col.shift()!;
    col.push(first);
  }
  col.forEach((val, i) => { newGrid[i][colIdx] = val; });
  return newGrid;
}

function findBlasts(grid: Block[][]): Set<string> {
  const toBlast = new Set<string>();

  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const cells = [
        grid[r][c],
        grid[r][c + 1],
        grid[r + 1][c],
        grid[r + 1][c + 1],
      ];

      if (cells.some((cell) => !cell)) continue;

      const normalBlocks = cells.filter(
        (cell): cell is Block => cell?.type === 'normal'
      );
      if (normalBlocks.length === 0) continue;

      const targetColor = normalBlocks[0].color;
      if (normalBlocks.some((cell) => cell.color !== targetColor)) continue;

      const validMatch = cells.every(
        (cell) =>
          cell?.type === 'normal' ||
          cell?.type === 'rainbow' ||
          cell?.type === 'bomb'
      );
      if (!validMatch) continue;

      const coords = [
        [r, c],
        [r, c + 1],
        [r + 1, c],
        [r + 1, c + 1],
      ];

      coords.forEach(([rr, cc]) => toBlast.add(`${rr},${cc}`));

      cells.forEach((cell, idx) => {
        if (cell?.type === 'bomb') {
          const [br, bc] = coords[idx];
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = br + dr;
              const nc = bc + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                toBlast.add(`${nr},${nc}`);
              }
            }
          }
        }
      });
    }
  }

  return toBlast;
}

type NullableGrid = (Block | null)[][];

function removeBlasted(grid: Block[][], blasted: Set<string>): NullableGrid {
  return grid.map((row, r) =>
    row.map((cell, c) => (blasted.has(`${r},${c}`) ? null : cell))
  );
}

function applyGravity(grid: NullableGrid, currentCombo: number): Block[][] {
  const newGrid: Block[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
  for (let c = 0; c < GRID_SIZE; c++) {
    const col: Block[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r][c] !== null) col.push(grid[r][c] as Block);
    }
    while (col.length < GRID_SIZE) {
      const specialChance = currentCombo >= 3 ? 0.08 + Math.min(currentCombo * 0.02, 0.12) : 0;
      const isSpecial = Math.random() < specialChance;
      let type: 'normal' | 'bomb' | 'rainbow' = 'normal';
      if (isSpecial) {
        type = Math.random() < 0.4 ? 'bomb' : 'rainbow';
      }
      col.unshift({
        id: genId(),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        type,
      });
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      newGrid[r][c] = col[r];
    }
  }
  return newGrid;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 40, opacity: 0 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <h2 className="text-white text-2xl font-black tracking-tight mb-2">How to Play 🎮</h2>
          <p className="text-gray-400 text-sm">Master the Grid Shift!</p>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl">
            <div className="text-3xl">👆</div>
            <p className="text-sm text-gray-300"><span className="text-white font-bold">Swipe</span> rows or columns to shift the entire line.</p>
          </div>
            <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl">
            <div className="text-3xl">🧊</div>
            <p className="text-sm text-gray-300">Match <span className="text-yellow-400 font-bold">2×2 blocks</span> of the same color to clear them.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl">
            <div className="text-3xl">💣</div>
            <p className="text-sm text-gray-300"><span className="text-red-400 font-bold">Bomb blocks</span> are bonus pieces that only work when they are included in a 2×2 match.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl">
            <div className="text-3xl">🌈</div>
            <p className="text-sm text-gray-300"><span className="text-purple-400 font-bold">Rainbow blocks</span> can substitute for any color in a 2×2 match.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl">
            <div className="text-3xl">✨</div>
            <p className="text-sm text-gray-300">Special blocks appear only after a combo, so focus on easy 2×2 matches first.</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-sm tracking-wider uppercase bg-blue-500 text-white hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/30"
        >
          Let's Go!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function LeaderboardModal({ onClose, entries, isLoading }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">🏆 Global Board</h2>
            <p className="text-gray-500 text-xs font-mono mt-0.5">TOP 10 · ALL TIME</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full"
            />
          </div>
        ) : entries?.length === 0 ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">
            No scores yet. Be the first! 🚀
          </div>
        ) : (
          <div className="space-y-2">
            {entries?.map((entry: any, idx: number) => {
              const rankIcons = ["🥇", "🥈", "🥉"];
              const rankLabel = idx < 3 ? rankIcons[idx] : `#${idx + 1}`;
              const isFirst = idx === 0;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                    isFirst ? "bg-yellow-400/10 border border-yellow-400/30" : "bg-gray-800/60"
                  }`}
                >
                  <span className={`text-lg w-8 text-center ${isFirst ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-gray-500"}`}>
                    {rankLabel}
                  </span>
                  <span className="text-lg">{countryFlag(entry.country_code)}</span>
                  <span className="flex-1 text-white font-bold text-sm truncate">{entry.player_name}</span>
                  <span className={`font-black tabular-nums text-sm ${isFirst ? "text-yellow-400" : "text-gray-300"}`}>
                    {entry.score.toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function GameOverModal({ score, onSubmit, onClose, onViewLeaderboard }: any) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || isSubmitting || submitted) return;
    setIsSubmitting(true);
    await onSubmit(name.trim());
    setIsSubmitting(false);
    setSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 60, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 240 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="text-5xl mb-3"
          >
            {score > 500 ? "🔥" : score > 200 ? "⭐" : "💀"}
          </motion.div>
          <h2 className="text-white text-2xl font-black tracking-tight">Game Over</h2>
          <p className="text-gray-500 text-sm font-mono mt-1">Final Score</p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-yellow-400 text-4xl font-black tabular-nums mt-1"
          >
            {score.toLocaleString()}
          </motion.p>
        </div>

        {!submitted ? (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter your name..."
                maxLength={12}
                className="w-full bg-gray-800 text-white font-bold text-center rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-yellow-400/60 transition-colors placeholder-gray-600 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-mono">
                {name.length}/12
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting}
              className="w-full py-3 rounded-xl font-black text-sm tracking-wider uppercase bg-yellow-400 text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full"
                  />
                  Submitting...
                </span>
              ) : (
                "🚀 Submit Score"
              )}
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2 space-y-1"
          >
            <p className="text-green-400 font-black text-lg">Saved! ✅</p>
            <p className="text-gray-500 text-sm">You&apos;re on the global board!</p>
          </motion.div>
        )}

        <div className="flex gap-2 mt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onViewLeaderboard}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors"
          >
            🏆 Leaderboard
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors"
          >
            ↺ Play Again
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function GridShift() {
  const [grid, setGrid] = useState<Block[][]>(createRandomGrid);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [blastingCells, setBlastingCells] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [scorePopups, setScorePopups] = useState<{ id: string; value: number; x: number; y: number }[]>([]);
  const [movesLeft, setMovesLeft] = useState(MAX_SWIPES);
  
  const [showGameOver, setShowGameOver] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  
  const [feverMode, setFeverMode] = useState(false);
  const [feverTurns, setFeverTurns] = useState(0);
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null);

  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);

  const shakeControls = useAnimation();

  const playSound = useCallback((type: 'blast' | 'combo', comboLevel?: number) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'blast') {
      // Bang sound: short burst
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'combo' && comboLevel !== undefined) {
      // Musical notes: C4, D4, E4, F4, G4, A4, B4, C5
      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      const freq = notes[Math.min(comboLevel - 1, notes.length - 1)];
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  }, []);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameOverTriggered = useRef(false);
  const adRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("gridShift_tutorial");
    if (hasSeenTutorial) setShowTutorial(false);

    // Kakao AdFit
    if (!adRef.current || adRef.current.childElementCount > 0) return;

    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", "DAN-6sr6GmPDNHmT5BR1");
    ins.setAttribute("data-ad-width", "320");
    ins.setAttribute("data-ad-height", "50");
    adRef.current.appendChild(ins);

    // 스크립트가 이미 로드된 경우 → load() 직접 호출
    if ((window as any).kakaoAdFit) {
      (window as any).kakaoAdFit.load();
      return;
    }

    // 최초 로드
    const script = document.createElement("script");
    script.src = "//t1.kakaocdn.net/kas/static/ba.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const closeTutorial = () => {
    localStorage.setItem("gridShift_tutorial", "true");
    setShowTutorial(false);
  };

  const fetchLeaderboard = useCallback(async () => {
    setIsLoadingBoard(true);
    const entries = await getTopScores();
    setLeaderboardEntries(entries);
    setIsLoadingBoard(false);
  }, []);

  const handleOpenLeaderboard = useCallback(async () => {
    setShowLeaderboard(true);
    await fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSubmitScore = useCallback(
    async (playerName: string) => {
      const countryCode = getCountryCode();
      const success = await submitScore(playerName, score, countryCode);
      if (success) await fetchLeaderboard();
    },
    [score, fetchLeaderboard]
  );

  // 1. 상태에 의존하지 않는 애니메이션 함수들 우선 선언
  const triggerShake = useCallback(
    async (intensity: number) => {
      const amp = Math.min(intensity * 5, 25); // Increased intensity
      await shakeControls.start({
        x: [0, -amp, amp, -amp, amp, 0],
        y: [0, amp, -amp, amp, -amp, 0],
        transition: { duration: 0.4, ease: "easeInOut" },
      });
    },
    [shakeControls]
  );

  const spawnParticles = useCallback((cellKeys: string[], currentGrid: Block[][]) => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const cellSize = boardRect.width / GRID_SIZE;
    const newParticles: Particle[] = [];
    cellKeys.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const block = currentGrid[r]?.[c];
      if (!block) return;
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      for (let i = 0; i < 24; i++) { // Double the particles
        const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.5;
        const speed = 80 + Math.random() * 120; // Increase speed for farther travel
        newParticles.push({
          id: `${key}-${i}-${Date.now()}`,
          x: cx, y: cy,
          color: COLOR_STYLES[block.color].particle,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }
    });
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 900);
  }, []);

  // 2. 다른 함수를 래핑하지 않는 독립적인 상태 변경 함수 선언 (가장 핵심적인 TDZ 방지)
  const handleDragStart = useCallback(
    (x: number, y: number, row: number, col: number) => {
      if (isAnimating || showGameOver || showTutorial) return;
      dragStart.current = { x, y, row, col };
    },
    [isAnimating, showGameOver, showTutorial]
  );

  // 3. spawnParticles와 triggerShake를 사용하는 로직
  const runBlastCycle = useCallback(
    async (currentGrid: Block[][], currentCombo: number): Promise<number> => {
      const blasted = findBlasts(currentGrid);
      if (blasted.size === 0) {
        setCombo(0); // Reset combo if no match
        setFeverMode(false);
        setIsAnimating(false);
        return 0; // No match
      }

  // Update fever mode
      const shouldStartFever = currentCombo >= 4 && !feverMode; // 5th combo starts fever
      if (shouldStartFever) {
        setFeverMode(true);
        setFeverTurns(3); // 3 turns of fever
        // Placeholder for BGM control
        console.log('Start fever BGM');
      }

      if (feverMode) {
        setFeverTurns(prev => prev - 1);
        if (feverTurns <= 1) {
          setFeverMode(false);
          console.log('Stop fever BGM');
        }
      }

      // Add +2 bonus moves only on the first match of the current swipe
      let bonusMoves = 0;
      if (currentCombo === 0) {
        setMovesLeft((prev) => prev + 2);
        bonusMoves = 2;
      }

      spawnParticles([...blasted], currentGrid);
      setBlastingCells(blasted);
      playSound('blast');

      let earnedScore = blasted.size * 10 * (currentCombo + 1);
      if (feverMode) earnedScore *= 2; // Double score in fever mode
      setScore((prev) => prev + earnedScore);

      // Slow motion for high scores
      if (earnedScore > 200) {
        await new Promise((res) => setTimeout(res, 150)); // Longer pause for bigger scores
      } else if (earnedScore > 100) {
        await new Promise((res) => setTimeout(res, 100));
      }

      if (boardRef.current) {
        const boardRect = boardRef.current.getBoundingClientRect();
        const cellSize = boardRect.width / GRID_SIZE;
        const firstCell = [...blasted][0].split(",").map(Number);
        const popupId = `popup-${Date.now()}-${Math.random()}`;
        
        setScorePopups((prev) => [
          ...prev,
          { id: popupId, value: earnedScore, x: firstCell[1] * cellSize + cellSize / 2, y: firstCell[0] * cellSize },
        ]);
        
        setTimeout(() => {
          setScorePopups((prev) => prev.filter((p) => p.id !== popupId));
        }, 800);
      }

      if (currentCombo >= 2) triggerShake(currentCombo);

      await new Promise((res) => setTimeout(res, 350));
      setBlastingCells(new Set());

      const afterRemove = removeBlasted(currentGrid, blasted);
      const afterGravity = applyGravity(afterRemove, currentCombo);
      setGrid(afterGravity);

      await new Promise((res) => setTimeout(res, 350)); 
      
      // Play combo sound if combo will increase
      if (currentCombo + 1 > 0) playSound('combo', currentCombo + 1);
      
      const nextBonusMoves = await runBlastCycle(afterGravity, currentCombo + 1);
      return bonusMoves + nextBonusMoves;
    },
    [spawnParticles, triggerShake]
  );

  // 4. runBlastCycle을 사용하는 메인 로직
  const handleDragEnd = useCallback(
    async (endX: number, endY: number) => {
      if (!dragStart.current || isAnimating || showGameOver || showTutorial) return;
      const { x, y, row, col } = dragStart.current;
      dragStart.current = null;

      const deltaX = endX - x;
      const deltaY = endY - y;
      const THRESHOLD = 10;

      if (Math.abs(deltaX) < THRESHOLD && Math.abs(deltaY) < THRESHOLD) return;

      const newMovesLeft = movesLeft - 1;
      setMovesLeft(newMovesLeft);
      setIsAnimating(true);
      // setCombo(0); // Remove this to maintain combo across swipes

      let newGrid: Block[][];
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newGrid = shiftRow(grid, row, deltaX > 0 ? 1 : -1);
      } else {
        newGrid = shiftCol(grid, col, deltaY > 0 ? 1 : -1);
      }

      setGrid(newGrid);
      await new Promise((res) => setTimeout(res, 300)); 
      
      const bonusMovesEarned = await runBlastCycle(newGrid, 0);
      
      const finalMovesLeft = newMovesLeft + bonusMovesEarned;

      if (finalMovesLeft <= 0 && !gameOverTriggered.current) {
        gameOverTriggered.current = true;
        setShowGameOver(true);
      }
    },
    [grid, isAnimating, showGameOver, showTutorial, movesLeft, runBlastCycle]
  );

  // 5. handleDragStart와 handleDragEnd를 의존성으로 갖는 이벤트 핸들러들
  const onTouchStart = useCallback(
    (e: React.TouchEvent, row: number, col: number) => {
      const t = e.touches[0];
      handleDragStart(t.clientX, t.clientY, row, col);
    },
    [handleDragStart]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      handleDragEnd(t.clientX, t.clientY);
    },
    [handleDragEnd]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      handleDragStart(e.clientX, e.clientY, row, col);
    },
    [handleDragStart]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => handleDragEnd(e.clientX, e.clientY),
    [handleDragEnd]
  );

  const handleReset = () => {
    setGrid(createRandomGrid());
    setScore(0);
    setCombo(0);
    setFeverMode(false);
    setParticles([]);
    setBlastingCells(new Set());
    setIsAnimating(false);
    setShowGameOver(false);
    setMovesLeft(MAX_SWIPES);
    gameOverTriggered.current = false;
  };

  return (
    <motion.div className={`min-h-[100dvh] flex flex-col items-center justify-start pt-6 pb-4 select-none overflow-hidden ${feverMode ? 'bg-gradient-to-br from-red-900 via-purple-900 to-blue-900' : 'bg-gray-950'}`}>
      
      <AnimatePresence>
        {showTutorial && <TutorialModal onClose={closeTutorial} />}
      </AnimatePresence>

      <AnimatePresence>
        {showGameOver && (
          <GameOverModal
            score={score}
            onSubmit={handleSubmitScore}
            onClose={handleReset}
            onViewLeaderboard={handleOpenLeaderboard}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaderboard && (
          <LeaderboardModal
            onClose={() => setShowLeaderboard(false)}
            entries={leaderboardEntries}
            isLoading={isLoadingBoard}
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-sm px-4 mb-4 flex items-center justify-between">
        <div className="flex flex-col items-start">
          <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Score</span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={score}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-white text-3xl font-black tabular-nums"
            >
              {score.toLocaleString()}
            </motion.span>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {combo > 0 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <span className={`${combo >= 3 ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 via-purple-400 to-pink-400 animate-pulse' : 'text-yellow-400'} text-xs font-mono uppercase tracking-widest`}>Combo</span>
              <motion.span
                className={`${combo >= 3 ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 via-purple-400 to-pink-400' : 'text-yellow-400'} font-black`}
                style={{ fontSize: `${Math.min(2 + combo * 0.3, 4)}rem` }}
                animate={combo >= 3 ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                x{combo}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg hover:bg-gray-700 transition-colors"
          >
            ❓
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleOpenLeaderboard}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg hover:bg-gray-700 transition-colors"
          >
            🏆
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleReset}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            ↺
          </motion.button>
        </div>
      </div>

      <div className="w-full max-w-sm px-4 mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-xs font-mono uppercase tracking-widest">Moves</span>
          <span className="text-gray-500 text-xs font-mono tabular-nums">{movesLeft} left</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${(movesLeft / MAX_SWIPES) * 100}%` }}
            transition={{ duration: 0.3 }}
            className={`h-full rounded-full transition-colors ${
              movesLeft > 12 ? "bg-green-400" : movesLeft > 6 ? "bg-yellow-400" : "bg-red-400"
            }`}
          />
        </div>
      </div>

      <motion.div
        animate={shakeControls}
        className="w-[92vw] max-w-[420px] aspect-square"
      >
        <div
          ref={boardRef}
          className="relative w-full h-full bg-gray-900 rounded-2xl p-2 shadow-2xl touch-none"
          onMouseUp={onMouseUp}
          onMouseLeave={() => { dragStart.current = null; }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30">
            <AnimatePresence>
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
                  animate={{ x: p.x + p.vx, y: p.y + p.vy, scale: 0, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{ backgroundColor: p.color, left: 0, top: 0, transform: "translate(-50%, -50%)" }}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="absolute inset-0 pointer-events-none z-40">
            <AnimatePresence>
              {scorePopups.map((popup) => (
                <motion.div
                  key={popup.id}
                  initial={{ x: popup.x, y: popup.y, opacity: 1, scale: 1 }}
                  animate={{ y: popup.y - 40, opacity: 0, scale: 1.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="absolute text-white font-black text-sm pointer-events-none"
                  style={{ left: 0, top: 0, transform: "translate(-50%, -50%)" }}
                >
                  +{popup.value}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div
            className="w-full h-full grid gap-1 relative"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((block, c) => {
                const cellKey = `${r},${c}`;
                const isBlasting = blastingCells.has(cellKey);
                const style = COLOR_STYLES[block.color];

                const blockEmoji = block.type === 'bomb' ? '💣' : block.type === 'rainbow' ? '🌈' : '';
                return (
                  <motion.div
                    layout
                    key={block.id}
                    initial={false}
                    animate={
                      isBlasting
                        ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={{
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      scale: isBlasting ? { duration: 0.3, ease: "easeIn" } : { duration: 0.15 },
                      opacity: isBlasting ? { duration: 0.3, ease: "easeIn" } : { duration: 0.15 }
                    }}
                    className={`rounded-md cursor-pointer ${style.bg} shadow-md ${style.shadow} ${isBlasting ? "z-10" : ""} flex items-center justify-center text-white font-black text-lg`}
                    onMouseDown={(e) => onMouseDown(e, r, c)}
                    onTouchStart={(e) => onTouchStart(e, r, c)}
                    onTouchEnd={onTouchEnd}
                  >
                    {blockEmoji}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>

      {/* 게임 그리드 motion.div 바로 아래 */}
      <div ref={adRef} className="mt-4 flex justify-center min-h-[50px]" />

      <p className="mt-4 text-gray-700 text-xs font-mono tracking-widest uppercase">
        swipe to shift · match 2×2 to blast
      </p>
    </motion.div>
  );
}
