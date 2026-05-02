import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LeaderboardEntry, submitScore } from "@/lib/supabase";
import { MAX_MOVES_CAP } from "./types";
import { buildShareText, countryFlag, getCountryCode } from "./utils";

export function TutorialModal({ onClose }: { onClose: () => void }) {
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

export function LeaderboardModal({ onClose, entries, isLoading }: { onClose: () => void; entries: LeaderboardEntry[]; isLoading: boolean }) {
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

function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => { 
    try {
      await navigator.clipboard.writeText(text); 
      setCopied(true); 
      setTimeout(() => setCopied(false), 2000); 
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) { 
      try { 
        await navigator.share({ title: "GRID SHIFT", text }); 
        return; 
      } catch {} 
    }
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

export function GameOverModal({ 
  score, playerName, maxCombo, onSaveComplete, onClose, onViewLeaderboard, onGoHome 
}: {
  score: number; playerName: string; maxCombo: number;
  onSaveComplete: () => Promise<void>; onClose: () => void; onViewLeaderboard: () => void; onGoHome: () => void;
}) {
  const [saveState, setSaveState] = useState<"saving"|"done"|"error">("saving");
  const [showShare, setShowShare] = useState(false);
  const shareText = buildShareText(playerName, score, maxCombo);

  useEffect(() => {
    (async () => {
      try { 
        await submitScore(playerName, score, getCountryCode()); 
        await onSaveComplete(); 
        setSaveState("done"); 
      }
      catch { 
        setSaveState("error"); 
      }
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
          {saveState === "error" && (<motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2"><span className="text-red-400 text-lg">⚠️</span><span className="text-red-400 font-bold text-sm">네트워크 불안정 (로컬 플레이)</span></motion.div>)}
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

export function SettingsModal({ 
  onClose, soundEnabled, vibrationEnabled, toggleSound, toggleVibration 
}: { 
  onClose: () => void; soundEnabled: boolean; vibrationEnabled: boolean;
  toggleSound: () => void; toggleVibration: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
        className="w-full max-w-sm bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-xl font-black tracking-tight">⚙️ 환경설정</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center text-sm">✕</button>
        </div>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between bg-gray-800/60 p-4 rounded-xl border border-gray-700/50">
            <span className="text-gray-200 font-bold text-sm">🎵 효과음 (Sound Effects)</span>
            <button onClick={toggleSound} className={`w-14 h-8 rounded-full transition-colors relative ${soundEnabled ? "bg-green-500" : "bg-gray-600"}`}>
              <motion.div layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-6 h-6 bg-white rounded-full absolute top-1" style={{ left: soundEnabled ? "28px" : "4px" }} />
            </button>
          </div>
          <div className="flex items-center justify-between bg-gray-800/60 p-4 rounded-xl border border-gray-700/50">
            <span className="text-gray-200 font-bold text-sm">📳 진동 (Haptic)</span>
            <button onClick={toggleVibration} className={`w-14 h-8 rounded-full transition-colors relative ${vibrationEnabled ? "bg-green-500" : "bg-gray-600"}`}>
              <motion.div layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-6 h-6 bg-white rounded-full absolute top-1" style={{ left: vibrationEnabled ? "28px" : "4px" }} />
            </button>
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-sm tracking-wider bg-gray-700 text-white hover:bg-gray-600 transition-colors">
          닫기
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

import { ACHIEVEMENTS } from "@/lib/useAchievements";

export function AchievementsModal({ 
  onClose, unlockedIds 
}: { 
  onClose: () => void; unlockedIds: Set<string>;
}) {
  const totalUnlocked = unlockedIds.size;
  const total = ACHIEVEMENTS.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.85, y: 40, opacity: 0 }}
        className="w-full max-w-sm max-h-[90dvh] flex flex-col bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">🏆 업적 (Achievements)</h2>
            <p className="text-yellow-400 text-xs font-mono font-bold mt-1">
              달성도: {totalUnlocked} / {total} ({Math.round(totalUnlocked/total*100)}%)
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center text-sm">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-2">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = unlockedIds.has(ach.id);
            return (
              <div key={ach.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isUnlocked ? "bg-yellow-500/10 border-yellow-500/30" : "bg-gray-800/40 border-gray-800"
              }`}>
                <div className={`text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                  isUnlocked ? "bg-white/10" : "bg-gray-800 grayscale opacity-40"
                }`}>
                  {ach.icon}
                </div>
                <div className="flex flex-col flex-1">
                  <span className={`text-sm font-bold ${isUnlocked ? "text-yellow-400" : "text-gray-500"}`}>
                    {ach.title}
                  </span>
                  <span className={`text-xs ${isUnlocked ? "text-gray-300" : "text-gray-600"}`}>
                    {ach.description}
                  </span>
                </div>
                {isUnlocked && <span className="text-yellow-500 text-sm">✅</span>}
                {!isUnlocked && <span className="text-gray-700 text-xs font-mono">🔒</span>}
              </div>
            );
          })}
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl font-black text-sm tracking-wider bg-gray-700 text-white hover:bg-gray-600 transition-colors">
          닫기
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
