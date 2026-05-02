"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopScores, LeaderboardEntry } from "@/lib/supabase";

import { HomeScreen } from "./game/HomeScreen";
import { GameBoard } from "./game/GameBoard";
import { ScorePanel } from "./game/ScorePanel";
import { TutorialModal, LeaderboardModal, GameOverModal, SettingsModal, AchievementsModal } from "./game/Modals";
import { useGameEngine } from "./game/useGameEngine";
import { KakaoAd } from "./game/KakaoAd";
import { useSettings } from "@/lib/useSettings";
import { useAchievements } from "@/lib/useAchievements";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { AchievementToast } from "./game/AchievementToast";

export default function GridShift() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  if (!playerName) {
    return <HomeScreen onStart={setPlayerName} />;
  }

  return <GameScreen playerName={playerName} onGoHome={() => setPlayerName(null)} />;
}

function GameScreen({ playerName, onGoHome }: { playerName: string; onGoHome: () => void }) {
  const [boardSize, setBoardSize] = useState(0);
  const { soundEnabled, vibrationEnabled, toggleSound, toggleVibration } = useSettings();
  const engine = useGameEngine(boardSize, soundEnabled, vibrationEnabled);
  const { unlockedIds, toastQueue, shiftToast, checkAchievements } = useAchievements();
  usePushNotifications();
  
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState(false);

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

  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    const handleOpenAchievements = () => setShowAchievements(true);
    document.addEventListener("openSettings", handleOpenSettings);
    document.addEventListener("openAchievements", handleOpenAchievements);
    return () => {
      document.removeEventListener("openSettings", handleOpenSettings);
      document.removeEventListener("openAchievements", handleOpenAchievements);
    };
  }, []);

  // Sync game state to achievements
  useEffect(() => {
    checkAchievements({
      score: engine.score,
      maxCombo: engine.maxCombo,
      feverCount: engine.feverCount,
      swipeCount: engine.swipeCount,
    }, engine.showGameOver);
  }, [engine.score, engine.maxCombo, engine.feverCount, engine.swipeCount, engine.showGameOver, checkAchievements]);

  return (
    <motion.div className={`min-h-[100dvh] flex flex-col items-center justify-start pt-5 pb-4 select-none overflow-hidden ${engine.feverMode ? "bg-gradient-to-br from-red-900 via-purple-900 to-blue-900" : "bg-gray-950"}`}>
      <AnimatePresence>
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            onClose={() => setShowSettings(false)}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            toggleSound={toggleSound}
            toggleVibration={toggleVibration}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAchievements && (
          <AchievementsModal onClose={() => setShowAchievements(false)} unlockedIds={unlockedIds} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {engine.showGameOver && (
          <GameOverModal 
            score={engine.score} 
            playerName={playerName} 
            maxCombo={engine.maxCombo} 
            onSaveComplete={fetchLeaderboard} 
            onClose={engine.handleReset} 
            onViewLeaderboard={handleOpenLeaderboard} 
            onGoHome={onGoHome} 
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

      <ScorePanel 
        score={engine.score}
        combo={engine.combo}
        maxCombo={engine.maxCombo}
        movesLeft={engine.movesLeft}
        feverMode={engine.feverMode}
        colorBlindMode={colorBlindMode}
        onToggleColorBlind={() => setColorBlindMode(!colorBlindMode)}
        onShowTutorial={() => setShowTutorial(true)}
        onShowLeaderboard={handleOpenLeaderboard}
      />

      <GameBoard 
        grid={engine.grid}
        blastingCells={engine.blastingCells}
        lineBlastCells={engine.lineBlastCells}
        particles={engine.particles}
        scorePopups={engine.scorePopups}
        colorBlindMode={colorBlindMode}
        showInteractiveTutorial={engine.showInteractiveTutorial}
        tutorialTarget={engine.tutorialTarget}
        feverMode={engine.feverMode}
        shakeIntensity={engine.shakeIntensity}
        onDragEnd={engine.handleDragEnd}
        onBoardSizeChange={setBoardSize}
      />

      <KakaoAd />
      
      <AchievementToast 
        achievement={toastQueue[0] || null} 
        onDismiss={shiftToast} 
      />
    </motion.div>
  );
}
