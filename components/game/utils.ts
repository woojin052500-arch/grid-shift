import { Block, Color, COLORS, COLOR_EMOJI, GRID_SIZE, TutorialTarget } from "./types";

export function genId() { return Math.random().toString(36).substr(2, 9) + Date.now(); }

export function countryFlag(code: string) {
  if (!code || code.length !== 2) return "🌐";
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function getCountryCode() {
  try { const p = (navigator.language || "en-US").split("-"); return p.length > 1 ? p[p.length - 1].toUpperCase() : "US"; }
  catch { return "KR"; }
}

export function buildShareText(playerName: string, score: number, maxCombo: number) {
  const colorSeq: Color[] = ["red","blue","green","yellow","purple","purple","yellow","green","blue","red"];
  const row1 = colorSeq.slice(0, 5).map(c => COLOR_EMOJI[c]).join("");
  const row2 = colorSeq.slice(5).map(c => COLOR_EMOJI[c]).join("");
  const scoreEmoji = score > 800 ? "🔥" : score > 400 ? "⭐" : "💀";
  return [`🎮 GRID SHIFT ${scoreEmoji}`, ``, row1, row2, ``, `👤 ${playerName}`, `💯 점수: ${score.toLocaleString()}`, maxCombo > 0 ? `⚡ 최대 콤보: x${maxCombo}` : "", ``, `지금 도전해보세요!`, `https://grid-shift-iota.vercel.app`].filter(l => l !== undefined).join("\n");
}

export function createsImmediateMatch(grid: Block[][], r: number, c: number, block: Block): boolean {
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

export function createRandomGrid(): Block[][] {
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

export function shiftRow(grid: Block[][], rowIdx: number, dir: number): Block[][] {
  const ng = grid.map(row => [...row]);
  const row = ng[rowIdx];
  if (dir === 1) { const last = row.pop()!; row.unshift(last); }
  else { const first = row.shift()!; row.push(first); }
  ng[rowIdx] = row; return ng;
}

export function shiftCol(grid: Block[][], colIdx: number, dir: number): Block[][] {
  const ng = grid.map(row => [...row]);
  const col = ng.map(row => row[colIdx]);
  if (dir === 1) { const last = col.pop()!; col.unshift(last); }
  else { const first = col.shift()!; col.push(first); }
  col.forEach((val, i) => { ng[i][colIdx] = val; });
  return ng;
}

export type BlastResult = {
  squareCells: Set<string>;
  lineCells: Set<string>;
};

export function findAllBlasts(grid: Block[][]): BlastResult {
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

export function findBlastsSimple(grid: Block[][]): Set<string> {
  return findAllBlasts(grid).squareCells;
}

export function findTutorialSwipeTarget(grid: Block[][]): TutorialTarget {
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

export function removeBlasted(grid: Block[][], blasted: Set<string>): (Block | null)[][] {
  return grid.map((row, r) => row.map((cell, c) => blasted.has(`${r},${c}`) ? null : cell));
}

export function applyGravity(grid: (Block | null)[][], currentCombo: number): Block[][] {
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
