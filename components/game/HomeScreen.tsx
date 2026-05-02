import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopScores, LeaderboardEntry } from "@/lib/supabase";
import { countryFlag } from "./utils";

function FloatingBlock({ color, x, y, size, delay, duration }: { color: string; x: number; y: number; size: number; delay: number; duration: number }) {
  return (
    <motion.div className="absolute rounded-xl"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: `linear-gradient(135deg,${color}99,${color}44)`, boxShadow: `0 4px 16px ${color}33` }}
      animate={{ y: [0, -18, 0], rotate: [0, 8, -8, 0], opacity: [0.25, 0.45, 0.25] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }} />
  );
}

export function HomeScreen({ onStart }: { onStart: (name: string) => void }) {
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
