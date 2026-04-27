import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

// ─── Storage helpers ────────────────────────────────────────────────
async function getTopScores() {
  try {
    const result = await window.storage.get("leaderboard", true);
    return result ? JSON.parse(result.value) : [];
  } catch { return []; }
}
async function saveScore(name, score, country) {
  try {
    let board = await getTopScores();
    board.push({ id: Date.now(), player_name: name, score, country_code: country, created_at: new Date().toISOString() });
    board.sort((a, b) => b.score - a.score);
    board = board.slice(0, 10);
    await window.storage.set("leaderboard", JSON.stringify(board), true);
    return true;
  } catch { return false; }
}

// ─── Game constants ──────────────────────────────────────────────────
const COLORS = ["red", "blue", "green", "yellow", "purple"];
const GRID_SIZE = 8;
const MAX_SWIPES = 20;
const COLOR_STYLES = {
  red:    { bg: "bg-red-400",    shadow: "shadow-red-500/60",    particle: "#f87171", hex: "#f87171" },
  blue:   { bg: "bg-blue-400",   shadow: "shadow-blue-500/60",   particle: "#60a5fa", hex: "#60a5fa" },
  green:  { bg: "bg-green-400",  shadow: "shadow-green-500/60",  particle: "#4ade80", hex: "#4ade80" },
  yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-500/60", particle: "#facc15", hex: "#facc15" },
  purple: { bg: "bg-purple-400", shadow: "shadow-purple-500/60", particle: "#c084fc", hex: "#c084fc" },
};

function genId() { return Math.random().toString(36).substr(2, 9) + Date.now(); }
function countryFlag(code) {
  if (!code || code.length !== 2) return "🌐";
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}
function getCountryCode() {
  try { const p = (navigator.language || "en-US").split("-"); return p.length > 1 ? p[p.length - 1].toUpperCase() : "US"; }
  catch { return "KR"; }
}

function createsImmediateMatch(grid, r, c, block) {
  const isMatchable = cell => !!cell && (cell.type === "normal" || cell.type === "rainbow" || cell.type === "bomb");
  const normalColors = cells => cells.filter(cell => !!cell && cell.type === "normal").map(cell => cell.color);
  const checkSquare = (row, col) => {
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

function createRandomGrid() {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let block;
      do { block = { id: genId(), color: COLORS[Math.floor(Math.random() * COLORS.length)], type: "normal" }; }
      while (createsImmediateMatch(grid, r, c, block));
      grid[r][c] = block;
    }
  }
  return grid;
}

function shiftRow(grid, rowIdx, dir) {
  const ng = grid.map(row => [...row]);
  const row = ng[rowIdx];
  if (dir === 1) { const last = row.pop(); row.unshift(last); }
  else { const first = row.shift(); row.push(first); }
  ng[rowIdx] = row;
  return ng;
}

function shiftCol(grid, colIdx, dir) {
  const ng = grid.map(row => [...row]);
  const col = ng.map(row => row[colIdx]);
  if (dir === 1) { const last = col.pop(); col.unshift(last); }
  else { const first = col.shift(); col.push(first); }
  col.forEach((val, i) => { ng[i][colIdx] = val; });
  return ng;
}

function findBlasts(grid) {
  const toBlast = new Set();
  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const cells = [grid[r][c], grid[r][c + 1], grid[r + 1][c], grid[r + 1][c + 1]];
      if (cells.some(cell => !cell)) continue;
      const normals = cells.filter(cell => cell?.type === "normal");
      if (normals.length === 0) continue;
      const tc = normals[0].color;
      if (normals.some(cell => cell.color !== tc)) continue;
      if (!cells.every(cell => cell?.type === "normal" || cell?.type === "rainbow" || cell?.type === "bomb")) continue;
      const coords = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
      coords.forEach(([rr, cc]) => toBlast.add(`${rr},${cc}`));
      cells.forEach((cell, idx) => {
        if (cell?.type === "bomb") {
          const [br, bc] = coords[idx];
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const nr = br + dr, nc = bc + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) toBlast.add(`${nr},${nc}`);
            }
        }
      });
    }
  }
  return toBlast;
}

