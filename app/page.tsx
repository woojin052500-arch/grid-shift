"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getTopScores, submitScore, LeaderboardEntry } from "@/lib/supabase";

const COLORS = ["red", "blue", "green", "yellow", "purple"] as const;
type Color = (typeof COLORS)[number];

const COLOR_STYLES: Record<Color, { bg: string; shadow: string; particle: string }> = {
  red:    { bg: "bg-red-400",    shadow: "shadow-red-400/60",    particle: "#f87171" },
  blue:   { bg: "bg-blue-400",   shadow: "shadow-blue-400/60",   particle: "#60a5fa" },
  green:  { bg: "bg-green-400",  shadow: "shadow-green-400/60",  particle: "#4ade80" },
  yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-400/60", particle: "#facc15" },
  purple: { bg: "bg-purple-400", shadow: "shadow-purple-400/60", particle: "#c084fc" },
};

const GRID_SIZE = 8;
const MAX_SWIPES = 20;

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

function createRandomGrid(): Color[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => COLORS[Math.floor(Math.random() * COLORS.length)])
  );
}

function shiftRow(grid: Color[][], rowIdx: number, dir: number): Color[][] {
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

function shiftCol(grid: Color[][], colIdx: number, dir: number): Color[][] {
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

function find2x2Blasts(grid: Color[][]): Set<string> {
  const toBlast = new Set<string>();
  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const color = grid[r][c];
      if (
        color &&
        grid[r][c + 1] === color &&
        grid[r + 1][c] === color &&
        grid[r + 1][c + 1] === color
      ) {
        toBlast.add(`${r},${c}`);
        toBlast.add(`${r},${c + 1}`);
        toBlast.add(`${r + 1},${c}`);
        toBlast.add(`${r + 1},${c + 1}`);
      }
    }
  }
  return toBlast;
}

type NullableGrid = (Color | null)[][];

function removeBlasted(grid: Color[][], blasted: Set<string>): NullableGrid {
  return grid.map((row, r) =>
    row.map((cell, c) => (blasted.has(`${r},${c}`) ? null : cell))
  );
}

