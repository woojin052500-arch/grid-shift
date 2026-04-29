"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { getTopScores, submitScore, LeaderboardEntry } from "@/lib/supabase";

// ─── Types & Constants ───────────────────────────────────────────────
const COLORS = ["red", "blue", "green", "yellow", "purple"] as const;
type Color = (typeof COLORS)[number];
type Block = { id: string; color: Color; type?: "normal" | "bomb" | "rainbow" };

const COLOR_STYLES: Record<Color, { bg: string; shadow: string; particle: string }> = {
  red:    { bg: "bg-red-400",    shadow: "shadow-red-400/60",    particle: "#f87171" },
  blue:   { bg: "bg-blue-400",   shadow: "shadow-blue-400/60",   particle: "#60a5fa" },
  green:  { bg: "bg-green-400",  shadow: "shadow-green-400/60",  particle: "#4ade80" },
  yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-400/60", particle: "#facc15" },
  purple: { bg: "bg-purple-400", shadow: "shadow-purple-400/60", particle: "#c084fc" },
};

const COLOR_EMOJI: Record<Color, string> = {
  red: "🟥", blue: "🟦", green: "🟩", yellow: "🟨", purple: "🟪",
};

// ✅ 색맹 접근성: 색마다 고유 기호 (모양 + 색 이중 코딩)
const COLOR_SYMBOL: Record<Color, string> = {
  red:    "▲",  // 삼각형
  blue:   "●",  // 원
  green:  "■",  // 사각형
  yellow: "◆",  // 다이아몬드
  purple: "★",  // 별
};

const GRID_SIZE = 8;
const MAX_SWIPES = 30;
const MAX_MOVES_CAP = 45;

// ─── Helpers ─────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).substr(2, 9) + Date.now(); }

function countryFlag(code: string) {
  if (!code || code.length !== 2) return "🌐";
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

function getCountryCode() {
  try { const p = (navigator.language || "en-US").split("-"); return p.length > 1 ? p[p.length - 1].toUpperCase() : "US"; }
  catch { return "KR"; }
}

function buildShareText(playerName: string, score: number, maxCombo: number) {
  const colorSeq: Color[] = ["red","blue","green","yellow","purple","purple","yellow","green","blue","red"];
  const row1 = colorSeq.slice(0, 5).map(c => COLOR_EMOJI[c]).join("");
  const row2 = colorSeq.slice(5).map(c => COLOR_EMOJI[c]).join("");
  const scoreEmoji = score > 800 ? "🔥" : score > 400 ? "⭐" : "💀";
  return [`🎮 GRID SHIFT ${scoreEmoji}`, ``, row1, row2, ``, `👤 ${playerName}`, `💯 점수: ${score.toLocaleString()}`, maxCombo > 0 ? `⚡ 최대 콤보: x${maxCombo}` : "", ``, `지금 도전해보세요!`, `https://grid-shift-iota.vercel.app`].filter(l => l !== undefined).join("\n");
}

function createsImmediateMatch(grid: Block[][], r: number, c: number, block: Block): boolean {
  const isMatchable = (cell: Block | null) => !!cell && (cell.type === "normal" || cell.type === "rainbow" || cell.type === "bomb");
  const normalColors = (cells: Array<Block | null>) => cells.filter((cell): cell is Block => !!cell && cell.type === "normal").map(cell => cell.color);
  const checkSquare = (row: number, col: number) => {
    const cells = [
      row === r && col === c ? block : grid[row]?.[col],
      row === r && col + 1 === c ? block : grid[row]?.[col + 1],
      row + 1 === r && col === c ? block : grid[row + 1]?.[col],
      row + 1 === r && col + 1 === c ? block : grid[row + 1]?.[col + 1],
    ];
    if (cells.some(cell => !cell)) return false;
    const normals = normalColors(cells);
    if (normals.length === 0) return false;
    const tc = normals[0];
    if (normals.some(color => color !== tc)) return false;
    return cells.every(cell => cell && isMatchable(cell));
  };
  if (r > 0 && c > 0 && checkSquare(r - 1, c - 1)) return true;
  if (r > 0 && c < GRID_SIZE - 1 && checkSquare(r - 1, c)) return true;
  if (r < GRID_SIZE - 1 && c > 0 && checkSquare(r, c - 1)) return true;
  if (r < GRID_SIZE - 1 && c < GRID_SIZE - 1 && checkSquare(r, c)) return true;
  return false;
}

function createRandomGrid(): Block[][] {
  const grid: Block[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null) as unknown as Block[]);
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      let block: Block;
      do { block = { id: genId(), color: COLORS[Math.floor(Math.random() * COLORS.length)], type: "normal" }; }
      while (createsImmediateMatch(grid, r, c, block));
      grid[r][c] = block;
    }
  return grid;
}

function shiftRow(grid: Block[][], rowIdx: number, dir: number): Block[][] {
  const ng = grid.map(row => [...row]);
  const row = ng[rowIdx];
  if (dir === 1) { const last = row.pop()!; row.unshift(last); }
  else { const first = row.shift()!; row.push(first); }
  ng[rowIdx] = row; return ng;
}

function shiftCol(grid: Block[][], colIdx: number, dir: number): Block[][] {
  const ng = grid.map(row => [...row]);
  const col = ng.map(row => row[colIdx]);
  if (dir === 1) { const last = col.pop()!; col.unshift(last); }
  else { const first = col.shift()!; col.push(first); }
  col.forEach((val, i) => { ng[i][colIdx] = val; });
  return ng;
}

// ─── 2×2 + 1×4 통합 매치 감지 ───────────────────────────────────────
type BlastResult = {
  squareCells: Set<string>;
  lineCells: Set<string>;
};