function findTutorialSwipeTarget(grid) {
  for (const dir of [1, -1]) {
    for (let r = 0; r < GRID_SIZE; r++) {
      const shifted = shiftRow(grid, r, dir);
      const blasted = findBlasts(shifted);
      if (blasted.size > 0) {
        const [br, bc] = [...blasted][0].split(",").map(Number);
        return { highlight: { row: Math.max(0, Math.min(br, GRID_SIZE - 2)), col: Math.max(0, Math.min(bc, GRID_SIZE - 2)) }, swipeDir: dir === 1 ? "right" : "left", swipeIndex: r };
      }
    }
  }
  for (const dir of [1, -1]) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const shifted = shiftCol(grid, c, dir);
      const blasted = findBlasts(shifted);
      if (blasted.size > 0) {
        const [br, bc] = [...blasted][0].split(",").map(Number);
        return { highlight: { row: Math.max(0, Math.min(br, GRID_SIZE - 2)), col: Math.max(0, Math.min(bc, GRID_SIZE - 2)) }, swipeDir: dir === 1 ? "down" : "up", swipeIndex: c };
      }
    }
  }
  return { highlight: { row: 3, col: 3 }, swipeDir: "right", swipeIndex: 3 };
}

function removeBlasted(grid, blasted) {
  return grid.map((row, r) => row.map((cell, c) => blasted.has(`${r},${c}`) ? null : cell));
}

function applyGravity(grid, currentCombo) {
  const ng = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = [];
    for (let r = 0; r < GRID_SIZE; r++) { if (grid[r][c] !== null) col.push(grid[r][c]); }
    while (col.length < GRID_SIZE) {
      const specialChance = currentCombo >= 3 ? 0.08 + Math.min(currentCombo * 0.02, 0.12) : 0;
      const isSpecial = Math.random() < specialChance;
      let type = "normal";
      if (isSpecial) type = Math.random() < 0.4 ? "bomb" : "rainbow";
      col.unshift({ id: genId(), color: COLORS[Math.floor(Math.random() * COLORS.length)], type });
    }
    for (let r = 0; r < GRID_SIZE; r++) ng[r][c] = col[r];
  }
  return ng;
}

