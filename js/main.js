import { Engine } from './engine.js';
import { Scorer } from './scoring.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { AudioManager } from './audio.js';

const HS_KEY = 'stax_highscores';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.nameOverlay = document.getElementById('name-overlay');
    this.nameForm = document.getElementById('name-form');
    this.nameInput = document.getElementById('name-input');

    this.state = 'menu';
    this.engine = null;
    this.scorer = null;
    this.highScores = this._loadLocalScores();
    this._loadScores();

    this.renderer = new Renderer(this.canvas);
    this.audio = new AudioManager();

    this.input = new InputHandler({
      moveLeft:  () => this._move(-1),
      moveRight: () => this._move(1),
      softDrop:  () => this._softDrop(),
      hardDrop:  () => this._hardDrop(),
      rotateCW:  () => this._rotate('cw'),
      rotateCCW: () => this._rotate('ccw'),
      pause:       () => this._togglePause(),
      restart:     () => this._restart(),
      toggleMute:  () => this.audio.toggleMuteMusic(),
      cycleTrack:  () => this.audio.cycleTrack(),
      quit:        () => this._quit(),
    });
    this.input.attach();

    // Start game on Space from menu
    window.addEventListener('keydown', e => {
      if (this.state === 'menu' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this._startGame();
      }
    });

    this.nameForm.addEventListener('submit', e => {
      e.preventDefault();
      this._submitScore();
    });

    this._lastTime = null;
    requestAnimationFrame(ts => this._loop(ts));
  }

  _startGame() {
    this.scorer = new Scorer();
    this.engine = new Engine(this.scorer);
    this.state = 'playing';
    this.input.setPaused(false);
    this.audio.setLevel(1);
    this.audio.startBGM();
  }

  _move(dx) {
    if (this.state !== 'playing') return;
    if (this.engine.tryMove(dx, 0)) this.audio.play('move');
  }

  _softDrop() {
    if (this.state !== 'playing') return;
    this.engine.softDrop();
  }

  _hardDrop() {
    if (this.state !== 'playing') return;
    this.audio.play('hardDrop');
    const result = this.engine.hardDrop();
    this._handleResult(result);
  }

  _rotate(dir) {
    if (this.state !== 'playing') return;
    if (this.engine.tryRotate(dir)) this.audio.play('rotate');
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.input.setPaused(true);
      this.audio.pauseBGM();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.input.setPaused(false);
      this.audio.resumeBGM();
    }
  }

  _restart() {
    if (this.state === 'gameover') {
      this.nameOverlay.style.display = 'none';
      this._startGame();
    } else if (this.state === 'menu') {
      this._startGame();
    } else if (this.state === 'paused') {
      this._togglePause();
    }
  }

  _quit() {
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameover') {
      this.audio.stopBGM();
      this.nameOverlay.style.display = 'none';
      this.state = 'menu';
      this.input.setPaused(false);
      this.engine = null;
      this.scorer = null;
    }
  }

  _handleResult(result) {
    if (!result) return;

    if (result.gameOver) {
      this.state = 'gameover';
      this.input.setPaused(true);
      this.audio.stopBGM();
      this.audio.play('gameOver');
      setTimeout(() => this._showNameEntry(), 1200);
      return;
    }

    const { linesCleared, tspinType, scoreResult, clearedRows } = result;

    if (linesCleared > 0) {
      if (linesCleared === 4)    this.audio.play('stax');
      else if (tspinType)        this.audio.play('tSpin');
      else                       this.audio.play('lineClear');
      this.renderer.triggerLineClearEffect(clearedRows);
    } else if (tspinType) {
      this.audio.play('tSpin');
    }

    if (scoreResult.levelUp) {
      this.audio.play('levelUp');
      this.audio.setLevel(this.scorer.level);
      this.renderer.triggerLevelUpEffect();
    }
  }

  _loop(ts) {
    const dt = this._lastTime ? Math.min(ts - this._lastTime, 100) : 0;
    this._lastTime = ts;

    if (this.state === 'playing' && this.engine) {
      const result = this.engine.tick(dt);
      if (result) this._handleResult(result);
    }

    this.renderer.render({
      state: this.state,
      engine: this.engine,
      scorer: this.scorer,
      highScores: this.highScores,
      musicMuted: this.audio.isMusicMuted(),
      musicTrack: this.audio.getTrackName(),
    });

    requestAnimationFrame(ts => this._loop(ts));
  }

  _showNameEntry() {
    this.nameInput.value = '';
    document.getElementById('name-score').textContent =
      `Score: ${this.scorer.score.toLocaleString()}  •  Level ${this.scorer.level}  •  ${this.scorer.lines} lines`;
    this.nameOverlay.style.display = 'flex';
    this.nameInput.focus();
  }

  async _submitScore() {
    const name = (this.nameInput.value.replace(/[\x00-\x1f\x7f]/g, '').trim() || 'Anonymous').substring(0, 12);
    const entry = {
      name,
      score: this.scorer.score,
      level: this.scorer.level,
      lines: this.scorer.lines,
      date: new Date().toLocaleDateString(),
    };
    this.nameOverlay.style.display = 'none';
    this.state = 'menu';

    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('./api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: entry.score, level: entry.level, lines: entry.lines }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      const data = await res.json();
      if (data.ok && Array.isArray(data.scores)) {
        this.highScores = data.scores;
        localStorage.setItem(HS_KEY, JSON.stringify(this.highScores));
        return;
      }
    } catch { /* fall through to local save */ }

    this.highScores.push(entry);
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 10);
    localStorage.setItem(HS_KEY, JSON.stringify(this.highScores));
  }

  async _loadScores() {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('./api/scores', { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        this.highScores = data;
        localStorage.setItem(HS_KEY, JSON.stringify(this.highScores));
      }
    } catch { /* silently keep local scores */ }
  }

  _loadLocalScores() {
    try {
      const raw = JSON.parse(localStorage.getItem(HS_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(e =>
        e !== null && typeof e === 'object'
        && typeof e.name === 'string'
        && Number.isFinite(e.score) && e.score >= 0
        && Number.isInteger(e.level) && e.level >= 1
        && Number.isInteger(e.lines) && e.lines >= 0
        && typeof e.date === 'string'
      ).slice(0, 10);
    } catch { return []; }
  }
}

new Game();
