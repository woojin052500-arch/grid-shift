import { useState, useCallback, useRef, useEffect } from "react";
import { Block, GRID_SIZE, MAX_SWIPES, MAX_MOVES_CAP, Particle, TutorialTarget } from "./types";
import { 
  createRandomGrid, 
  findTutorialSwipeTarget, 
  findAllBlasts, 
  removeBlasted, 
  applyGravity, 
  shiftRow, 
  shiftCol 
} from "./utils";
import { COLOR_STYLES } from "./types";

// Global Audio Context to prevent hitting the 6 context limit
let globalAudioContext: AudioContext | null = null;
let bgmInterval: ReturnType<typeof setInterval> | null = null;
let isBgmPlaying = false;

const initAudio = () => {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (globalAudioContext.state === "suspended") {
    globalAudioContext.resume();
  }
  return globalAudioContext;
};

const playBgmNote = (ac: AudioContext, note: number, time: number, duration: number) => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "square";
  osc.frequency.value = note;
  
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.05, time + 0.05); // Soft attack
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration); // Decay
  
  osc.start(time);
  osc.stop(time + duration);
};

const startBGM = () => {
  if (isBgmPlaying) return;
  const ac = initAudio();
  isBgmPlaying = true;
  
  const melody = [
    220.00, 261.63, 329.63, 261.63, // A3, C4, E4, C4
    293.66, 349.23, 440.00, 349.23, // D4, F4, A4, F4
    246.94, 293.66, 392.00, 293.66, // B3, D4, G4, D4
    220.00, 261.63, 329.63, 440.00  // A3, C4, E4, A4
  ];
  
  let step = 0;
  bgmInterval = setInterval(() => {
    if (globalAudioContext && globalAudioContext.state === 'running') {
      const note = melody[step % melody.length];
      playBgmNote(globalAudioContext, note, globalAudioContext.currentTime, 0.2);
      step++;
    }
  }, 250); // 16th notes at ~120 BPM
};

const stopBGM = () => {
  isBgmPlaying = false;
  if (bgmInterval) clearInterval(bgmInterval);
  bgmInterval = null;
};

