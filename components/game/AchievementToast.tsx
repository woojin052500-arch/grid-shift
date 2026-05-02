import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Achievement } from "@/lib/useAchievements";

export function AchievementToast({ 
  achievement, 
  onDismiss 
}: { 
  achievement: Achievement | null; 
  onDismiss: () => void; 
}) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  return (
    <div className="fixed bottom-10 left-0 w-full flex justify-center pointer-events-none z-[110] px-4">
      <AnimatePresence>
        {achievement && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex items-center gap-3 bg-gradient-to-r from-yellow-500/90 to-amber-600/90 backdrop-blur-md border border-yellow-400/50 shadow-[0_0_20px_rgba(234,179,8,0.4)] rounded-2xl px-5 py-3 max-w-sm w-full"
          >
            <div className="text-3xl shrink-0 drop-shadow-md bg-white/20 p-2 rounded-full">
              {achievement.icon}
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-yellow-100 text-[10px] font-black uppercase tracking-widest drop-shadow-sm">업적 달성!</span>
              <span className="text-white text-base font-black tracking-tight drop-shadow-md">
                {achievement.title}
              </span>
              <span className="text-yellow-100 text-xs mt-0.5 leading-tight">
                {achievement.description}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
