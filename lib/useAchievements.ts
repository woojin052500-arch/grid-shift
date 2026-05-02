import { useState, useEffect, useCallback, useRef } from "react";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Score Achievements (10)
  { id: "score_100", title: "시작이 반이다", description: "100점 달성하기", icon: "🌱", requirement: 100 },
  { id: "score_500", title: "감 잡았어!", description: "500점 달성하기", icon: "👍", requirement: 500 },
  { id: "score_1000", title: "천 점 돌파", description: "1,000점 달성하기", icon: "🌟", requirement: 1000 },
  { id: "score_2000", title: "더블 밀레니엄", description: "2,000점 달성하기", icon: "✌️", requirement: 2000 },
  { id: "score_3000", title: "고득점자", description: "3,000점 달성하기", icon: "🔥", requirement: 3000 },
  { id: "score_5000", title: "블록 파괴자", description: "5,000점 달성하기", icon: "💥", requirement: 5000 },
  { id: "score_10000", title: "만 점의 신", description: "10,000점 달성하기", icon: "👑", requirement: 10000 },
  { id: "score_20000", title: "그리드 마스터", description: "20,000점 달성하기", icon: "⚡", requirement: 20000 },
  { id: "score_50000", title: "초월자", description: "50,000점 달성하기", icon: "🌌", requirement: 50000 },
  { id: "score_100000", title: "신화적 존재", description: "100,000점 달성하기", icon: "💫", requirement: 100000 },

  // Combo Achievements (10)
  { id: "combo_2", title: "더블", description: "2연속 콤보 달성", icon: "2️⃣", requirement: 2 },
  { id: "combo_3", title: "트리플", description: "3연속 콤보 달성", icon: "3️⃣", requirement: 3 },
  { id: "combo_5", title: "콤보 러시", description: "5연속 콤보 달성", icon: "🥊", requirement: 5 },
  { id: "combo_7", title: "럭키 세븐", description: "7연속 콤보 달성", icon: "🎰", requirement: 7 },
  { id: "combo_10", title: "콤보 마스터", description: "10연속 콤보 달성", icon: "🌪️", requirement: 10 },
  { id: "combo_15", title: "멈출 수 없어", description: "15연속 콤보 달성", icon: "🚀", requirement: 15 },
  { id: "combo_20", title: "무한 콤보", description: "20연속 콤보 달성", icon: "♾️", requirement: 20 },
  { id: "combo_30", title: "신의 경지", description: "30연속 콤보 달성", icon: "🌠", requirement: 30 },
  { id: "combo_50", title: "버그 아님?", description: "50연속 콤보 달성", icon: "👾", requirement: 50 },
  { id: "combo_100", title: "전설의 콤보", description: "100연속 콤보 달성", icon: "🏆", requirement: 100 },

  // Fever Mode Achievements (5)
  { id: "fever_1", title: "불타오르네", description: "피버 모드 최초 발동", icon: "🔥", requirement: 1 },
  { id: "fever_5", title: "피버 중독자", description: "피버 모드 누적 5회 발동", icon: "🌡️", requirement: 5 },
  { id: "fever_10", title: "뜨거운 열기", description: "피버 모드 누적 10회 발동", icon: "🌋", requirement: 10 },
  { id: "fever_50", title: "피버 마스터", description: "피버 모드 누적 50회 발동", icon: "🎇", requirement: 50 },
  { id: "fever_100", title: "영원한 불꽃", description: "피버 모드 누적 100회 발동", icon: "☀️", requirement: 100 },

  // Swipe & Play Achievements (5)
  { id: "swipe_1", title: "첫 걸음", description: "첫 번째 스와이프", icon: "👆", requirement: 1 },
  { id: "swipe_500", title: "손가락 체조", description: "누적 500번 스와이프", icon: "💪", requirement: 500 },
  { id: "swipe_5000", title: "지문 소멸", description: "누적 5,000번 스와이프", icon: "🤚", requirement: 5000 },
  { id: "play_1", title: "새로운 도전자", description: "첫 게임 완료", icon: "🎮", requirement: 1 },
  { id: "play_10", title: "그리드 러버", description: "누적 10번 게임 완료", icon: "❤️", requirement: 10 },
];

export interface GameStats {
  score: number;
  maxCombo: number;
  feverCount: number;
  swipeCount: number;
  playCount: number;
}

export function useAchievements() {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
  const globalStats = useRef({ feverCount: 0, swipeCount: 0, playCount: 0 });
  
  // Load initial stats
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gridshift_achievements");
      if (saved) setUnlockedIds(new Set(JSON.parse(saved)));

      const savedStats = localStorage.getItem("gridshift_stats");
      if (savedStats) globalStats.current = JSON.parse(savedStats);
    } catch {}
  }, []);

  const saveUnlocked = useCallback((newIds: Set<string>) => {
    setUnlockedIds(newIds);
    localStorage.setItem("gridshift_achievements", JSON.stringify([...newIds]));
  }, []);

  const queueToast = useCallback((achievement: Achievement) => {
    setToastQueue(prev => [...prev, achievement]);
  }, []);

  const shiftToast = useCallback(() => {
    setToastQueue(prev => prev.slice(1));
  }, []);

  // Update global stats and check
  const checkAchievements = useCallback((currentStats: Partial<GameStats>, isGameOver: boolean = false) => {
    const combinedStats = {
      score: currentStats.score || 0,
      maxCombo: currentStats.maxCombo || 0,
      feverCount: globalStats.current.feverCount + (currentStats.feverCount || 0),
      swipeCount: globalStats.current.swipeCount + (currentStats.swipeCount || 0),
      playCount: globalStats.current.playCount + (isGameOver ? 1 : 0),
    };

    if (isGameOver) {
      globalStats.current = {
        feverCount: combinedStats.feverCount,
        swipeCount: combinedStats.swipeCount,
        playCount: combinedStats.playCount,
      };
      localStorage.setItem("gridshift_stats", JSON.stringify(globalStats.current));
    }
    
    let newlyUnlocked = false;
    const newUnlockedIds = new Set(unlockedIds);

    ACHIEVEMENTS.forEach(ach => {
      if (!newUnlockedIds.has(ach.id)) {
        let conditionMet = false;
        if (ach.id.startsWith("score_") && combinedStats.score >= ach.requirement) conditionMet = true;
        if (ach.id.startsWith("combo_") && combinedStats.maxCombo >= ach.requirement) conditionMet = true;
        if (ach.id.startsWith("fever_") && combinedStats.feverCount >= ach.requirement) conditionMet = true;
        if (ach.id.startsWith("swipe_") && combinedStats.swipeCount >= ach.requirement) conditionMet = true;
        if (ach.id.startsWith("play_") && combinedStats.playCount >= ach.requirement) conditionMet = true;

        if (conditionMet) {
          newUnlockedIds.add(ach.id);
          newlyUnlocked = true;
          queueToast(ach);
        }
      }
    });

    if (newlyUnlocked) {
      saveUnlocked(newUnlockedIds);
    }
  }, [unlockedIds, saveUnlocked, queueToast]);

  return { unlockedIds, toastQueue, shiftToast, checkAchievements };
}