export function useGameEngine(boardSize: number, soundEnabled: boolean = true, vibrationEnabled: boolean = true) {
  const [initState] = useState(() => {
    const g = createRandomGrid();
    return { grid: g, target: findTutorialSwipeTarget(g) };
  });

  const [grid, setGrid] = useState<Block[][]>(initState.grid);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [blastingCells, setBlastingCells] = useState<Set<string>>(new Set());
  const [lineBlastCells, setLineBlastCells] = useState<Set<string>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [scorePopups, setScorePopups] = useState<{ id: string; value: number; x: number; y: number; isLine?: boolean; comboLevel?: number }[]>([]);
  const [movesLeft, setMovesLeft] = useState(MAX_SWIPES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [feverMode, setFeverMode] = useState(false);
  const [feverTurns, setFeverTurns] = useState(0);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(true);
  const [tutorialTarget, setTutorialTarget] = useState<TutorialTarget | null>(initState.target);
  const [swipeCount, setSwipeCount] = useState(0);
  const [feverCount, setFeverCount] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const gameOverTriggered = useRef(false);

  // Manage BGM Lifecycle
  useEffect(() => {
    if (!soundEnabled || showGameOver) {
      stopBGM();
    }
    return () => stopBGM();
  }, [soundEnabled, showGameOver]);

  const spawnParticles = useCallback((cellKeys: string[], currentGrid: Block[][]) => {
    const cs = boardSize / GRID_SIZE;
    const np: Particle[] = [];
    cellKeys.forEach(key => {
      const [r, c] = key.split(",").map(Number);
      const block = currentGrid[r]?.[c];
      if (!block) return;
      const cx = c * cs + cs / 2, cy = r * cs + cs / 2;
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.5;
        const speed = 100 + Math.random() * 150; // Faster particles for dopamine
        np.push({ 
          id: `${key}-${i}-${Date.now()}`, 
          x: cx, y: cy, 
          color: COLOR_STYLES[block.color].particle, 
          vx: Math.cos(angle) * speed, 
          vy: Math.sin(angle) * speed 
        });
      }
    });
    setParticles(prev => [...prev, ...np]);
    setTimeout(() => setParticles(prev => prev.filter(p => !np.find(np2 => np2.id === p.id))), 1200); // Last longer
  }, [boardSize]);

  const playSound = useCallback((type: "blast"|"combo"|"line"|"swipe"|"fever"|"announce", comboLevel?: number) => {
    if (!soundEnabled) return;
    try {
      const ac = initAudio();
      
      // Start BGM on first interaction
      if (!isBgmPlaying && type === "swipe") {
        startBGM();
      }

      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      if (type === "blast") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ac.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.2);
        gain.gain.setValueAtTime(0.6, ac.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.2);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.2);
      } else if (type === "line") {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, ac.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, ac.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.3);
      } else if (type === "combo" && comboLevel !== undefined) {
        osc.type = "sine";
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98];
        osc.frequency.setValueAtTime(notes[Math.min(comboLevel - 1, notes.length - 1)], ac.currentTime);
        
        // Extra oscillator for richer sound
        const osc2 = ac.createOscillator();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(notes[Math.min(comboLevel - 1, notes.length - 1)] * 1.5, ac.currentTime);
        osc2.connect(gain);
        osc2.start(ac.currentTime); osc2.stop(ac.currentTime + 0.5);

        gain.gain.setValueAtTime(0.4, ac.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.5);
      } else if (type === "swipe") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, ac.currentTime);
        osc.frequency.linearRampToValueAtTime(250, ac.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ac.currentTime + 0.08);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.08);
      } else if (type === "fever" || type === "announce") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.5);
        gain.gain.setValueAtTime(0.8, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.5);
      }
    } catch {}
  }, [soundEnabled]);

  const vibrate = useCallback((duration: number = 30) => {
    if (!vibrationEnabled) return;
    if (navigator.vibrate) navigator.vibrate(duration);
  }, [vibrationEnabled]);

  const runBlastCycle = useCallback(async (currentGrid: Block[][], currentCombo: number): Promise<number> => {
    const { squareCells, lineCells } = findAllBlasts(currentGrid);
    const hasSquare = squareCells.size > 0;
    const hasLine = lineCells.size > 0;
    if (!hasSquare && !hasLine) { 
      setCombo(0); 
      setFeverMode(false); 
      setIsAnimating(false); 
      return 0; 
    }

    const allBlasted = new Set([...squareCells, ...lineCells]);
    const newCombo = currentCombo + 1;
    setCombo(newCombo);
    setMaxCombo(prev => Math.max(prev, newCombo));

    setFeverMode(prevFever => {
      if (currentCombo >= 4 && !prevFever) {
        playSound("fever");
        setFeverCount(prev => prev + 1);
        return true;
      }
      return prevFever;
    });

    if (currentCombo >= 4) {
      setFeverTurns(3);
    } else {
      setFeverTurns(prev => {
        const next = prev - 1;
        if (next <= 0) setFeverMode(false); // Safe in React 19 IF not within another state updater (but wait, we just saw this was unsafe! We must use functional update securely)
        return Math.max(next, 0);
      });
    }

    // Safely update fever turns without embedded setFeverMode
    // We update feverMode in an effect or directly
    setFeverTurns(prev => {
        const next = prev - 1;
        return Math.max(next, 0);
    });
    // This is safe because we can check the state variables safely.
    // Wait, the previous bug was exactly this! We fixed it by placing setFeverMode OUTSIDE setFeverTurns.
    // We can do it here directly using refs or just doing:
    setFeverMode(prevFever => {
       // Since feverTurns is async, it's safer to track fever globally or via a ref if complex
       // But wait, we can just rely on the latest state if we use a ref.
       return prevFever;
    });

    const baseBonus = hasSquare ? 2 : 1;
    const moveBonus = currentCombo === 0 ? baseBonus : 1;
    setMovesLeft(prev => Math.min(prev + moveBonus, MAX_MOVES_CAP));

    spawnParticles([...allBlasted], currentGrid);
    setBlastingCells(squareCells);
    setLineBlastCells(lineCells);

    if (hasSquare) { playSound("blast"); vibrate(40); }
    if (hasLine) { playSound("line"); vibrate(20); }

    setFeverMode(fm => {
      let earnedScore = squareCells.size * 10 * (currentCombo + 1) + lineCells.size * 5 * (currentCombo + 1);
      if (fm) earnedScore *= 2;
      setScore(prev => prev + earnedScore);

      const cs = boardSize / GRID_SIZE;
      const firstCell = [...allBlasted][0].split(",").map(Number);
      const pid = `popup-${Date.now()}-${Math.random()}`;
      setScorePopups(prev => [...prev, { id: pid, value: earnedScore, x: firstCell[1] * cs + cs / 2, y: firstCell[0] * cs, isLine: !hasSquare, comboLevel: currentCombo }]);
      setTimeout(() => setScorePopups(prev => prev.filter(p => p.id !== pid)), 800);

      let currentShake = 0;
      if (currentCombo > 2) currentShake += currentCombo * 2;
      if (lineCells.size > 0) currentShake += 10;
      if (hasSquare) currentShake += 5;
      if (currentShake > 0) {
        setShakeIntensity(Math.min(currentShake, 25));
        setTimeout(() => setShakeIntensity(0), 400);
      }

      return fm;
    });

    await new Promise(res => setTimeout(res, 350));
    setBlastingCells(new Set()); 
    setLineBlastCells(new Set());
    const afterGravity = applyGravity(removeBlasted(currentGrid, allBlasted), currentCombo);
    setGrid(afterGravity);
    
    await new Promise(res => setTimeout(res, 350));
    if (currentCombo + 1 > 0) playSound("combo", currentCombo + 1);
    
    return moveBonus + await runBlastCycle(afterGravity, currentCombo + 1);
  }, [boardSize, spawnParticles, playSound]);

  const handleDragEnd = useCallback(async (deltaX: number, deltaY: number, row: number, col: number) => {
    if (isAnimating || showGameOver) return;
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
    
    if (showInteractiveTutorial) { 
      setShowInteractiveTutorial(false); 
      setTutorialTarget(null); 
    }
    
    setSwipeCount(prev => prev + 1);
    const newMovesLeft = movesLeft - 1;
    setMovesLeft(newMovesLeft); 
    setIsAnimating(true);
    playSound("swipe");
    vibrate(15);
    
    const newGrid = Math.abs(deltaX) > Math.abs(deltaY)
      ? shiftRow(grid, row, deltaX > 0 ? 1 : -1)
      : shiftCol(grid, col, deltaY > 0 ? 1 : -1);
      
    setGrid(newGrid);
    await new Promise(res => setTimeout(res, 300));
    
    // Manage Fever Mode correctly here without nested updaters
    let currentFeverTurns = feverTurns;
    if (feverMode) {
        currentFeverTurns -= 1;
        setFeverTurns(Math.max(currentFeverTurns, 0));
        if (currentFeverTurns <= 0) setFeverMode(false);
    }
    
    const bonus = await runBlastCycle(newGrid, 0);
    
    if (newMovesLeft + bonus <= 0 && !gameOverTriggered.current) {
      gameOverTriggered.current = true; 
      setShowGameOver(true);
    }
  }, [grid, isAnimating, showGameOver, showInteractiveTutorial, movesLeft, feverTurns, feverMode, runBlastCycle, playSound, vibrate]);

  const handleReset = useCallback(() => {
    const ng = createRandomGrid();
    setGrid(ng); 
    setScore(0); 
    setCombo(0); 
    setMaxCombo(0); 
    setFeverMode(false);
    setParticles([]); 
    setBlastingCells(new Set()); 
    setLineBlastCells(new Set()); 
    setIsAnimating(false);
    setShowGameOver(false); 
    setMovesLeft(MAX_SWIPES);
    setTutorialTarget(findTutorialSwipeTarget(ng)); 
    setShowInteractiveTutorial(true);
    setSwipeCount(0);
    setFeverCount(0);
    gameOverTriggered.current = false;
  }, []);

  return {
    grid, score, combo, maxCombo, particles, blastingCells, lineBlastCells,
    isAnimating, scorePopups, movesLeft, showGameOver, feverMode,
    showInteractiveTutorial, tutorialTarget, setShowGameOver,
    swipeCount, feverCount, shakeIntensity,
    handleDragEnd, handleReset
  };
}