function applyGravity(grid: NullableGrid): Color[][] {
  const newGrid: Color[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
  for (let c = 0; c < GRID_SIZE; c++) {
    const col: Color[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r][c] !== null) col.push(grid[r][c] as Color);
    }
    while (col.length < GRID_SIZE) {
      col.unshift(COLORS[Math.floor(Math.random() * COLORS.length)]);
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

function LeaderboardModal({
  onClose,
  entries,
  isLoading,
}: {
  onClose: () => void;
  entries: LeaderboardEntry[];
  isLoading: boolean;
}) {
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
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">
            No scores yet. Be the first! 🚀
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => {
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

function GameOverModal({
  score,
  onSubmit,
  onClose,
  onViewLeaderboard,
}: {
  score: number;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
  onViewLeaderboard: () => void;
}) {
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
  const [grid, setGrid] = useState<Color[][]>(createRandomGrid);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [blastingCells, setBlastingCells] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [scorePopups, setScorePopups] = useState<{ id: string; value: number; x: number; y: number }[]>([]);
  const [movesLeft, setMovesLeft] = useState(MAX_SWIPES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);

  const shakeControls = useAnimation();
  const dragStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameOverTriggered = useRef(false);

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

  const triggerShake = useCallback(
    async (intensity: number) => {
      const amp = Math.min(intensity * 3, 15);
      await shakeControls.start({
        x: [0, -amp, amp, -amp, amp, 0],
        y: [0, amp, -amp, amp, -amp, 0],
        transition: { duration: 0.4, ease: "easeInOut" },
      });
    },
    [shakeControls]
  );

  const spawnParticles = useCallback((cellKeys: string[], currentGrid: Color[][]) => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const cellSize = boardRect.width / GRID_SIZE;
    const newParticles: Particle[] = [];
    cellKeys.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const color = currentGrid[r]?.[c];
      if (!color) return;
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        const speed = 40 + Math.random() * 60;
        newParticles.push({
          id: `${key}-${i}-${Date.now()}`,
          x: cx, y: cy,
          color: COLOR_STYLES[color].particle,
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

  const runBlastCycle = useCallback(
    async (currentGrid: Color[][], currentCombo: number) => {
      const blasted = find2x2Blasts(currentGrid);
      if (blasted.size === 0) {
        setCombo(currentCombo);
        setIsAnimating(false);
        return;
      }

      spawnParticles([...blasted], currentGrid);
      setBlastingCells(blasted);

      const earnedScore = blasted.size * 10 * (currentCombo + 1);
      setScore((prev) => prev + earnedScore);

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
      const afterGravity = applyGravity(afterRemove);
      setGrid(afterGravity);

      await new Promise((res) => setTimeout(res, 300));
      runBlastCycle(afterGravity, currentCombo + 1);
    },
    [spawnParticles, triggerShake]
  );

  const handleDragStart = useCallback(
    (x: number, y: number, row: number, col: number) => {
      if (isAnimating || showGameOver) return;
      dragStart.current = { x, y, row, col };
    },
    [isAnimating, showGameOver]
  );

  const handleDragEnd = useCallback(
    async (endX: number, endY: number) => {
      if (!dragStart.current || isAnimating || showGameOver) return;
      const { x, y, row, col } = dragStart.current;
      dragStart.current = null;

      const deltaX = endX - x;
      const deltaY = endY - y;
      const THRESHOLD = 10;

      if (Math.abs(deltaX) < THRESHOLD && Math.abs(deltaY) < THRESHOLD) return;

      const newMovesLeft = movesLeft - 1;
      setMovesLeft(newMovesLeft);
      setIsAnimating(true);
      setCombo(0);

      let newGrid: Color[][];
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newGrid = shiftRow(grid, row, deltaX > 0 ? 1 : -1);
      } else {
        newGrid = shiftCol(grid, col, deltaY > 0 ? 1 : -1);
      }

      setGrid(newGrid);
      await new Promise((res) => setTimeout(res, 200));
      await runBlastCycle(newGrid, 0);

      if (newMovesLeft <= 0 && !gameOverTriggered.current) {
        gameOverTriggered.current = true;
        setShowGameOver(true);
      }
    },
    [grid, isAnimating, showGameOver, movesLeft, runBlastCycle]
  );

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
    setParticles([]);
    setBlastingCells(new Set());
    setIsAnimating(false);
    setShowGameOver(false);
    setMovesLeft(MAX_SWIPES);
    gameOverTriggered.current = false;
  };

  // ── 보드 크기: 92vw, 최대 420px ──
  const BOARD_SIZE = "min(92vw, 420px)";

  return (
    <div className="min-h-[100dvh] bg-gray-950 flex flex-col items-center justify-center select-none overflow-hidden">

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

      {/* 헤더 */}
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
              <span className="text-yellow-400 text-xs font-mono uppercase tracking-widest">Combo</span>
              <span
                className="text-yellow-400 font-black"
                style={{ fontSize: `${Math.min(2 + combo * 0.3, 4)}rem` }}
              >
                x{combo}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
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

      {/* 이동 횟수 바 */}
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

      {/* 게임 보드 */}
      <motion.div animate={shakeControls} style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
        <div
          ref={boardRef}
          className="relative bg-gray-900 rounded-2xl p-2 shadow-2xl"
          style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { dragStart.current = null; }}
        >
          {/* 파티클 레이어 */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
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

          {/* 스코어 팝업 */}
          <div className="absolute inset-0 pointer-events-none">
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

          {/* ✅ 8×8 그리드: rows + cols 모두 명시 */}
          <div
            style={{
              display: "grid",
              width: "100%",
              height: "100%",
              gap: "4px",
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
          >
            {grid.map((row, r) =>
              row.map((color, c) => {
                const cellKey = `${r},${c}`;
                const isBlasting = blastingCells.has(cellKey);
                const style = COLOR_STYLES[color];

                return (
                  <motion.div
                    key={`${r}-${c}`}
                    animate={
                      isBlasting
                        ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={
                      isBlasting
                        ? { duration: 0.3, ease: "easeIn" }
                        : { duration: 0.15 }
                    }
                    className={`rounded-md cursor-pointer ${style.bg} shadow-md ${style.shadow} ${isBlasting ? "z-10" : ""}`}
                    onMouseDown={(e) => onMouseDown(e, r, c)}
                    onTouchStart={(e) => onTouchStart(e, r, c)}
                    onTouchEnd={onTouchEnd}
                  />
                );
              })
            )}
          </div>
        </div>
      </motion.div>

      <p className="mt-4 text-gray-700 text-xs font-mono tracking-widest uppercase">
        swipe to shift · match 2×2 to blast
      </p>
    </div>
  );
}
