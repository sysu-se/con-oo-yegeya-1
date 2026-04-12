import { BOX_SIZE, SUDOKU_SIZE } from '../node_modules/@sudoku/constants.js';
import { generateSudoku, solveSudoku } from '../node_modules/@sudoku/sudoku.js';
import { derived, writable } from 'svelte/store';
import { hints } from '../node_modules/@sudoku/stores/hints.js';
import { createSudoku, createGame, createGameFromJSON } from '../domain';

// ------------------------------
// 序列化存储配置
// ------------------------------
const STORAGE_KEY = 'sudoku-game-state';

// ------------------------------
// 内部状态管理
// ------------------------------
let _initialGrid = Array(9).fill(null).map(() => Array(9).fill(0));
let _fixed = Array(9).fill(null).map(() => Array(9).fill(false));

// 领域对象实例
let sudoku = createSudoku(_initialGrid);
let game = createGame({ sudoku });

// ------------------------------
// Svelte Store 适配层
// ------------------------------
const { subscribe: gameSubscribe, set: gameSet } = writable(game.getStateSnapshot());

function sync() {
  gameSet(game.getStateSnapshot());
  saveState();
}

function _updateInternalStateFromGame() {
  const initialGrid = game.history.length > 0
    ? game.history[0].getGrid()
    : game.getSudoku().getGrid();

  _initialGrid = initialGrid.map(row => row.slice());
  _fixed = _initialGrid.map(row => row.map(cell => cell !== 0));
}

// ------------------------------
// 序列化/恢复逻辑
// ------------------------------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, game.serialize());
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

function tryRestoreFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const json = JSON.parse(saved);
      if (json.version === '1.0') {
        game = createGameFromJSON(json);
        _updateInternalStateFromGame();
        sync();
        return true;
      }
    }
  } catch (e) {
    console.warn('Failed to restore from localStorage:', e);
  }
  return false;
}

const STATE_CODE_PREFIX = 'SSTATE:';

function base64UrlEncode(value) {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value) {
  value = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (value.length % 4 !== 0) {
    value += '=';
  }

  return atob(value);
}

export function getShareableCode() {
  return `${STATE_CODE_PREFIX}${base64UrlEncode(game.serialize())}`;
}

export function isShareableCode(code) {
  if (!code) return false;
  if (code.includes('#')) {
    code = code.slice(code.lastIndexOf('#') + 1);
  }
  return code.startsWith(STATE_CODE_PREFIX);
}

export function restoreFromShareCode(code) {
  if (!code) return false;
  if (code.includes('#')) {
    code = code.slice(code.lastIndexOf('#') + 1);
  }
  if (!code.startsWith(STATE_CODE_PREFIX)) {
    return false;
  }
  try {
    const raw = code.slice(STATE_CODE_PREFIX.length);
    const decoded = base64UrlDecode(raw);
    const json = JSON.parse(decoded);
    game = createGameFromJSON(json);
    _updateInternalStateFromGame();
    sync();
    return true;
  } catch (e) {
    console.warn('Failed to restore from share code:', e);
    return false;
  }
}

export function tryRestoreFromHash(hash) {
  try {
    if (hash.startsWith('#')) {
      hash = hash.slice(1);
    }

    if (!hash) {
      return 'sencode';
    }

    let decoded = hash;
    try {
      decoded = decodeURIComponent(hash);
    } catch (e) {
      // ignore malformed encoding
    }

    if (decoded.includes('#')) {
      decoded = decoded.slice(decoded.lastIndexOf('#') + 1);
    }

    if (decoded.startsWith(STATE_CODE_PREFIX)) {
      const restored = restoreFromShareCode(decoded);
      return restored ? 'full-state' : 'sencode';
    }

    return 'sencode';
  } catch (e) {
    console.warn('Failed to restore from hash:', e);
    return 'sencode';
  }
}

// ------------------------------
// 导出的 Store 和方法
// ------------------------------
export const userGrid = {
  subscribe: derived(
    [{ subscribe: gameSubscribe }],
    ([$game]) => $game.grid
  ).subscribe,

  set: (pos, value) => {
    const { x, y } = pos;
    if (_fixed[y][x]) return;

    game.guess({ row: y, col: x, value });
    sync();
  },

  applyHint: (pos) => {
    hints.useHint();
    const { x, y } = pos;

    const currentGrid = game.getSudoku().getGrid();
    const solvedSudoku = solveSudoku(currentGrid);
    const hintValue = solvedSudoku[y][x];

    game.guess({ row: y, col: x, value: hintValue });
    sync();
  },
};

export const invalidCells = derived(userGrid, $userGrid => {
  const _invalidCells = [];

  const addInvalid = (x, y) => {
    const xy = x + ',' + y;
    if (!_invalidCells.includes(xy)) _invalidCells.push(xy);
  };

  for (let y = 0; y < SUDOKU_SIZE; y++) {
    for (let x = 0; x < SUDOKU_SIZE; x++) {
      const value = $userGrid[y][x];

      if (value) {
        for (let i = 0; i < SUDOKU_SIZE; i++) {
          if (i !== x && $userGrid[y][i] === value) {
            addInvalid(x, y);
          }
          if (i !== y && $userGrid[i][x] === value) {
            addInvalid(x, i);
          }
        }

        const startY = Math.floor(y / BOX_SIZE) * BOX_SIZE;
        const endY = startY + BOX_SIZE;
        const startX = Math.floor(x / BOX_SIZE) * BOX_SIZE;
        const endX = startX + BOX_SIZE;
        for (let row = startY; row < endY; row++) {
          for (let col = startX; col < endX; col++) {
            if (row !== y && col !== x && $userGrid[row][col] === value) {
              addInvalid(col, row);
            }
          }
        }
      }
    }
  }

  return _invalidCells;
}, []);

export function undo() {
  game.undo();
  sync();
}

export function redo() {
  game.redo();
  sync();
}

export const canUndo = derived(
  [{ subscribe: gameSubscribe }],
  ([$game]) => $game.canUndo
);

export const canRedo = derived(
  [{ subscribe: gameSubscribe }],
  ([$game]) => $game.canRedo
);

// ------------------------------
// 初始化
// ------------------------------
tryRestoreFromLocalStorage();