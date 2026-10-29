const PLAYERS = { WHITE: 'white', BLACK: 'black' };
const PIECE_TYPES = {
  FISH: 'fish',
  SHARK_SMALL: 'shark_small',
  SHARK_BIG_60: 'shark_big_60',
  SHARK_BIG_120: 'shark_big_120',
  SHARK_BIG_180: 'shark_big_180',
};

const INITIAL_SUPPLY = {
  [PLAYERS.WHITE]: { fish: 14, shark_small: 3, shark_big_60: 1, shark_big_120: 1, shark_big_180: 1 },
  [PLAYERS.BLACK]: { fish: 14, shark_small: 3, shark_big_60: 1, shark_big_120: 1, shark_big_180: 1 },
};
const WINNING_CHAIN = 10;

// --- GEOMETRIA HEXAGONAL ---
const LAYOUT_SIZE = 60;
const DRAW_SIZE = 56;
const HEX_WIDTH = Math.sqrt(3) * DRAW_SIZE;
const HEX_HEIGHT = 2 * DRAW_SIZE;
const hexToPixel = (q, r) => ({ x: LAYOUT_SIZE * Math.sqrt(3) * (q + r/2), y: LAYOUT_SIZE * (3/2) * r });

const generateBoardCells = () => {
  const cells = [];
  const rows = [{ r: 0, qMin: -1, count: 3 }, { r: 1, qMin: -2, count: 4 }, { r: 2, qMin: -3, count: 5 }, { r: 3, qMin: -4, count: 6 }, { r: 4, qMin: -4, count: 5 }, { r: 5, qMin: -4, count: 4 }, { r: 6, qMin: -4, count: 3 }];
  rows.forEach(({ r, qMin, count }) => { for (let i = 0; i < count; i++) cells.push({ q: qMin + i, r: r, type: null, owner: null }); });
  return cells;
};
const getNeighbors = (q, r) => [{dq: 1, dr: 0}, {dq: 1, dr: -1}, {dq: 0, dr: -1}, {dq: -1, dr: 0}, {dq: -1, dr: 1}, {dq: 0, dr: 1}].map(d => ({ q: q + d.dq, r: r + d.dr }));
const BOARD_CENTER = { q: -2, r: 3 };
const getDistance = (q1, r1, q2, r2) => (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;

const calculateChains = (currentBoard) => {
    const visited = new Set();
    const cellMap = new Map();
    currentBoard.forEach(c => cellMap.set(`${c.q},${c.r}`, c));

    const getComponent = (startQ, startR, player) => {
      const stack = [{q: startQ, r: startR}];
      const componentCells = [`${startQ},${startR}`];
      const seen = new Set([`${startQ},${startR}`]);
      let size = 0;
      let sharksInChain = 0;

      while(stack.length){
        const {q, r} = stack.pop();
        const cell = cellMap.get(`${q},${r}`);
        if(cell) {
          size++;
          if (cell.type && cell.type.includes('shark')) sharksInChain++;
        }

        getNeighbors(q, r).forEach(n => {
          const key = `${n.q},${n.r}`;
          const nCell = cellMap.get(key);
          if(nCell && nCell.owner === player && !seen.has(key)) {
            seen.add(key);
            componentCells.push(key);
            stack.push(n);
          }
        });
      }
      return { size, sharks: sharksInChain, cells: componentCells };
    };

    let maxChains = {
      [PLAYERS.WHITE]: { size: 0, sharks: 0 },
      [PLAYERS.BLACK]: { size: 0, sharks: 0 }
    };
    let winCells = [];

    currentBoard.forEach(cell => {
      if(cell.owner && !visited.has(`${cell.q},${cell.r}`)) {
        const { size, sharks, cells } = getComponent(cell.q, cell.r, cell.owner);

        if (size > maxChains[cell.owner].size || (size === maxChains[cell.owner].size && sharks > maxChains[cell.owner].sharks)) {
          maxChains[cell.owner] = { size, sharks };
        }

        cells.forEach(k => visited.add(k));

        if (size >= WINNING_CHAIN) {
          winCells = cells;
        }
      }
    });

    return { maxChains, winCells };
};


const SHARK_TYPES = Object.values(PIECE_TYPES).filter(type => type !== PIECE_TYPES.FISH);

const getActiveMouths = (type, rotation) => {
  const offsets = { shark_small: [0], shark_big_60: [0, 1], shark_big_120: [0, 2], shark_big_180: [0, 3] };
  return (offsets[type] || []).map(offset => (rotation + offset) % 6);
};

const getSharkCaptures = (board, player, q, r, mouths) => {
  const target = board.find(cell => cell.q === q && cell.r === r);
  if (!target || target.owner === player || target.type?.includes('shark')) return [];
  const neighbors = getNeighbors(q, r);
  const positions = [{q, r}, ...mouths.map(direction => neighbors[direction]).filter(Boolean)];
  return board.filter(cell => cell.type === PIECE_TYPES.FISH && cell.owner !== player &&
    positions.some(position => position.q === cell.q && position.r === cell.r));
};

const canPlayerMove = (player, board, supply) => {
  if (supply[player].fish >= 2 && board.some(cell => !cell.type &&
    getNeighbors(cell.q, cell.r).some(neighbor => board.some(other =>
      other.q === neighbor.q && other.r === neighbor.r && !other.type)))) return true;
  return SHARK_TYPES.some(type => supply[player][type] > 0 && board.some(cell =>
    Array.from({length: 6}, (_, rotation) => rotation).some(rotation =>
      getSharkCaptures(board, player, cell.q, cell.r, getActiveMouths(type, rotation)).length > 0)));
};

// Captures determine legality; positional scoring only ranks legal moves.
const chooseSharkMove = (board, supply, player, minEaten = 1) => {
  let bestMove = null;
  for (const sharkType of SHARK_TYPES) {
    if (supply[player][sharkType] <= 0) continue;
    for (const cell of board) {
      for (let rotation = 0; rotation < 6; rotation++) {
        const mouths = getActiveMouths(sharkType, rotation);
        const eatenCount = getSharkCaptures(board, player, cell.q, cell.r, mouths).length;
        if (eatenCount < Math.max(1, minEaten)) continue;
        const score = eatenCount + (cell.type === PIECE_TYPES.FISH ? 0.5 : 0) -
          getDistance(cell.q, cell.r, BOARD_CENTER.q, BOARD_CENTER.r) * 0.1;
        if (!bestMove || score > bestMove.score) {
          bestMove = {type: 'shark', q: cell.q, r: cell.r, sharkType, mouths, eatenCount, score};
        }
      }
    }
  }
  return bestMove;
};

const compareChains = (white, black) => {
  if (white.size !== black.size) return {winner: white.size > black.size ? PLAYERS.WHITE : PLAYERS.BLACK, reason: 'tie_reason_length'};
  if (white.sharks !== black.sharks) return {winner: white.sharks > black.sharks ? PLAYERS.WHITE : PLAYERS.BLACK, reason: 'tie_reason_sharks'};
  return {winner: 'DRAW', reason: 'tie_reason_draw'};
};

export { PLAYERS, PIECE_TYPES, INITIAL_SUPPLY, WINNING_CHAIN, HEX_WIDTH, HEX_HEIGHT,
  hexToPixel, generateBoardCells, getNeighbors, calculateChains, getActiveMouths,
  getSharkCaptures, canPlayerMove, chooseSharkMove, compareChains };