function findAllBlasts(grid: Block[][]): BlastResult {
  const squareCells = new Set<string>();
  const lineCells = new Set<string>();

  // 2×2 매치
  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const cells = [grid[r][c], grid[r][c+1], grid[r+1][c], grid[r+1][c+1]];
      if (cells.some(cell => !cell)) continue;
      const normals = cells.filter((cell): cell is Block => cell?.type === "normal");
      if (normals.length === 0) continue;
      const tc = normals[0].color;
      if (normals.some(cell => cell.color !== tc)) continue;
      if (!cells.every(cell => cell?.type === "normal" || cell?.type === "rainbow" || cell?.type === "bomb")) continue;
      const coords: [number, number][] = [[r,c],[r,c+1],[r+1,c],[r+1,c+1]];
      coords.forEach(([rr,cc]) => squareCells.add(`${rr},${cc}`));
      cells.forEach((cell, idx) => {
        if (cell?.type === "bomb") {
          const [br, bc] = coords[idx];
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const nr = br + dr, nc = bc + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE)
                squareCells.add(`${nr},${nc}`);
            }
        }
      });
    }
  }

  // 1×4 수평 매치
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - 4; c++) {
      const cells = [grid[r][c], grid[r][c+1], grid[r][c+2], grid[r][c+3]];
      if (cells.some(cell => !cell)) continue;
      const normals = cells.filter((cell): cell is Block => cell?.type === "normal");
      if (normals.length === 0) continue;
      const tc = normals[0].color;
      if (normals.some(cell => cell.color !== tc)) continue;
      if (!cells.every(cell => cell?.type === "normal" || cell?.type === "rainbow")) continue;
      const coords: [number, number][] = [[r,c],[r,c+1],[r,c+2],[r,c+3]];
      const allInSquare = coords.every(([rr,cc]) => squareCells.has(`${rr},${cc}`));
      if (!allInSquare) {
        coords.forEach(([rr,cc]) => { if (!squareCells.has(`${rr},${cc}`)) lineCells.add(`${rr},${cc}`); });
      }
    }
  }

  // 1×4 수직 매치
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - 4; r++) {
      const cells = [grid[r][c], grid[r+1][c], grid[r+2][c], grid[r+3][c]];
      if (cells.some(cell => !cell)) continue;
      const normals = cells.filter((cell): cell is Block => cell?.type === "normal");
      if (normals.length === 0) continue;
      const tc = normals[0].color;
      if (normals.some(cell => cell.color !== tc)) continue;
      if (!cells.every(cell => cell?.type === "normal" || cell?.type === "rainbow")) continue;
      const coords: [number, number][] = [[r,c],[r+1,c],[r+2,c],[r+3,c]];
      const allInSquare = coords.every(([rr,cc]) => squareCells.has(`${rr},${cc}`));
      if (!allInSquare) {
        coords.forEach(([rr,cc]) => { if (!squareCells.has(`${rr},${cc}`)) lineCells.add(`${rr},${cc}`); });
      }
    }
  }

  return { squareCells, lineCells };
}

function findBlastsSimple(grid: Block[][]): Set<string> {
  return findAllBlasts(grid).squareCells;
}

type TutorialTarget = { highlight: { row: number; col: number }; swipeDir: "left"|"right"|"up"|"down"; swipeIndex: number };

function findTutorialSwipeTarget(grid: Block[][]): TutorialTarget {
  for (const dir of [1, -1] as const) {
    for (let r = 0; r < GRID_SIZE; r++) {
      const blasted = findBlastsSimple(shiftRow(grid, r, dir));
      if (blasted.size > 0) {
        const [br, bc] = [...blasted][0].split(",").map(Number);
        return { highlight: { row: Math.max(0, Math.min(br, GRID_SIZE - 2)), col: Math.max(0, Math.min(bc, GRID_SIZE - 2)) }, swipeDir: dir === 1 ? "right" : "left", swipeIndex: r };
      }
    }
  }
  for (const dir of [1, -1] as const) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const blasted = findBlastsSimple(shiftCol(grid, c, dir));
      if (blasted.size > 0) {
        const [br, bc] = [...blasted][0].split(",").map(Number);
        return { highlight: { row: Math.max(0, Math.min(br, GRID_SIZE - 2)), col: Math.max(0, Math.min(bc, GRID_SIZE - 2)) }, swipeDir: dir === 1 ? "down" : "up", swipeIndex: c };
      }
    }
  }
  return { highlight: { row: 3, col: 3 }, swipeDir: "right", swipeIndex: 3 };
}

function removeBlasted(grid: Block[][], blasted: Set<string>): (Block | null)[][] {
  return grid.map((row, r) => row.map((cell, c) => blasted.has(`${r},${c}`) ? null : cell));
}

