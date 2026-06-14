import { PIECES, WALL_KICKS, Bag } from './pieces.js';

const COLS = 10;
const ROWS = 20;
const LOCK_DELAY_MS = 500;
const LOCK_RESET_MAX = 15;

export class Engine {
  constructor(scorer) {
    this.scorer = scorer;
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    this.bag = new Bag();
    this.nextPieces = [this.bag.next(), this.bag.next(), this.bag.next()];
    this.current = null;
    this.lastAction = null;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.gravityTimer = 0;
    this.gameOver = false;
    this.effects = [];  // pending visual effect events
    this._spawn();
  }

  _spawn() {
    const type = this.nextPieces.shift();
    this.nextPieces.push(this.bag.next());
    this.current = { type, x: 3, y: 0, rotation: 0 };
    this.lastAction = 'spawn';
    this.lockTimer = 0;
    this.lockResets = 0;
    if (!this._isValid(this.current)) {
      this.gameOver = true;
    }
  }

  _isValid({ type, x, y, rotation }) {
    const shape = PIECES[type][rotation];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c] !== 'X') continue;
        const nx = x + c;
        const ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && this.board[ny][nx]) return false;
      }
    }
    return true;
  }

  _isOnFloor() {
    return !this._isValid({ ...this.current, y: this.current.y + 1 });
  }

  tryMove(dx, dy) {
    const next = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (!this._isValid(next)) return false;
    this.current = next;
    this.lastAction = dy === 0 ? 'move' : 'gravity';
    if (dy === 0 && this._isOnFloor() && this.lockResets < LOCK_RESET_MAX) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    return true;
  }

  tryRotate(dir) {
    const nextRot = (this.current.rotation + (dir === 'cw' ? 1 : 3)) % 4;
    const key = `${this.current.rotation}->${nextRot}`;
    const kicks = (this.current.type === 'I' ? WALL_KICKS.I : WALL_KICKS.JLSTZ)[key] || [[0,0]];
    for (const [dx, dy] of kicks) {
      const next = { ...this.current, rotation: nextRot, x: this.current.x + dx, y: this.current.y + dy };
      if (this._isValid(next)) {
        this.current = next;
        this.lastAction = 'rotate';
        if (this._isOnFloor() && this.lockResets < LOCK_RESET_MAX) {
          this.lockTimer = 0;
          this.lockResets++;
        }
        return true;
      }
    }
    return false;
  }

  getGhostY() {
    let gy = this.current.y;
    while (this._isValid({ ...this.current, y: gy + 1 })) gy++;
    return gy;
  }

  softDrop() {
    if (!this.tryMove(0, 1)) return false;
    this.scorer.addDrop(1, false);
    this.lockTimer = 0;
    return true;
  }

  hardDrop() {
    const gy = this.getGhostY();
    const dropped = gy - this.current.y;
    this.current = { ...this.current, y: gy };
    this.lastAction = 'drop';
    this.scorer.addDrop(dropped, true);
    return this._lock();
  }

  _detectTSpin() {
    if (this.current.type !== 'T' || this.lastAction !== 'rotate') return null;
    const { x, y, rotation } = this.current;
    const cx = x + 1;
    const cy = y + 1;

    const filled = (r, c) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
      return this.board[r][c] !== null;
    };

    const corners = [
      filled(cy - 1, cx - 1), filled(cy - 1, cx + 1),
      filled(cy + 1, cx - 1), filled(cy + 1, cx + 1),
    ];
    const total = corners.filter(Boolean).length;

    // Front corners by rotation: 0=top, 1=right, 2=bottom, 3=left
    const frontIdx = [[0,1],[1,3],[2,3],[0,2]][rotation];
    const front = frontIdx.filter(i => corners[i]).length;

    if (total >= 3) return 'full';
    if (total === 2 && front === 2) return 'full';
    if (total === 2) return 'mini';
    return null;
  }

  _lock() {
    const { type, x, y, rotation } = this.current;
    const shape = PIECES[type][rotation];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c] !== 'X') continue;
        const nr = y + r;
        const nc = x + c;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          this.board[nr][nc] = type;
        }
      }
    }

    const tspinType = this._detectTSpin();

    const clearedRows = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== null)) clearedRows.push(r);
    }

    // Remove all cleared rows, then prepend empty rows
    const clearedSet = new Set(clearedRows);
    this.board = this.board.filter((_, i) => !clearedSet.has(i));
    while (this.board.length < ROWS) this.board.unshift(new Array(COLS).fill(null));

    const scoreResult = this.scorer.addLineClear(clearedRows.length, tspinType);
    this._spawn();

    return { linesCleared: clearedRows.length, clearedRows, tspinType, scoreResult, gameOver: this.gameOver };
  }

  tick(dt) {
    if (this.gameOver) return null;

    this.gravityTimer += dt;
    const gravity = this.scorer.getGravityMs();

    while (this.gravityTimer >= gravity) {
      this.gravityTimer -= gravity;
      this.tryMove(0, 1);
    }

    if (this._isOnFloor()) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY_MS || this.lockResets >= LOCK_RESET_MAX) {
        return this._lock();
      }
    } else {
      this.lockTimer = 0;
    }

    return null;
  }
}
