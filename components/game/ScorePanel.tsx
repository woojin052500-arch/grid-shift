import { motion, AnimatePresence } from "framer-motion";
import { MAX_MOVES_CAP } from "./types";

interface ScorePanelProps {
  score: number;
  combo: number;
  maxCombo: number;
  movesLeft: number;
  feverMode: boolean;
  colorBlindMode: boolean;
  onToggleColorBlind: () => void;
  onShowTutorial: () => void;
  onShowLeaderboard: () => void;
}

export function ScorePanel({
  score, combo, maxCombo, movesLeft, feverMode, colorBlindMode,
  onToggleColorBlind, onShowTutorial, onShowLeaderboard
}: ScorePanelProps) {
  return (
    <div className="w-full max-w-sm px-4 mb-3 flex flex-col gap-3">
      {/* Top Row: Score & Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-start">
          <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Score</span>
          <AnimatePresence mode="popLayout">
            <motion.span key={score} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-white text-3xl font-black tabular-nums">
              {score.toLocaleString()}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          <button onClick={onToggleColorBlind} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${colorBlindMode ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            👁
          </button>
          <button onClick={onShowLeaderboard} className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800 text-yellow-400 text-lg">
            🏆
          </button>
          <button onClick={(e) => { e.stopPropagation(); document.dispatchEvent(new CustomEvent("openAchievements")); }} className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800 text-amber-500 text-lg hover:bg-gray-700">
            🏅
          </button>
          <button onClick={onShowTutorial} className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800 text-blue-400 text-lg">
            ❔
          </button>
          <button onClick={(e) => { e.stopPropagation(); document.dispatchEvent(new CustomEvent("openSettings")); }} className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800 text-gray-300 text-lg hover:bg-gray-700">
            ⚙️
          </button>
        </div>
      </div>

      {/* Info Row: Combo & Moves */}
      <div className="flex items-end justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-mono uppercase">Combo</span>
            <span className={`text-xl font-black tabular-nums ${feverMode ? "text-red-400" : "text-purple-400"}`}>
              {combo > 0 ? `${combo}` : "0"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-mono uppercase">Max</span>
            <span className="text-purple-300/50 text-sm font-black tabular-nums">{maxCombo}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-gray-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1">
            Moves {movesLeft >= MAX_MOVES_CAP && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">MAX</span>}
          </span>
          <AnimatePresence mode="popLayout">
            <motion.span key={movesLeft} initial={{ scale: 1.5, opacity: 0, color: "#fff" }} animate={{ scale: 1, opacity: 1, color: movesLeft <= 5 ? "#ef4444" : "#eab308" }} className="font-black text-2xl tabular-nums">
              {movesLeft}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Fever & Moves Gauge */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative shadow-inner">
        {feverMode && (
          <motion.div className="absolute inset-0 bg-red-500/30"
            animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} />
        )}
        <motion.div className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ 
            width: `${Math.min(100, Math.max(0, (movesLeft / MAX_MOVES_CAP) * 100))}%`,
            background: feverMode ? "linear-gradient(90deg, #ef4444, #f97316)" : (movesLeft <= 5 ? "#ef4444" : "#eab308")
          }} />
      </div>
    </div>
  );
}