function applyGravity(grid: (Block | null)[][], currentCombo: number): Block[][] {
  const ng: Block[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (let c = 0; c < GRID_SIZE; c++) {
    const col: Block[] = [];
    for (let r = 0; r < GRID_SIZE; r++) { if (grid[r][c] !== null) col.push(grid[r][c] as Block); }
    while (col.length < GRID_SIZE) {
      const specialChance = currentCombo >= 3 ? 0.08 + Math.min(currentCombo * 0.02, 0.12) : 0;
      const isSpecial = Math.random() < specialChance;
      let type: "normal" | "bomb" | "rainbow" = "normal";
      if (isSpecial) type = Math.random() < 0.4 ? "bomb" : "rainbow";
      col.unshift({ id: genId(), color: COLORS[Math.floor(Math.random() * COLORS.length)], type });
    }
    for (let r = 0; r < GRID_SIZE; r++) ng[r][c] = col[r];
  }
  return ng;
}

interface Particle { id: string; x: number; y: number; color: string; vx: number; vy: number; }

// ─── HOME ────────────────────────────────────────────────────────────
function FloatingBlock({ color, x, y, size, delay, duration }: { color: string; x: number; y: number; size: number; delay: number; duration: number }) {
  return (
    <motion.div className="absolute rounded-xl"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: `linear-gradient(135deg,${color}99,${color}44)`, boxShadow: `0 4px 16px ${color}33` }}
      animate={{ y: [0, -18, 0], rotate: [0, 8, -8, 0], opacity: [0.25, 0.45, 0.25] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

function HomeScreen({ onStart }: { onStart: (name: string) => void }) {
  const [nickname, setNickname] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState("");

  const floatingBlocks = [
    { color: "#f87171", x: 4, y: 8, size: 44, delay: 0, duration: 3.2 },
    { color: "#60a5fa", x: 84, y: 7, size: 34, delay: 0.5, duration: 2.8 },
    { color: "#4ade80", x: 8, y: 58, size: 30, delay: 1.2, duration: 3.5 },
    { color: "#facc15", x: 80, y: 54, size: 38, delay: 0.8, duration: 2.6 },
    { color: "#c084fc", x: 48, y: 4, size: 26, delay: 0.3, duration: 3.0 },
    { color: "#f87171", x: 74, y: 78, size: 32, delay: 1.5, duration: 3.3 },
    { color: "#60a5fa", x: 14, y: 83, size: 24, delay: 0.9, duration: 2.9 },
    { color: "#4ade80", x: 90, y: 33, size: 28, delay: 0.4, duration: 3.1 },
  ];

  const handleStart = () => {
    if (!nickname.trim()) { setError("닉네임을 입력해주세요 😊"); return; }
    if (nickname.trim().length < 2) { setError("2글자 이상 입력해주세요"); return; }
    onStart(nickname.trim());
  };

  const openLeaderboard = async () => {
    setShowBoard(true); setLoadingBoard(true);
    const data = await getTopScores();
    setLeaderboard(data); setLoadingBoard(false);
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: "linear-gradient(160deg,#1a3a8f 0%,#1565c0 40%,#0d47a1 70%,#0a2d6b 100%)" }}>
      {[...Array(22)].map((_, i) => (
        <motion.div key={i} className="absolute rounded-full bg-white"
          style={{ width: Math.random() * 3 + 1, height: Math.random() * 3 + 1, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ opacity: [0.15, 0.9, 0.15] }} transition={{ duration: 1.5 + Math.random() * 2, delay: Math.random() * 4, repeat: Infinity }} />
      ))}
      {floatingBlocks.map((b, i) => <FloatingBlock key={i} {...b} />)}

      <motion.div className="flex flex-col items-center mb-8 mt-6 relative z-10"
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 170, damping: 18 }}>
        <motion.div className="text-4xl mb-1" animate={{ rotate: [-6, 6, -6], y: [0, -5, 0] }} transition={{ duration: 2.6, repeat: Infinity }}>👑</motion.div>
        <div className="flex" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.55))" }}>
          {(["G","R","I","D"] as const).map((letter, i) => (
            <motion.span key={i} className="font-black leading-none select-none"
              style={{ fontSize: "clamp(3.5rem,16vw,5.5rem)", color: ["#FF6B35","#FFD700","#FF6B35","#3DD6F5"][i], WebkitTextStroke: "3px rgba(0,0,0,0.28)", textShadow: "0 4px 0 rgba(0,0,0,0.28),0 8px 24px rgba(0,0,0,0.18)", fontFamily: "'Arial Black','Impact',sans-serif" }}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 * i, type: "spring", stiffness: 200 }}>{letter}</motion.span>
          ))}
        </div>
        <div className="flex -mt-2" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
          {(["S","H","I","F","T"] as const).map((letter, i) => (
            <motion.span key={i} className="font-black leading-none select-none"
              style={{ fontSize: "clamp(2.2rem,10vw,3.5rem)", color: "#3DD6F5", WebkitTextStroke: "2px rgba(0,0,60,0.35)", textShadow: "0 3px 0 rgba(0,0,60,0.28)", fontFamily: "'Arial Black','Impact',sans-serif" }}
              initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.42 + 0.08 * i, type: "spring", stiffness: 200 }}>{letter}</motion.span>
          ))}
        </div>
        <motion.p className="text-blue-200/60 text-xs font-bold tracking-[0.35em] uppercase mt-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>PUZZLE · MATCH · BLAST</motion.p>
      </motion.div>

      <motion.div className="w-full max-w-xs px-5 mb-4 relative z-10"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-xl">
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-2 text-center">닉네임 입력</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">👤</span>
            <input type="text" value={nickname}
              onChange={(e) => { setNickname(e.target.value.slice(0, 12)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="닉네임을 입력하세요..." maxLength={12}
              className="w-full bg-white/15 text-white font-bold text-center rounded-xl pl-10 pr-10 py-3 outline-none border border-white/20 focus:border-yellow-300/70 transition-all placeholder-blue-200/50 text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/50 text-xs font-mono pointer-events-none">{nickname.length}/12</span>
          </div>
          <AnimatePresence>
            {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-300 text-xs text-center mt-2 font-bold">{error}</motion.p>}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div className="w-full max-w-xs px-5 flex flex-col gap-3 relative z-10"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} onClick={handleStart}
          className="relative w-full py-4 rounded-2xl font-black text-lg tracking-wide text-white overflow-hidden"
          style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 6px 0 #92400e,0 10px 24px rgba(245,158,11,0.4)" }}>
          <span className="relative z-10 flex items-center justify-center gap-2"><span className="text-xl">🎮</span> 게임 시작</span>
          <motion.div className="absolute inset-0 bg-white/25 pointer-events-none"
            animate={{ x: ["-120%","220%"] }} transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }} style={{ skewX: "-15deg" }} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} onClick={openLeaderboard}
          className="w-full py-4 rounded-2xl font-black text-lg tracking-wide text-white"
          style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 6px 0 #065f46,0 10px 24px rgba(16,185,129,0.35)" }}>
          <span className="flex items-center justify-center gap-2"><span className="text-xl">🏆</span> 리더보드</span>
        </motion.button>
      </motion.div>

      <motion.p className="mt-8 text-blue-200/35 text-xs font-mono tracking-widest uppercase relative z-10"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>swipe · match · blast</motion.p>

      <AnimatePresence>
        {showBoard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
            onClick={() => setShowBoard(false)}>
            <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 260 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10"
              style={{ background: "linear-gradient(160deg,#1a3a8f,#0a2d6b)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white text-xl font-black">🏆 Global Board</h2>
                  <p className="text-blue-300/55 text-xs font-mono mt-0.5">TOP 10 · ALL TIME</p>
                </div>
                <button onClick={() => setShowBoard(false)} className="w-8 h-8 rounded-full bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm transition-colors">✕</button>
              </div>
              {loadingBoard ? (
                <div className="flex justify-center py-12">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-blue-300/40 font-mono text-sm">첫 번째 도전자가 되어보세요! 🚀</div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${idx === 0 ? "bg-yellow-400/12 border border-yellow-400/30" : "bg-white/5"}`}>
                      <span className={`text-lg w-8 text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-white/40"}`}>
                        {idx < 3 ? ["🥇","🥈","🥉"][idx] : `#${idx + 1}`}
                      </span>
                      <span className="text-lg">{countryFlag(entry.country_code)}</span>
                      <span className="flex-1 text-white font-bold text-sm truncate">{entry.player_name}</span>
                      <span className={`font-black tabular-nums text-sm ${idx === 0 ? "text-yellow-400" : "text-white/80"}`}>{entry.score.toLocaleString()}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TUTORIAL MODAL ───────────────────────────────────────────────────
function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <h2 className="text-white text-2xl font-black tracking-tight mb-1">How to Play 🎮</h2>
          <p className="text-gray-400 text-sm">Master the Grid Shift!</p>
        </div>
        <div className="space-y-2.5 mb-6">
          {([
            ["👆", "행 또는 열 전체를 스와이프해서 블록을 이동시키세요."],
            ["🟩🟩\n🟩🟩", "같은 색 2×2 매치 → 터짐! +2 무브 & 고득점 (셀당 10pt)"],
            ["🟦🟦🟦🟦", "같은 색 1×4 매치 → 터짐! +1 무브 & 저득점 (셀당 5pt, 2×2 우선)"],
            ["💣", "폭탄 블록은 2×2 매치 시 주변까지 폭발!"],
            ["🌈", "무지개 블록은 어떤 색과도 매치됩니다."],
            ["👁", "색맹 모드 ON → 블록마다 고유 기호 (▲●■◆★) 표시"],
            ["⚡", "콤보도 무브 +1! 단 최대 " + MAX_MOVES_CAP + " 무브 상한"],
          ] as [string, string][]).map(([icon, text], i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-800/50 p-3 rounded-xl">
              <span className="text-xl mt-0.5 whitespace-pre leading-tight flex-shrink-0">{icon}</span>
              <p className="text-sm text-gray-300 leading-snug">{text}</p>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-sm tracking-wider uppercase bg-blue-500 text-white hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/30">
          Let&apos;s Go!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── LEADERBOARD MODAL ───────────────────────────────────────────────
function LeaderboardModal({ onClose, entries, isLoading }: { onClose: () => void; entries: LeaderboardEntry[]; isLoading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">🏆 Global Board</h2>
            <p className="text-gray-500 text-xs font-mono mt-0.5">TOP 10 · ALL TIME</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center text-sm">✕</button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">No scores yet. Be the first! 🚀</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${idx === 0 ? "bg-yellow-400/10 border border-yellow-400/30" : "bg-gray-800/60"}`}>
                <span className={`text-lg w-8 text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-gray-500"}`}>
                  {idx < 3 ? ["🥇","🥈","🥉"][idx] : `#${idx + 1}`}
                </span>
                <span className="text-lg">{countryFlag(entry.country_code)}</span>
                <span className="flex-1 text-white font-bold text-sm truncate">{entry.player_name}</span>
                <span className={`font-black tabular-nums text-sm ${idx === 0 ? "text-yellow-400" : "text-gray-300"}`}>{entry.score.toLocaleString()}</span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── SHARE BUTTONS ────────────────────────────────────────────────────
function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleNativeShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: "GRID SHIFT", text }); return; } catch {} }
    copy();
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="bg-gray-800/80 rounded-xl p-3 border border-gray-700/50">
        <p className="text-gray-400 text-[10px] font-mono uppercase tracking-widest mb-1.5">공유 미리보기</p>
        <pre className="text-white text-xs font-mono whitespace-pre-wrap leading-relaxed">{text}</pre>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => { copy(); alert("결과가 복사됐어요! 카카오톡에 붙여넣기 해주세요 📋"); }}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl font-bold text-xs" style={{ background: "#FEE500", color: "#3A1D1D" }}>
          <span className="text-lg">💬</span><span>카카오톡</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => { copy(); alert("결과가 복사됐어요! 인스타그램 스토리에 붙여넣기 해주세요 📋"); }}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl font-bold text-xs text-white"
          style={{ background: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
          <span className="text-lg">📸</span><span>인스타그램</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.94 }} onClick={handleNativeShare}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl font-bold text-xs text-white bg-gray-700 hover:bg-gray-600 transition-colors">
          <span className="text-lg">{copied ? "✅" : "📋"}</span><span>{copied ? "복사됨!" : "공유/복사"}</span>
        </motion.button>
      </div>
    </div>
  );
}

// ─── GAME OVER MODAL ──────────────────────────────────────────────────
function GameOverModal({ score, playerName, maxCombo, onSaveComplete, onClose, onViewLeaderboard, onGoHome }: {
  score: number; playerName: string; maxCombo: number;
  onSaveComplete: () => Promise<void>; onClose: () => void; onViewLeaderboard: () => void; onGoHome: () => void;
}) {
  const [saveState, setSaveState] = useState<"saving"|"done"|"error">("saving");
  const [showShare, setShowShare] = useState(false);
  const shareText = buildShareText(playerName, score, maxCombo);

  useEffect(() => {
    (async () => {
      try { await submitScore(playerName, score, getCountryCode()); await onSaveComplete(); setSaveState("done"); }
      catch { setSaveState("error"); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 overflow-y-auto py-4">
      <motion.div initial={{ scale: 0.8, y: 60, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.8, y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 240 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800">
        <div className="text-center mb-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 300 }} className="text-5xl mb-2">
            {score > 800 ? "🔥" : score > 400 ? "⭐" : "💀"}
          </motion.div>
          <h2 className="text-white text-2xl font-black tracking-tight">Game Over</h2>
          <p className="text-gray-500 text-sm font-mono mt-0.5">{playerName}의 최종 점수</p>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-yellow-400 text-4xl font-black tabular-nums mt-1">{score.toLocaleString()}</motion.p>
          {maxCombo > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-purple-400 text-sm font-bold mt-1">최대 콤보 x{maxCombo} ⚡</motion.p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 py-2.5 mb-3 rounded-xl bg-gray-800/60 border border-gray-700/50">
          {saveState === "saving" && (<><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} className="inline-block w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full flex-shrink-0" /><span className="text-gray-300 text-sm font-bold">점수 저장 중...</span></>)}
          {saveState === "done" && (<motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2"><span className="text-green-400 text-lg">✅</span><span className="text-green-400 font-black text-sm">점수가 자동 저장됐어요!</span></motion.div>)}
          {saveState === "error" && (<motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2"><span className="text-red-400 text-lg">⚠️</span><span className="text-red-400 font-bold text-sm">저장 실패. 네트워크 확인</span></motion.div>)}
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowShare(!showShare)}
          className="w-full py-3 rounded-xl font-black text-sm text-white transition-colors mb-1"
          style={{ background: showShare ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: showShare ? "none" : "0 4px 12px rgba(99,102,241,0.35)" }}>
          {showShare ? "▲ 공유 닫기" : "📤 결과 공유하기"}
        </motion.button>
        <AnimatePresence>
          {showShare && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <ShareButtons text={shareText} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={onViewLeaderboard} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors">🏆 리더보드</motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors">↺ 다시하기</motion.button>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onGoHome} className="w-full mt-2 py-3 rounded-xl bg-blue-600/25 text-blue-300 font-bold text-sm hover:bg-blue-600/40 border border-blue-500/25 transition-colors">🏠 홈으로</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── KAKAO AD ────────────────────────────────────────────────────────
function KakaoAd() {
  useEffect(() => {
    // 스크립트 중복 삽입 방지
    if (document.querySelector('script[src*="ba.min.js"]')) return;
    const script = document.createElement("script");
    script.src = "//t1.kakaocdn.net/kas/static/ba.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="w-full max-w-sm flex justify-center mt-2">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit="DAN-6sr6GmPDNHmT5BR1"
        data-ad-width="320"
        data-ad-height="50"
      />
    </div>
  );
}

// ─── GAME SCREEN ──────────────────────────────────────────────────────
function GameScreen({ playerName, onGoHome }: { playerName: string; onGoHome: () => void }) {
  const [initState] = useState(() => { const g = createRandomGrid(); return { grid: g, target: findTutorialSwipeTarget(g) }; });
  const [grid, setGrid] = useState<Block[][]>(initState.grid);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [blastingCells, setBlastingCells] = useState<Set<string>>(new Set());
  const [lineBlastCells, setLineBlastCells] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [scorePopups, setScorePopups] = useState<{ id: string; value: number; x: number; y: number; isLine?: boolean }[]>([]);
  const [movesLeft, setMovesLeft] = useState(MAX_SWIPES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [feverTurns, setFeverTurns] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(true);
  const [tutorialTarget, setTutorialTarget] = useState<TutorialTarget | null>(initState.target);
  const [boardSize, setBoardSize] = useState(0);

  // ✅ 색맹 모드 토글
  const [colorBlindMode, setColorBlindMode] = useState(false);

  const shakeControls = useAnimation();
  const boardRef = useRef<HTMLDivElement>(null);
  const gameOverTriggered = useRef(false);
  const dragStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);

  useEffect(() => { if (boardRef.current) setBoardSize(boardRef.current.getBoundingClientRect().width); }, []);
  useEffect(() => {
    if (!boardRef.current) return;
    const obs = new ResizeObserver(entries => { const e = entries[0]; if (e) setBoardSize(e.contentRect.width); });
    obs.observe(boardRef.current); return () => obs.disconnect();
  }, []);

  const getCellSize = useCallback(() => boardSize > 0 ? boardSize / GRID_SIZE : 48, [boardSize]);

  const playSound = useCallback((type: "blast"|"combo"|"line", comboLevel?: number) => {
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      if (type === "blast") {
        osc.frequency.setValueAtTime(200, ac.currentTime); osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ac.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
      } else if (type === "line") {
        osc.frequency.setValueAtTime(440, ac.currentTime); osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ac.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.12);
      } else if (type === "combo" && comboLevel !== undefined) {
        const notes = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
        osc.frequency.setValueAtTime(notes[Math.min(comboLevel - 1, notes.length - 1)], ac.currentTime);
        gain.gain.setValueAtTime(0.2, ac.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.3);
      }
    } catch {}
  }, []);

  const triggerShake = useCallback(async (intensity: number) => {
    const amp = Math.min(intensity * 5, 25);
    await shakeControls.start({ x: [0, -amp, amp, -amp, amp, 0], y: [0, amp, -amp, amp, -amp, 0], transition: { duration: 0.4, ease: "easeInOut" } });
  }, [shakeControls]);

  const spawnParticles = useCallback((cellKeys: string[], currentGrid: Block[][]) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const cs = rect.width / GRID_SIZE;
    const np: Particle[] = [];
    cellKeys.forEach(key => {
      const [r, c] = key.split(",").map(Number);
      const block = currentGrid[r]?.[c];
      if (!block) return;
      const cx = c * cs + cs / 2, cy = r * cs + cs / 2;
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
        const speed = 60 + Math.random() * 100;
        np.push({ id: `${key}-${i}-${Date.now()}`, x: cx, y: cy, color: COLOR_STYLES[block.color].particle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      }
    });
    setParticles(prev => [...prev, ...np]);
    setTimeout(() => setParticles(prev => prev.filter(p => !np.find(np2 => np2.id === p.id))), 900);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoadingBoard(true);
    const entries = await getTopScores();
    setLeaderboardEntries(entries); setIsLoadingBoard(false);
  }, []);

  const handleOpenLeaderboard = useCallback(async () => {
    setShowLeaderboard(true); await fetchLeaderboard();
  }, [fetchLeaderboard]);

  // ─── ✅ 2×2 + 1×4 통합 blast cycle (feverTurns 버그 수정) ──────────
  const runBlastCycle = useCallback(async (currentGrid: Block[][], currentCombo: number): Promise<number> => {
    const { squareCells, lineCells } = findAllBlasts(currentGrid);
    const hasSquare = squareCells.size > 0;
    const hasLine = lineCells.size > 0;
    if (!hasSquare && !hasLine) { setCombo(0); setFeverMode(false); setIsAnimating(false); return 0; }

    const allBlasted = new Set([...squareCells, ...lineCells]);
    const newCombo = currentCombo + 1;
    setCombo(newCombo);
    setMaxCombo(prev => Math.max(prev, newCombo));

    if (currentCombo >= 4 && !feverMode) { setFeverMode(true); setFeverTurns(3); }

    // ✅ feverTurns 버그 수정: 콜백 안에서 setFeverMode 분리
    if (feverMode) {
      setFeverTurns(prev => {
        const next = prev - 1;
        if (next <= 0) setFeverMode(false);
        return Math.max(next, 0);
      });
    }

    // 무브 보너스: 2×2 있으면 +2, 1×4만이면 +1, 콤보면 +1
    const baseBonus = hasSquare ? 2 : 1;
    const moveBonus = currentCombo === 0 ? baseBonus : 1;
    setMovesLeft(prev => Math.min(prev + moveBonus, MAX_MOVES_CAP));

    spawnParticles([...allBlasted], currentGrid);
    setBlastingCells(squareCells);
    setLineBlastCells(lineCells);

    if (hasSquare) playSound("blast");
    if (hasLine) playSound("line");

    // 점수: 2×2 = 10pt/셀, 1×4 = 5pt/셀
    let earnedScore = squareCells.size * 10 * (currentCombo + 1) + lineCells.size * 5 * (currentCombo + 1);
    if (feverMode) earnedScore *= 2;
    setScore(prev => prev + earnedScore);

    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const cs = rect.width / GRID_SIZE;
      const firstCell = [...allBlasted][0].split(",").map(Number);
      const pid = `popup-${Date.now()}-${Math.random()}`;
      setScorePopups(prev => [...prev, { id: pid, value: earnedScore, x: firstCell[1] * cs + cs / 2, y: firstCell[0] * cs, isLine: !hasSquare }]);
      setTimeout(() => setScorePopups(prev => prev.filter(p => p.id !== pid)), 800);
    }

    if (currentCombo >= 2) triggerShake(currentCombo);
    await new Promise(res => setTimeout(res, 350));
    setBlastingCells(new Set()); setLineBlastCells(new Set());
    const afterGravity = applyGravity(removeBlasted(currentGrid, allBlasted), currentCombo);
    setGrid(afterGravity);
    await new Promise(res => setTimeout(res, 350));
    if (currentCombo + 1 > 0) playSound("combo", currentCombo + 1);
    return moveBonus + await runBlastCycle(afterGravity, currentCombo + 1);
  }, [spawnParticles, triggerShake, feverMode, feverTurns, playSound]);

  const handleDragStart = useCallback((x: number, y: number, row: number, col: number) => {
    if (isAnimating || showGameOver || showTutorial) return;
    dragStart.current = { x, y, row, col };
  }, [isAnimating, showGameOver, showTutorial]);

  const handleDragEnd = useCallback(async (endX: number, endY: number) => {
    if (!dragStart.current || isAnimating || showGameOver || showTutorial) return;
    const { x, y, row, col } = dragStart.current;
    dragStart.current = null;
    const deltaX = endX - x, deltaY = endY - y;
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
    if (showInteractiveTutorial) { setShowInteractiveTutorial(false); setTutorialTarget(null); }
    const newMovesLeft = movesLeft - 1;
    setMovesLeft(newMovesLeft); setIsAnimating(true);
    const newGrid = Math.abs(deltaX) > Math.abs(deltaY)
      ? shiftRow(grid, row, deltaX > 0 ? 1 : -1)
      : shiftCol(grid, col, deltaY > 0 ? 1 : -1);
    setGrid(newGrid);
    await new Promise(res => setTimeout(res, 300));
    const bonus = await runBlastCycle(newGrid, 0);
    if (newMovesLeft + bonus <= 0 && !gameOverTriggered.current) {
      gameOverTriggered.current = true; setShowGameOver(true);
    }
  }, [grid, isAnimating, showGameOver, showTutorial, showInteractiveTutorial, movesLeft, runBlastCycle]);

  const handleReset = () => {
    const ng = createRandomGrid();
    setGrid(ng); setScore(0); setCombo(0); setMaxCombo(0); setFeverMode(false);
    setParticles([]); setBlastingCells(new Set()); setLineBlastCells(new Set()); setIsAnimating(false);
    setShowGameOver(false); setMovesLeft(MAX_SWIPES);
    setTutorialTarget(findTutorialSwipeTarget(ng)); setShowInteractiveTutorial(true);
    gameOverTriggered.current = false;
  };

  return (
    <motion.div className={`min-h-[100dvh] flex flex-col items-center justify-start pt-5 pb-4 select-none overflow-hidden ${feverMode ? "bg-gradient-to-br from-red-900 via-purple-900 to-blue-900" : "bg-gray-950"}`}>
      <AnimatePresence>{showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}</AnimatePresence>
      <AnimatePresence>
        {showGameOver && <GameOverModal score={score} playerName={playerName} maxCombo={maxCombo} onSaveComplete={fetchLeaderboard} onClose={handleReset} onViewLeaderboard={handleOpenLeaderboard} onGoHome={onGoHome} />}
      </AnimatePresence>
      <AnimatePresence>
        {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} entries={leaderboardEntries} isLoading={isLoadingBoard} />}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full max-w-sm px-4 mb-3 flex items-center justify-between">
        <div className="flex flex-col items-start">
          <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Score</span>
          <AnimatePresence mode="popLayout">
            <motion.span key={score} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-white text-3xl font-black tabular-nums">{score.toLocaleString()}</motion.span>
          </AnimatePresence>
          <span className="text-gray-600 text-[11px] font-mono truncate max-w-[90px]">{playerName}</span>
        </div>
        <AnimatePresence>
          {combo > 0 && (
            <motion.div key={combo} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} className="flex flex-col items-center">
              <span className={`${combo >= 3 ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-purple-400 animate-pulse" : "text-yellow-400"} text-xs font-mono uppercase tracking-widest`}>Combo</span>
              <motion.span className={`${combo >= 3 ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-purple-400" : "text-yellow-400"} font-black`}
                style={{ fontSize: `${Math.min(2 + combo * 0.3, 4)}rem` }}
                animate={combo >= 3 ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>x{combo}</motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✅ 색맹 모드 포함 헤더 버튼 */}
        <div className="flex gap-1.5">
          {([
            { icon: "❓", action: () => setShowTutorial(true), title: "도움말" },
            { icon: "🏆", action: handleOpenLeaderboard, title: "리더보드" },
            { icon: "↺", action: handleReset, title: "다시하기" },
            { icon: "🏠", action: onGoHome, title: "홈으로" },
          ] as { icon: string; action: () => void; title: string }[]).map(({ icon, action, title }, i) => (
            <motion.button key={i} whileTap={{ scale: 0.92 }} onClick={action} title={title}
              className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-base hover:bg-gray-700 transition-colors">{icon}</motion.button>
          ))}
          {/* ✅ 색맹 모드 토글 버튼 — 활성 시 강조 */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setColorBlindMode(p => !p)}
            title="색맹 모드 (Color Blind Mode)"
            aria-label="색맹 모드 토글"
            className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors ${
              colorBlindMode
                ? "bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-400/40"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            👁
          </motion.button>
        </div>
      </div>

      {/* ✅ 색맹 모드 ON 뱃지 */}
      <AnimatePresence>
        {colorBlindMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="w-full max-w-sm px-4 mb-1"
          >
            <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-full bg-yellow-400/15 border border-yellow-400/30">
              <span className="text-yellow-300 text-xs font-bold">👁 색맹 모드 ON</span>
              <span className="text-yellow-200/60 text-[10px] font-mono">▲●■◆★ 기호로 구분</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moves gauge */}
      <div className="w-full max-w-sm px-4 mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-xs font-mono uppercase tracking-widest">Moves</span>
          <span className={`text-xs font-mono tabular-nums ${movesLeft >= MAX_MOVES_CAP ? "text-yellow-400 font-bold" : "text-gray-500"}`}>
            {movesLeft}{movesLeft >= MAX_MOVES_CAP ? " 🔒MAX" : " left"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div animate={{ width: `${(movesLeft / MAX_MOVES_CAP) * 100}%` }} transition={{ duration: 0.3 }}
            className={`h-full rounded-full ${movesLeft >= MAX_MOVES_CAP ? "bg-yellow-400" : movesLeft > 18 ? "bg-green-400" : movesLeft > 8 ? "bg-yellow-400" : "bg-red-400"}`} />
        </div>
      </div>

      {/* Board */}
      <motion.div animate={shakeControls} className="w-[92vw] max-w-[420px] aspect-square">
        <div ref={boardRef} className="relative w-full h-full bg-gray-900 rounded-2xl p-2 shadow-2xl touch-none"
          onMouseUp={e => handleDragEnd(e.clientX, e.clientY)} onMouseLeave={() => { dragStart.current = null; }}>

          {/* Interactive tutorial */}
          <AnimatePresence>
            {showInteractiveTutorial && tutorialTarget && (() => {
              const cs = getCellSize();
              const { row, col, swipeDir, swipeIndex } = { ...tutorialTarget.highlight, ...tutorialTarget };
              const isH = swipeDir === "left" || swipeDir === "right";
              const fx = isH ? (swipeDir === "right" ? cs * 0.8 : cs * (GRID_SIZE - 1.8)) : (swipeIndex + 0.5) * cs;
              const fy = isH ? (swipeIndex + 0.5) * cs : (swipeDir === "down" ? cs * 0.8 : cs * (GRID_SIZE - 1.8));
              const travel = cs * 2;
              const mx = swipeDir === "right" ? travel : swipeDir === "left" ? -travel : 0;
              const my = swipeDir === "down" ? travel : swipeDir === "up" ? -travel : 0;
              return (
                <motion.div className="absolute inset-0 rounded-2xl pointer-events-none z-20"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  <div className="absolute inset-0 bg-black/60 rounded-2xl" />
                  {[[row, col], [row, col+1], [row+1, col], [row+1, col+1]].map(([r, c], idx) => (
                    <motion.div key={idx} className="absolute rounded-md border-2 border-yellow-300 bg-yellow-200/15"
                      style={{ width: cs - 5, height: cs - 5, left: c * cs + 6, top: r * cs + 6 }}
                      animate={{ boxShadow: ["0 0 0px 0px rgba(253,224,71,0)", "0 0 14px 5px rgba(253,224,71,0.65)", "0 0 0px 0px rgba(253,224,71,0)"], opacity: [0.55, 1, 0.55] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.08 }} />
                  ))}
                  <motion.div className="absolute text-4xl drop-shadow-lg" style={{ left: fx, top: fy }}
                    animate={{ x: [0, mx, 0], y: [0, my, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}>👆</motion.div>
                  <motion.div className="absolute px-3 py-1 rounded-full bg-yellow-400 text-gray-900 font-black text-xs shadow-xl whitespace-nowrap"
                    style={{ left: fx + mx / 2 - 42, top: fy + my / 2 - 36 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.8] }} transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.4 }}>
                    {{ right: "→ 스와이프!", left: "← 스와이프!", down: "↓ 스와이프!", up: "↑ 스와이프!" }[swipeDir]}
                  </motion.div>
                  <motion.div className="absolute bottom-3 left-3 right-3 bg-gray-900/85 border border-yellow-400/40 rounded-xl px-3 py-2 text-center"
                    animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 2, repeat: Infinity }}>
                    <p className="text-yellow-300 text-xs font-black">같은 색 블록 2×2 또는 1×4를 맞추면 터져요! 💥</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">행이나 열 전체를 스와이프해서 블록을 이동시키세요</p>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30">
            <AnimatePresence>
              {particles.map(p => (
                <motion.div key={p.id} initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }} animate={{ x: p.x + p.vx, y: p.y + p.vy, scale: 0, opacity: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }} className="absolute w-3 h-3 rounded-full"
                  style={{ backgroundColor: p.color, left: 0, top: 0, transform: "translate(-50%,-50%)" }} />
              ))}
            </AnimatePresence>
          </div>

          {/* Score popups */}
          <div className="absolute inset-0 pointer-events-none z-40">
            <AnimatePresence>
              {scorePopups.map(popup => (
                <motion.div key={popup.id} initial={{ x: popup.x, y: popup.y, opacity: 1, scale: 1 }} animate={{ y: popup.y - 40, opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`absolute font-black text-sm pointer-events-none ${popup.isLine ? "text-blue-300" : "text-white"}`}
                  style={{ left: 0, top: 0, transform: "translate(-50%,-50%)" }}>
                  {popup.isLine ? "▬" : ""} +{popup.value}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Grid */}
          <div className="w-full h-full grid gap-1 relative"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE},minmax(0,1fr))`, gridTemplateRows: `repeat(${GRID_SIZE},minmax(0,1fr))` }}>
            {grid.map((row, r) => row.map((block, c) => {
              const key = `${r},${c}`;
              const isBlasting = blastingCells.has(key);
              const isLineBlast = lineBlastCells.has(key);
              const s = COLOR_STYLES[block.color];
              return (
                <motion.div layout key={block.id} initial={false}
                  animate={
                    isBlasting ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] }
                    : isLineBlast ? { scaleX: [1, 1.5, 0], scaleY: [1, 0.8, 0], opacity: [1, 1, 0] }
                    : { scale: 1, opacity: 1 }
                  }
                  transition={{
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                    scale: (isBlasting || isLineBlast) ? { duration: 0.3, ease: "easeIn" } : { duration: 0.15 },
                    opacity: (isBlasting || isLineBlast) ? { duration: 0.3 } : { duration: 0.15 },
                  }}
                  className={`rounded-md cursor-pointer ${s.bg} shadow-md ${s.shadow} ${(isBlasting || isLineBlast) ? "z-10" : ""} flex items-center justify-center`}
                  onMouseDown={e => handleDragStart(e.clientX, e.clientY, r, c)}
                  onTouchStart={e => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY, r, c); }}
                  onTouchEnd={e => { const t = e.changedTouches[0]; handleDragEnd(t.clientX, t.clientY); }}>

                  {/* ✅ 블록 콘텐츠: 특수 블록은 항상 이모지, 일반 블록은 색맹모드 따라 기호 표시 */}
                  <span
                    className="text-white font-black leading-none pointer-events-none select-none drop-shadow"
                    style={{ fontSize: block.type !== "normal" ? "1.1em" : colorBlindMode ? "0.85em" : "0" }}
                  >
                    {block.type === "bomb"
                      ? "💣"
                      : block.type === "rainbow"
                      ? "🌈"
                      : colorBlindMode
                      ? COLOR_SYMBOL[block.color]
                      : ""}
                  </span>
                </motion.div>
              );
            }))}
          </div>
        </div>
      </motion.div>

      {/* 광고 영역 */}
      <KakaoAd />

      <p className="mt-2 text-gray-700 text-xs font-mono tracking-widest uppercase">2×2 blast · 1×4 line · match to survive</p>
    </motion.div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function GridShift() {
  const [screen, setScreen] = useState<"home"|"game">("home");
  const [playerName, setPlayerName] = useState("");
  const handleStart = (name: string) => { setPlayerName(name); setScreen("game"); };
  return (
    <AnimatePresence mode="wait">
      {screen === "home" ? (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.28 }}>
          <HomeScreen onStart={handleStart} />
        </motion.div>
      ) : (
        <motion.div key="game" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.32 }}>
          <GameScreen playerName={playerName} onGoHome={() => setScreen("home")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
