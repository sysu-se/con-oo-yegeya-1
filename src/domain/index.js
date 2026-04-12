// export class Sudoku {
//   constructor(grid) {
//     this.grid = JSON.parse(JSON.stringify(grid));
//   }

//   getGrid() {
//     return JSON.parse(JSON.stringify(this.grid));
//   }

//   guess(move) {
//     const { row, col, value } = move;
//     if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
//     if (value < 0 || value > 9) return false;

//     this.grid[row][col] = value;
//     return true;
//   }

//   isSolved() {
//     for (let r = 0; r < 9; r++) {
//       for (let c = 0; c < 9; c++) {
//         if (this.grid[r][c] === 0 || this.grid[r][c] === null) return false;
//       }
//     }
//     return true;
//   }

//   clone() {
//     return new Sudoku(this.getGrid());
//   }

//   toString() {
//     return this.grid.map(row => row.join(' ')).join('\n');
//   }

//   toJSON() {
//     return { grid: this.getGrid() };
//   }
// }

// export class Game {
//   constructor({ sudoku }) {
//     this.currentSudoku = sudoku;
//     this.history = [];
//     this.future = [];
//   }

//   getSudoku() {
//     return this.currentSudoku;
//   }

//   guess(move) {
//     this.history.push(this.currentSudoku.clone());
//     this.future = [];
//     return this.currentSudoku.guess(move);
//   }

//   undo() {
//     if (!this.canUndo()) return;
//     this.future.push(this.currentSudoku.clone());
//     this.currentSudoku = this.history.pop();
//   }

//   redo() {
//     if (!this.canRedo()) return;
//     this.history.push(this.currentSudoku.clone());
//     this.currentSudoku = this.future.pop();
//   }

//   canUndo() {
//     return this.history.length > 0;
//   }

//   canRedo() {
//     return this.future.length > 0;
//   }

//   getStateSnapshot() {
//     return {
//       grid: this.currentSudoku.getGrid(),
//       canUndo: this.canUndo(),
//       canRedo: this.canRedo(),
//       isSolved: this.currentSudoku.isSolved()
//     };
//   }

//   toJSON() {
//     return {
//       sudoku: this.currentSudoku.toJSON(),
//       history: this.history.map(h => h.toJSON()),
//       future: this.future.map(f => f.toJSON())
//     };
//   }
// }

// export function createSudoku(input) {
//   return new Sudoku(input);
// }

// export function createGame({ sudoku }) {
//   return new Game({ sudoku });
// }

export class Sudoku {
  constructor(grid) {
    this.grid = JSON.parse(JSON.stringify(grid));
  }

  getGrid() {
    return JSON.parse(JSON.stringify(this.grid));
  }

  guess(move) {
    const { row, col, value } = move;
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
    if (value < 0 || value > 9) return false;

    this.grid[row][col] = value;
    return true;
  }

  isSolved() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 || this.grid[r][c] === null) return false;
      }
    }
    return true;
  }

  clone() {
    return new Sudoku(this.getGrid());
  }

  toString() {
    return this.grid.map(row => row.join(' ')).join('\n');
  }

  toJSON() {
    return { grid: this.getGrid() };
  }

  // 可选：Sudoku 也配一个工厂函数
  static fromJSON(json) {
    return new Sudoku(json.grid);
  }
}

export class Game {
  constructor({ sudoku }) {
    this.currentSudoku = sudoku;
    this.history = [];
    this.future = [];
  }

  getSudoku() {
    return this.currentSudoku;
  }

  guess(move) {
    this.history.push(this.currentSudoku.clone());
    this.future = [];
    return this.currentSudoku.guess(move);
  }

  undo() {
    if (!this.canUndo()) return;
    this.future.push(this.currentSudoku.clone());
    this.currentSudoku = this.history.pop();
  }

  redo() {
    if (!this.canRedo()) return;
    this.history.push(this.currentSudoku.clone());
    this.currentSudoku = this.future.pop();
  }

  canUndo() {
    return this.history.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  getStateSnapshot() {
    return {
      grid: this.currentSudoku.getGrid(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      isSolved: this.currentSudoku.isSolved()
    };
  }

  toJSON() {
    return {
      version: '1.0',
      currentSudoku: this.currentSudoku.toJSON(),
      history: this.history.map(s => s.toJSON()),
      future: this.future.map(s => s.toJSON())
    };
  }

  static fromJSON(json) {
    if (!json || !json.currentSudoku) {
      throw new Error('Invalid game state JSON');
    }

    const sudoku = Sudoku.fromJSON(json.currentSudoku);
    const game = new Game({ sudoku });

    game.history = (json.history || []).map(s => Sudoku.fromJSON(s));
    game.future = (json.future || []).map(s => Sudoku.fromJSON(s));

    return game;
  }

  serialize() {
    return JSON.stringify(this.toJSON());
  }

  static deserialize(str) {
    const json = JSON.parse(str);
    return Game.fromJSON(json);
  }
}

// ------------------------------
// 【新增】工厂函数（方便测试和使用）
// ------------------------------

export function createSudoku(input) {
  return new Sudoku(input);
}

export function createSudokuFromJSON(json) {
  return Sudoku.fromJSON(json);
}

export function createGame({ sudoku }) {
  return new Game({ sudoku });
}

export function createGameFromJSON(json) {
  return Game.fromJSON(json);
}
