import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Block, COLOR_STYLES, COLOR_SYMBOL, GRID_SIZE, Particle, TutorialTarget } from "./types";

interface GameBoardProps {
  grid: Block[][];
  blastingCells: Set<string>;
  lineBlastCells: Set<string>;
  particles: Particle[];
  scorePopups: { id: string; value: number; x: number; y: number; isLine?: boolean; comboLevel?: number }[];
  colorBlindMode: boolean;
  showInteractiveTutorial: boolean;
  tutorialTarget: TutorialTarget | null;
  feverMode?: boolean;
  shakeIntensity?: number;
  onDragEnd: (deltaX: number, deltaY: number, row: number, col: number) => void;
  onBoardSizeChange?: (size: number) => void;
}

export function GameBoard({
  grid, blastingCells, lineBlastCells, particles, scorePopups,
  colorBlindMode, showInteractiveTutorial, tutorialTarget, feverMode, shakeIntensity = 0,
  onDragEnd, onBoardSizeChange
}: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; row: number; col: number } | null>(null);
  const [boardSize, setBoardSize] = useState(0);

  useEffect(() => { 
    if (boardRef.current) {
      const size = boardRef.current.getBoundingClientRect().width;
      setBoardSize(size);
      if (onBoardSizeChange) onBoardSizeChange(size);
    } 
  }, [onBoardSizeChange]);

  useEffect(() => {
    if (!boardRef.current) return;
    const obs = new ResizeObserver(entries => { 
      const e = entries[0]; 
      if (e) {
        setBoardSize(e.contentRect.width);
        if (onBoardSizeChange) onBoardSizeChange(e.contentRect.width);
      }
    });
    obs.observe(boardRef.current); 
    return () => obs.disconnect();
  }, [onBoardSizeChange]);

  const getCellSize = useCallback(() => boardSize > 0 ? boardSize / GRID_SIZE : 48, [boardSize]);

  const handleDragStart = (x: number, y: number, row: number, col: number) => {
    dragStart.current = { x, y, row, col };
  };

  const handleDragEndInternal = (endX: number, endY: number) => {
    if (!dragStart.current) return;
    const { x, y, row, col } = dragStart.current;
    dragStart.current = null;
    const deltaX = endX - x, deltaY = endY - y;
    onDragEnd(deltaX, deltaY, row, col);
  };

  return (
    <div className="w-[92vw] max-w-[420px] aspect-square relative">
      <motion.div ref={boardRef} 
        animate={
          shakeIntensity > 0 
            ? { x: [-shakeIntensity, shakeIntensity, -shakeIntensity, shakeIntensity, 0], y: [shakeIntensity, -shakeIntensity, shakeIntensity, -shakeIntensity, 0] }
            : feverMode ? { boxShadow: ["0px 0px 20px #ef4444", "0px 0px 40px #a855f7", "0px 0px 20px #ef4444"], scale: [1, 1.02, 1] } : { boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", scale: 1 }
        }
        transition={
          shakeIntensity > 0 ? { duration: 0.4, ease: "linear" } : feverMode ? { duration: 1, repeat: Infinity } : { duration: 0.3 }
        }
        className="relative w-full h-full bg-gray-900 rounded-2xl p-2 shadow-2xl touch-none"
        onMouseUp={e => handleDragEndInternal(e.clientX, e.clientY)} 
        onMouseLeave={() => { dragStart.current = null; }}>
        
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
            {scorePopups.map(popup => {
              const cl = popup.comboLevel || 0;
              const color = cl > 5 ? "text-red-400" : cl > 3 ? "text-yellow-400" : cl > 1 ? "text-green-300" : "text-white";
              const scaleMax = 1.3 + (cl * 0.1);
              return (
                <motion.div key={popup.id} 
                  initial={{ x: popup.x, y: popup.y, opacity: 1, scale: 0.5, rotate: (Math.random() - 0.5) * 20 }} 
                  animate={{ y: popup.y - 50 - (cl * 5), opacity: 0, scale: scaleMax, rotate: 0 }} 
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`absolute font-black pointer-events-none drop-shadow-xl ${color}`}
                  style={{ left: 0, top: 0, transform: "translate(-50%,-50%)", fontSize: `${Math.min(1.2 + cl * 0.1, 2.5)}rem`, textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
                  {popup.isLine ? "▬" : ""} +{popup.value}
                </motion.div>
              );
            })}
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
                onTouchEnd={e => { const t = e.changedTouches[0]; handleDragEndInternal(t.clientX, t.clientY); }}>
                
                {/* Block Content */}
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
      </motion.div>
    </div>
  );
}