// ─── Floating Block (home screen deco) ──────────────────────────────
function FloatingBlock({ color, x, y, size, delay, duration }) {
  return (
    <motion.div
      className="absolute rounded-xl opacity-30"
      style={{
        left: `${x}%`, top: `${y}%`, width: size, height: size,
        background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
        boxShadow: `0 4px 20px ${color}44`,
      }}
      animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0], opacity: [0.2, 0.4, 0.2] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────
function HomeScreen({ onStart }) {
  const [nickname, setNickname] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState("");

  const floatingBlocks = [
    { color: "#f87171", x: 5, y: 10, size: 40, delay: 0, duration: 3.2 },
    { color: "#60a5fa", x: 85, y: 8, size: 32, delay: 0.5, duration: 2.8 },
    { color: "#4ade80", x: 10, y: 60, size: 28, delay: 1.2, duration: 3.5 },
    { color: "#facc15", x: 80, y: 55, size: 36, delay: 0.8, duration: 2.6 },
    { color: "#c084fc", x: 50, y: 5, size: 24, delay: 0.3, duration: 3.0 },
    { color: "#f87171", x: 75, y: 80, size: 30, delay: 1.5, duration: 3.3 },
    { color: "#60a5fa", x: 15, y: 85, size: 22, delay: 0.9, duration: 2.9 },
    { color: "#4ade80", x: 90, y: 35, size: 26, delay: 0.4, duration: 3.1 },
  ];

  const handleStart = () => {
    if (!nickname.trim()) { setError("닉네임을 입력해주세요 😊"); return; }
    if (nickname.trim().length < 2) { setError("2글자 이상 입력해주세요"); return; }
    onStart(nickname.trim());
  };

  const openLeaderboard = async () => {
    setShowBoard(true);
    setLoadingBoard(true);
    const data = await getTopScores();
    setLeaderboard(data);
    setLoadingBoard(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: "linear-gradient(160deg, #1a3a8f 0%, #1565c0 40%, #0d47a1 70%, #0a2d6b 100%)" }}>
      {/* Stars */}
      {[...Array(20)].map((_, i) => (
        <motion.div key={i} className="absolute rounded-full bg-white"
          style={{ width: Math.random() * 3 + 1, height: Math.random() * 3 + 1, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5 + Math.random() * 2, delay: Math.random() * 3, repeat: Infinity }} />
      ))}
      {/* Floating decorative blocks */}
      {floatingBlocks.map((b, i) => <FloatingBlock key={i} {...b} />)}

      {/* Title */}
      <motion.div className="flex flex-col items-center mb-8 mt-4"
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 18 }}>
        <div className="relative mb-1">
          {/* Crown emoji */}
          <motion.div className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl z-10"
            animate={{ rotate: [-5, 5, -5], y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>👑</motion.div>
          {/* GRID */}
          <div className="flex" style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.5))" }}>
            {["G", "R", "I", "D"].map((letter, i) => (
              <motion.span key={i} className="font-black text-7xl leading-none"
                style={{
                  color: ["#FF6B35", "#FFD700", "#FF6B35", "#3DD6F5"][i],
                  WebkitTextStroke: "3px rgba(0,0,0,0.3)",
                  textShadow: "0 4px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2)",
                  fontFamily: "'Arial Black', sans-serif",
                }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 * i, type: "spring", stiffness: 200 }}
              >{letter}</motion.span>
            ))}
          </div>
          {/* SHIFT */}
          <div className="flex justify-center -mt-1" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
            {["S", "H", "I", "F", "T"].map((letter, i) => (
              <motion.span key={i} className="font-black text-5xl leading-none"
                style={{
                  color: ["#3DD6F5", "#3DD6F5", "#3DD6F5", "#3DD6F5", "#3DD6F5"][i],
                  WebkitTextStroke: "2px rgba(0,0,50,0.4)",
                  textShadow: "0 3px 0 rgba(0,0,80,0.3)",
                  fontFamily: "'Arial Black', sans-serif",
                }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 + 0.08 * i, type: "spring", stiffness: 200 }}
              >{letter}</motion.span>
            ))}
          </div>
        </div>
        <motion.p className="text-blue-200 text-xs font-bold tracking-[0.3em] uppercase mt-2 opacity-70"
          initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.9 }}>
          PUZZLE · MATCH · BLAST
        </motion.p>
      </motion.div>

      {/* Nickname card */}
      <motion.div className="w-full max-w-xs px-5 mb-4"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-xl">
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-2 text-center">닉네임 입력</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value.slice(0, 12)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="닉네임을 입력하세요..."
              maxLength={12}
              className="w-full bg-white/15 text-white font-bold text-center rounded-xl pl-10 pr-10 py-3 outline-none border border-white/20 focus:border-yellow-300/70 transition-all placeholder-blue-200/50 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/60 text-xs font-mono">{nickname.length}/12</span>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-300 text-xs text-center mt-2 font-bold">{error}</motion.p>
          )}
        </div>
      </motion.div>

      {/* Buttons */}
      <motion.div className="w-full max-w-xs px-5 flex flex-col gap-3"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
        {/* Start button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleStart}
          className="relative w-full py-4 rounded-2xl font-black text-lg tracking-wide text-white overflow-hidden shadow-xl"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 6px 0 #92400e, 0 8px 20px rgba(245,158,11,0.4)" }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span className="text-xl">🎮</span> 게임 시작
          </span>
          <motion.div className="absolute inset-0 bg-white/20"
            animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            style={{ skewX: "-15deg" }} />
        </motion.button>

        {/* Leaderboard button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={openLeaderboard}
          className="w-full py-4 rounded-2xl font-black text-lg tracking-wide text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 6px 0 #065f46, 0 8px 20px rgba(16,185,129,0.4)" }}
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">🏆</span> 리더보드
          </span>
        </motion.button>
      </motion.div>

      {/* Bottom tagline */}
      <motion.p className="mt-8 text-blue-200/40 text-xs font-mono tracking-widest uppercase"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        swipe · match · blast
      </motion.p>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showBoard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowBoard(false)}>
            <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 260 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10"
              style={{ background: "linear-gradient(160deg, #1a3a8f, #0a2d6b)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white text-xl font-black">🏆 Global Board</h2>
                  <p className="text-blue-300/60 text-xs font-mono mt-0.5">TOP 10 · ALL TIME</p>
                </div>
                <button onClick={() => setShowBoard(false)} className="w-8 h-8 rounded-full bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm">✕</button>
              </div>
              {loadingBoard ? (
                <div className="flex justify-center py-12">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-blue-300/50 font-mono text-sm">첫 번째 도전자가 되어보세요! 🚀</div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => {
                    const rankIcons = ["🥇", "🥈", "🥉"];
                    return (
                      <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${idx === 0 ? "bg-yellow-400/15 border border-yellow-400/30" : "bg-white/5"}`}>
                        <span className={`text-lg w-8 text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-white/40"}`}>
                          {idx < 3 ? rankIcons[idx] : `#${idx + 1}`}
                        </span>
                        <span className="text-lg">{countryFlag(entry.country_code)}</span>
                        <span className="flex-1 text-white font-bold text-sm truncate">{entry.player_name}</span>
                        <span className={`font-black tabular-nums text-sm ${idx === 0 ? "text-yellow-400" : "text-white/80"}`}>{entry.score.toLocaleString()}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GAME SCREEN ──────────────────────────────────────────────────────
function GameScreen({ playerName, onGoHome }) {
  const [initState] = useState(() => { const g = createRandomGrid(); return { grid: g, target: findTutorialSwipeTarget(g) }; });
  const [grid, setGrid] = useState(initState.grid);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState([]);
  const [blastingCells, setBlastingCells] = useState(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [scorePopups, setScorePopups] = useState([]);
  const [movesLeft, setMovesLeft] = useState(MAX_SWIPES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [feverTurns, setFeverTurns] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(true);
  const [tutorialTarget, setTutorialTarget] = useState(initState.target);
  const [boardSize, setBoardSize] = useState(0);
  const shakeControls = useAnimation();
  const boardRef = useRef(null);
  const gameOverTriggered = useRef(false);
  const dragStart = useRef(null);

  useEffect(() => {
    if (boardRef.current) setBoardSize(boardRef.current.getBoundingClientRect().width);
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    const observer = new ResizeObserver(entries => { const e = entries[0]; if (e) setBoardSize(e.contentRect.width); });
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  const getCellSize = useCallback(() => boardSize > 0 ? boardSize / GRID_SIZE : 48, [boardSize]);

  const playSound = useCallback((type, comboLevel) => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      if (type === "blast") {
        osc.frequency.setValueAtTime(200, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
      } else if (type === "combo" && comboLevel !== undefined) {
        const notes = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
        const freq = notes[Math.min(comboLevel - 1, notes.length - 1)];
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        gain.gain.setValueAtTime(0.2, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.3);
      }
    } catch {}
  }, []);

  const triggerShake = useCallback(async (intensity) => {
    const amp = Math.min(intensity * 5, 25);
    await shakeControls.start({ x: [0, -amp, amp, -amp, amp, 0], y: [0, amp, -amp, amp, -amp, 0], transition: { duration: 0.4, ease: "easeInOut" } });
  }, [shakeControls]);

  const spawnParticles = useCallback((cellKeys, currentGrid) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const cs = rect.width / GRID_SIZE;
    const np = [];
    cellKeys.forEach(key => {
      const [r, c] = key.split(",").map(Number);
      const block = currentGrid[r]?.[c];
      if (!block) return;
      const cx = c * cs + cs / 2, cy = r * cs + cs / 2;
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.5;
        const speed = 80 + Math.random() * 120;
        np.push({ id: `${key}-${i}-${Date.now()}`, x: cx, y: cy, color: COLOR_STYLES[block.color].particle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      }
    });
    setParticles(prev => [...prev, ...np]);
    setTimeout(() => setParticles(prev => prev.filter(p => !np.find(np2 => np2.id === p.id))), 900);
  }, []);

  const runBlastCycle = useCallback(async (currentGrid, currentCombo) => {
    const blasted = findBlasts(currentGrid);
    if (blasted.size === 0) { setCombo(0); setFeverMode(false); setIsAnimating(false); return 0; }
    if (currentCombo >= 4 && !feverMode) { setFeverMode(true); setFeverTurns(3); }
    if (feverMode) { setFeverTurns(prev => { if (prev <= 1) { setFeverMode(false); return 0; } return prev - 1; }); }
    let bonusMoves = 0;
    if (currentCombo === 0) { setMovesLeft(prev => prev + 2); bonusMoves = 2; }
    spawnParticles([...blasted], currentGrid);
    setBlastingCells(blasted);
    playSound("blast");
    let earnedScore = blasted.size * 10 * (currentCombo + 1);
    if (feverMode) earnedScore *= 2;
    setScore(prev => prev + earnedScore);
    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const cs = rect.width / GRID_SIZE;
      const [fr, fc] = [...blasted][0].split(",").map(Number);
      const pid = `popup-${Date.now()}-${Math.random()}`;
      setScorePopups(prev => [...prev, { id: pid, value: earnedScore, x: fc * cs + cs / 2, y: fr * cs }]);
      setTimeout(() => setScorePopups(prev => prev.filter(p => p.id !== pid)), 800);
    }
    if (currentCombo >= 2) triggerShake(currentCombo);
    await new Promise(res => setTimeout(res, 350));
    setBlastingCells(new Set());
    const afterRemove = removeBlasted(currentGrid, blasted);
    const afterGravity = applyGravity(afterRemove, currentCombo);
    setGrid(afterGravity);
    await new Promise(res => setTimeout(res, 350));
    if (currentCombo + 1 > 0) playSound("combo", currentCombo + 1);
    const nb = await runBlastCycle(afterGravity, currentCombo + 1);
    return bonusMoves + nb;
  }, [spawnParticles, triggerShake, feverMode, feverTurns, playSound]);

  const handleDragStart = useCallback((x, y, row, col) => {
    if (isAnimating || showGameOver || showTutorial) return;
    dragStart.current = { x, y, row, col };
  }, [isAnimating, showGameOver, showTutorial]);

  const handleDragEnd = useCallback(async (endX, endY) => {
    if (!dragStart.current || isAnimating || showGameOver || showTutorial) return;
    const { x, y, row, col } = dragStart.current;
    dragStart.current = null;
    const deltaX = endX - x, deltaY = endY - y;
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
    if (showInteractiveTutorial) { setShowInteractiveTutorial(false); setTutorialTarget(null); }
    const newMovesLeft = movesLeft - 1;
    setMovesLeft(newMovesLeft);
    setIsAnimating(true);
    let newGrid;
    if (Math.abs(deltaX) > Math.abs(deltaY)) newGrid = shiftRow(grid, row, deltaX > 0 ? 1 : -1);
    else newGrid = shiftCol(grid, col, deltaY > 0 ? 1 : -1);
    setGrid(newGrid);
    await new Promise(res => setTimeout(res, 300));
    const bonus = await runBlastCycle(newGrid, 0);
    if (newMovesLeft + bonus <= 0 && !gameOverTriggered.current) {
      gameOverTriggered.current = true;
      setShowGameOver(true);
    }
  }, [grid, isAnimating, showGameOver, showTutorial, showInteractiveTutorial, movesLeft, runBlastCycle]);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoadingBoard(true);
    const data = await getTopScores();
    setLeaderboardEntries(data);
    setIsLoadingBoard(false);
  }, []);

  const handleSubmitScore = useCallback(async () => {
    const cc = getCountryCode();
    await saveScore(playerName, score, cc);
    await fetchLeaderboard();
  }, [playerName, score, fetchLeaderboard]);

  const handleReset = () => {
    const ng = createRandomGrid();
    setGrid(ng); setScore(0); setCombo(0); setFeverMode(false);
    setParticles([]); setBlastingCells(new Set()); setIsAnimating(false);
    setShowGameOver(false); setMovesLeft(MAX_SWIPES);
    setTutorialTarget(findTutorialSwipeTarget(ng)); setShowInteractiveTutorial(true);
    gameOverTriggered.current = false;
  };

  return (
    <motion.div className={`min-h-screen flex flex-col items-center justify-start pt-4 pb-4 select-none overflow-hidden ${feverMode ? "bg-gradient-to-br from-red-900 via-purple-900 to-blue-900" : "bg-gray-950"}`}>
      {/* Tutorial Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setShowTutorial(false)}>
            <motion.div initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
              className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-white text-2xl font-black text-center mb-4">How to Play 🎮</h2>
              <div className="space-y-3 mb-6">
                {[["👆", "행 또는 열 전체를 스와이프해서 블록을 이동시키세요."],
                  ["🧊", "같은 색 2×2 블록을 맞추면 터져요!"],
                  ["💣", "폭탄 블록은 2×2 매치에 포함되면 주변 블록도 폭발!"],
                  ["🌈", "무지개 블록은 어떤 색과도 매치됩니다."],
                  ["✨", "콤보 3 이상이면 특수 블록이 등장해요!"]].map(([icon, text], i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-xl">
                    <span className="text-2xl">{icon}</span>
                    <p className="text-sm text-gray-300">{text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowTutorial(false)} className="w-full py-3 rounded-xl font-black text-sm bg-blue-500 text-white hover:bg-blue-400 transition-colors">
                Let&apos;s Go!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.8, y: 60 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 60 }}
              transition={{ type: "spring", damping: 18, stiffness: 240 }}
              className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800">
              <div className="text-center mb-5">
                <div className="text-5xl mb-2">{score > 500 ? "🔥" : score > 200 ? "⭐" : "💀"}</div>
                <h2 className="text-white text-2xl font-black">Game Over</h2>
                <p className="text-gray-400 text-sm font-mono">{playerName}의 최종 점수</p>
                <p className="text-yellow-400 text-4xl font-black tabular-nums mt-1">{score.toLocaleString()}</p>
              </div>
              <GameOverSubmit score={score} playerName={playerName} onSubmit={handleSubmitScore} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }}
                  className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700">🏆 리더보드</button>
                <button onClick={handleReset} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700">↺ 다시하기</button>
              </div>
              <button onClick={onGoHome} className="w-full mt-2 py-3 rounded-xl bg-blue-600/30 text-blue-300 font-bold text-sm hover:bg-blue-600/50 border border-blue-500/30">🏠 홈으로</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setShowLeaderboard(false)}>
            <motion.div initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
              className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white text-xl font-black">🏆 Global Board</h2>
                  <p className="text-gray-500 text-xs font-mono">TOP 10 · ALL TIME</p>
                </div>
                <button onClick={() => setShowLeaderboard(false)} className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-sm">✕</button>
              </div>
              {isLoadingBoard ? (
                <div className="flex justify-center py-12">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
                </div>
              ) : leaderboardEntries.length === 0 ? (
                <div className="text-center py-10 text-gray-600 font-mono text-sm">아직 기록이 없어요 🚀</div>
              ) : (
                <div className="space-y-2">
                  {leaderboardEntries.map((entry, idx) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${idx === 0 ? "bg-yellow-400/10 border border-yellow-400/30" : "bg-gray-800/60"}`}>
                      <span className={`text-lg w-8 text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-gray-500"}`}>
                        {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `#${idx + 1}`}
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
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full max-w-sm px-4 mb-3 flex items-center justify-between">
        <div className="flex flex-col items-start">
          <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Score</span>
          <AnimatePresence mode="popLayout">
            <motion.span key={score} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-white text-3xl font-black tabular-nums">
              {score.toLocaleString()}
            </motion.span>
          </AnimatePresence>
          <span className="text-gray-600 text-xs font-mono truncate max-w-[80px]">{playerName}</span>
        </div>
        <AnimatePresence>
          {combo > 0 && (
            <motion.div key={combo} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} className="flex flex-col items-center">
              <span className={`${combo >= 3 ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-purple-400 animate-pulse" : "text-yellow-400"} text-xs font-mono uppercase tracking-widest`}>Combo</span>
              <motion.span className={`${combo >= 3 ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-purple-400" : "text-yellow-400"} font-black`}
                style={{ fontSize: `${Math.min(2 + combo * 0.3, 4)}rem` }}
                animate={combo >= 3 ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
                x{combo}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex gap-1.5">
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowTutorial(true)} className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-base hover:bg-gray-700">❓</motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }} className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-base hover:bg-gray-700">🏆</motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={handleReset} className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700">↺</motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={onGoHome} className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-base hover:bg-gray-700">🏠</motion.button>
        </div>
      </div>

      {/* Moves gauge */}
      <div className="w-full max-w-sm px-4 mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-xs font-mono uppercase tracking-widest">Moves</span>
          <span className="text-gray-500 text-xs font-mono tabular-nums">{movesLeft} left</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div animate={{ width: `${(movesLeft / MAX_SWIPES) * 100}%` }} transition={{ duration: 0.3 }}
            className={`h-full rounded-full ${movesLeft > 12 ? "bg-green-400" : movesLeft > 6 ? "bg-yellow-400" : "bg-red-400"}`} />
        </div>
      </div>

      {/* Board */}
      <motion.div animate={shakeControls} className="w-[92vw] max-w-[420px] aspect-square">
        <div ref={boardRef} className="relative w-full h-full bg-gray-900 rounded-2xl p-2 shadow-2xl touch-none"
          onMouseUp={e => handleDragEnd(e.clientX, e.clientY)} onMouseLeave={() => { dragStart.current = null; }}>
          {/* Interactive tutorial overlay */}
          <AnimatePresence>
            {showInteractiveTutorial && tutorialTarget && (
              <motion.div className="absolute inset-0 rounded-2xl pointer-events-none z-20"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <div className="absolute inset-0 bg-black/60 rounded-2xl" />
                {(() => {
                  const cs = getCellSize();
                  const { row, col } = tutorialTarget.highlight;
                  return [[row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]].map(([r, c], idx) => (
                    <motion.div key={idx} className="absolute rounded-md border-2 border-yellow-300 bg-yellow-200/15"
                      style={{ width: cs - 5, height: cs - 5, left: c * cs + 6, top: r * cs + 6 }}
                      animate={{ boxShadow: ["0 0 0px 0px rgba(253,224,71,0)", "0 0 14px 5px rgba(253,224,71,0.65)", "0 0 0px 0px rgba(253,224,71,0)"], opacity: [0.55, 1, 0.55] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.08 }} />
                  ));
                })()}
                {(() => {
                  const cs = getCellSize();
                  const { swipeDir, swipeIndex } = tutorialTarget;
                  const isH = swipeDir === "left" || swipeDir === "right";
                  const fx = isH ? (swipeDir === "right" ? cs * 0.8 : cs * (GRID_SIZE - 1.8)) : (swipeIndex + 0.5) * cs;
                  const fy = isH ? (swipeIndex + 0.5) * cs : (swipeDir === "down" ? cs * 0.8 : cs * (GRID_SIZE - 1.8));
                  const travel = cs * 2;
                  const mx = swipeDir === "right" ? travel : swipeDir === "left" ? -travel : 0;
                  const my = swipeDir === "down" ? travel : swipeDir === "up" ? -travel : 0;
                  return (
                    <>
                      <motion.div className="absolute text-4xl drop-shadow-lg" style={{ left: fx, top: fy }}
                        animate={{ x: [0, mx, 0], y: [0, my, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}>👆</motion.div>
                      <motion.div className="absolute px-3 py-1 rounded-full bg-yellow-400 text-gray-900 font-black text-xs shadow-xl whitespace-nowrap"
                        style={{ left: fx + mx / 2 - 42, top: fy + my / 2 - 36 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.8] }} transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.4 }}>
                        {{ right: "→ 스와이프!", left: "← 스와이프!", down: "↓ 스와이프!", up: "↑ 스와이프!" }[swipeDir]}
                      </motion.div>
                    </>
                  );
                })()}
                <motion.div className="absolute bottom-3 left-3 right-3 bg-gray-900/85 border border-yellow-400/40 rounded-xl px-3 py-2 text-center"
                  animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 2, repeat: Infinity }}>
                  <p className="text-yellow-300 text-xs font-black">같은 색 블록 2×2를 맞추면 터져요! 💥</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">행이나 열 전체를 스와이프해서 블록을 이동시키세요</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30">
            <AnimatePresence>
              {particles.map(p => (
                <motion.div key={p.id} initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }} animate={{ x: p.x + p.vx, y: p.y + p.vy, scale: 0, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute w-3 h-3 rounded-full" style={{ backgroundColor: p.color, left: 0, top: 0, transform: "translate(-50%,-50%)" }} />
              ))}
            </AnimatePresence>
          </div>
          {/* Score popups */}
          <div className="absolute inset-0 pointer-events-none z-40">
            <AnimatePresence>
              {scorePopups.map(p => (
                <motion.div key={p.id} initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }} animate={{ y: p.y - 40, opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
                  className="absolute text-white font-black text-sm pointer-events-none" style={{ left: 0, top: 0, transform: "translate(-50%,-50%)" }}>
                  +{p.value}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {/* Grid */}
          <div className="w-full h-full grid gap-1 relative" style={{ gridTemplateColumns: `repeat(${GRID_SIZE},minmax(0,1fr))`, gridTemplateRows: `repeat(${GRID_SIZE},minmax(0,1fr))` }}>
            {grid.map((row, r) => row.map((block, c) => {
              const key = `${r},${c}`;
              const isBlasting = blastingCells.has(key);
              const s = COLOR_STYLES[block.color];
              return (
                <motion.div layout key={block.id} initial={false}
                  animate={isBlasting ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
                  transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, scale: isBlasting ? { duration: 0.3, ease: "easeIn" } : { duration: 0.15 }, opacity: isBlasting ? { duration: 0.3 } : { duration: 0.15 } }}
                  className={`rounded-md cursor-pointer ${s.bg} shadow-md ${s.shadow} ${isBlasting ? "z-10" : ""} flex items-center justify-center text-white font-black text-lg`}
                  onMouseDown={e => { handleDragStart(e.clientX, e.clientY, r, c); }}
                  onTouchStart={e => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY, r, c); }}
                  onTouchEnd={e => { const t = e.changedTouches[0]; handleDragEnd(t.clientX, t.clientY); }}>
                  {block.type === "bomb" ? "💣" : block.type === "rainbow" ? "🌈" : ""}
                </motion.div>
              );
            }))}
          </div>
        </div>
      </motion.div>
      <p className="mt-4 text-gray-700 text-xs font-mono tracking-widest uppercase">swipe to shift · match 2×2 to blast</p>
    </motion.div>
  );
}

function GameOverSubmit({ score, playerName, onSubmit }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const handleClick = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    await onSubmit();
    setSubmitting(false);
    setSubmitted(true);
  };
  if (submitted) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
      <p className="text-green-400 font-black text-base">저장완료! ✅</p>
      <p className="text-gray-500 text-sm">글로벌 보드에 등록됐어요!</p>
    </motion.div>
  );
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={handleClick} disabled={submitting}
      className="w-full py-3 rounded-xl font-black text-sm bg-yellow-400 text-gray-900 hover:bg-yellow-300 disabled:opacity-50 transition-colors">
      {submitting ? "저장 중..." : `🚀 ${playerName}의 점수 저장`}
    </motion.button>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "game"
  const [playerName, setPlayerName] = useState("");

  const handleStart = (name) => {
    setPlayerName(name);
    setScreen("game");
  };

  return (
    <AnimatePresence mode="wait">
      {screen === "home" ? (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
          <HomeScreen onStart={handleStart} />
        </motion.div>
      ) : (
        <motion.div key="game" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <GameScreen playerName={playerName} onGoHome={() => setScreen("home")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
