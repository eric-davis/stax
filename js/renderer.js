import { PIECES, COLORS } from './pieces.js';

const CELL = 30;
const COLS = 10;
const ROWS = 20;
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const LEFT_W = 160;
const RIGHT_W = 175;
const PAD = 20;
const CANVAS_W = LEFT_W + BOARD_W + RIGHT_W;
const CANVAS_H = BOARD_H + PAD * 2;
const BOARD_X = LEFT_W;
const BOARD_Y = PAD;

const BG = '#0a0a1a';
const PANEL_BG = 'rgba(255,255,255,0.04)';
const GRID_COLOR = 'rgba(255,255,255,0.05)';
const TEXT_COLOR = '#e0e0ff';
const DIM_COLOR = '#4a4a6a';
const BORDER_COLOR = 'rgba(100,120,255,0.4)';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.flashRows = [];
    this.flashAlpha = 0;
    this.levelFlash = 0;
  }

  triggerLineClearEffect(clearedRows) {
    this.flashRows = clearedRows;
    this.flashAlpha = 1;
    // Spawn particles for each row
    for (const row of clearedRows) {
      for (let i = 0; i < 12; i++) {
        const col = Math.random() * COLS;
        this.particles.push({
          x: BOARD_X + col * CELL,
          y: BOARD_Y + row * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 1.2) * 5,
          life: 1,
          decay: 0.03 + Math.random() * 0.02,
          r: 3 + Math.random() * 3,
          color: `hsl(${Math.random()*360},100%,65%)`,
        });
      }
    }
  }

  triggerLevelUpEffect() {
    this.levelFlash = 1;
  }

  _updateEffects() {
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.08);
    if (this.levelFlash > 0) this.levelFlash = Math.max(0, this.levelFlash - 0.05);
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= p.decay;
      return p.life > 0;
    });
  }

  _drawBlock(ctx, x, y, size, color, alpha = 1, glow = true) {
    const rgb = hexToRgb(color);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = `rgba(${rgb},0.85)`;
    const r = 3;
    const s = size - 1;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + s - r, y);
    ctx.quadraticCurveTo(x + s, y, x + s, y + r);
    ctx.lineTo(x + s, y + s - r);
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    ctx.lineTo(x + r, y + s);
    ctx.quadraticCurveTo(x, y + s, x, y + s - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,0.15)`;
    ctx.fillRect(x + 2, y + 2, s - 4, Math.floor(s / 3));
    ctx.restore();
  }

  _drawPieceAt(ctx, type, rotation, px, py, cellSize, alpha = 1, ghost = false) {
    const shape = PIECES[type][rotation];
    const color = COLORS[type];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c] !== 'X') continue;
        const x = px + c * cellSize;
        const y = py + r * cellSize;
        if (ghost) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
          ctx.restore();
        } else {
          this._drawBlock(ctx, x, y, cellSize, color, alpha);
        }
      }
    }
  }

  _drawBoard(engine) {
    const ctx = this.ctx;
    // Board background
    ctx.fillStyle = 'rgba(0,0,20,0.8)';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + r * CELL);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL);
      ctx.stroke();
    }

    // Placed cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = engine.board[r][c];
        if (cell) {
          this._drawBlock(ctx,
            BOARD_X + c * CELL,
            BOARD_Y + r * CELL,
            CELL, COLORS[cell]);
        }
      }
    }

    // Ghost piece
    if (engine.current && !engine.gameOver) {
      const gy = engine.getGhostY();
      if (gy !== engine.current.y) {
        this._drawPieceAt(ctx,
          engine.current.type,
          engine.current.rotation,
          BOARD_X + engine.current.x * CELL,
          BOARD_Y + gy * CELL,
          CELL, 1, true);
      }
    }

    // Current piece
    if (engine.current && !engine.gameOver) {
      this._drawPieceAt(ctx,
        engine.current.type,
        engine.current.rotation,
        BOARD_X + engine.current.x * CELL,
        BOARD_Y + engine.current.y * CELL,
        CELL);
    }

    // Line clear flash
    if (this.flashAlpha > 0 && this.flashRows.length) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha * 0.6;
      ctx.fillStyle = '#ffffff';
      for (const r of this.flashRows) {
        ctx.fillRect(BOARD_X, BOARD_Y + r * CELL, BOARD_W, CELL);
      }
      ctx.restore();
    }

    // Level-up flash
    if (this.levelFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.levelFlash * 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
      ctx.restore();
    }

    // Board border with glow
    ctx.save();
    ctx.shadowColor = 'rgba(100,120,255,0.8)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.restore();

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _text(text, x, y, size, color, align = 'left', glow = null) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px 'Courier New', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _drawLeftPanel(scorer, musicMuted, musicTrack) {
    const ctx = this.ctx;
    const x = PAD;
    const w = LEFT_W - PAD * 1.5;

    ctx.save();
    ctx.fillStyle = PANEL_BG;
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.fillRect(x, BOARD_Y, w, BOARD_H);
    ctx.strokeRect(x, BOARD_Y, w, BOARD_H);
    ctx.restore();

    if (!scorer) return;

    const cx = x + w / 2;
    this._text('SCORE', cx, BOARD_Y + 34, 13, DIM_COLOR, 'center');
    this._text(scorer.score.toLocaleString(), cx, BOARD_Y + 62, 20, TEXT_COLOR, 'center', '#6688ff');
    this._text('LEVEL', cx, BOARD_Y + 106, 13, DIM_COLOR, 'center');
    this._text(scorer.level, cx, BOARD_Y + 138, 30, '#cc00ff', 'center', '#cc00ff');
    this._text('LINES', cx, BOARD_Y + 182, 13, DIM_COLOR, 'center');
    this._text(scorer.lines, cx, BOARD_Y + 210, 24, TEXT_COLOR, 'center');

    if (scorer.combo > 0) {
      this._text(`${scorer.combo}x COMBO`, cx, BOARD_Y + 260, 16, '#ffd700', 'center', '#ffd700');
    }
    if (scorer.backToBack) {
      this._text('BACK-TO-BACK', cx, BOARD_Y + 284, 12, '#ff8c00', 'center', '#ff8c00');
    }

    // Track name + mute indicator
    const trackColor = musicTrack === 'DARKNESS' ? '#cc44ff' : '#39ff14';
    this._text(`♪ ${musicTrack}`, cx, BOARD_Y + BOARD_H - 58, 13, musicMuted ? '#7070aa' : trackColor, 'center', musicMuted ? null : trackColor);
    const muteColor = musicMuted ? '#7070aa' : '#aaaacc';
    this._text(musicMuted ? 'MUTED' : 'MUSIC ON', cx, BOARD_Y + BOARD_H - 38, 12, muteColor, 'center');
    this._text('M:mute  N:track', cx, BOARD_Y + BOARD_H - 18, 11, '#707090', 'center');
  }

  _drawRightPanel(engine) {
    const ctx = this.ctx;
    const x = BOARD_X + BOARD_W + 10;
    const w = RIGHT_W - 20;

    ctx.save();
    ctx.fillStyle = PANEL_BG;
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.fillRect(x, BOARD_Y, w, BOARD_H);
    ctx.strokeRect(x, BOARD_Y, w, BOARD_H);
    ctx.restore();

    if (!engine) return;

    this._text('NEXT', x + w / 2, BOARD_Y + 22, 13, DIM_COLOR, 'center');

    const previewSize = 24;
    engine.nextPieces.forEach((type, i) => {
      const py = BOARD_Y + 38 + i * (previewSize * 4 + 14);
      // Mini piece preview — center in panel
      const shape = PIECES[type][0];
      // Find bounding box
      let minC = 4, maxC = 0, minR = 4, maxR = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        if (shape[r][c] === 'X') { minC=Math.min(minC,c); maxC=Math.max(maxC,c); minR=Math.min(minR,r); maxR=Math.max(maxR,r); }
      }
      const pw = (maxC - minC + 1) * previewSize;
      const ph = (maxR - minR + 1) * previewSize;
      const offX = x + (w - pw) / 2 - minC * previewSize;
      const offY = py - minR * previewSize;
      this._drawPieceAt(ctx, type, 0, offX, offY, previewSize, 1, false);
    });

    // Controls hint at bottom
    const hints = ['←→  Move','↓   Soft drop','SPC Hard drop','↑/X  Rotate CW','Z    Rotate CCW','P    Pause','M    Music','N    Track','Q    Quit'];
    hints.forEach((h, i) => {
      this._text(h, x + 8, BOARD_Y + BOARD_H - 148 + i * 17, 12, '#707090');
    });
  }

  _drawTitle(x, y, text, size, color) {
    this._text(text, x, y, size, color, 'center', color);
  }

  _drawMenu(highScores, version) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    ctx.save();
    ctx.shadowColor = '#cc00ff';
    ctx.shadowBlur = 30;
    ctx.font = "bold 52px 'Courier New', monospace";
    ctx.fillStyle = '#cc00ff';
    ctx.textAlign = 'center';
    ctx.fillText('STAX', CANVAS_W / 2, 100);
    ctx.shadowBlur = 0;
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillStyle = '#6688ff';
    ctx.fillText('N E O N  E D I T I O N', CANVAS_W / 2, 125);
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = '#505070';
    ctx.fillText(version ?? '', CANVAS_W / 2, 145);
    ctx.restore();

    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
    ctx.save();
    ctx.globalAlpha = pulse;
    this._text('PRESS SPACE TO START', CANVAS_W / 2, 175, 14, '#00f5ff', 'center', '#00f5ff');
    ctx.restore();

    if (highScores.length > 0) {
      this._text('HIGH SCORES', CANVAS_W / 2, 220, 12, DIM_COLOR, 'center');
      highScores.slice(0, 5).forEach((s, i) => {
        const y = 242 + i * 22;
        const color = i === 0 ? '#ffd700' : TEXT_COLOR;
        this._text(`${i+1}.`, 180, y, 12, color);
        this._text(s.name.padEnd(10), 200, y, 12, color);
        this._text(`Lv.${s.level ?? '-'}`, 455, y, 12, i === 0 ? '#ffd700' : DIM_COLOR, 'right');
        this._text(s.score.toLocaleString(), CANVAS_W - 100, y, 12, color, 'right');
      });
    }

    this._text('←→↓ Move   ↑/X CW   Z CCW   SPC Hard   P Pause   M Music   Q Quit', CANVAS_W / 2, CANVAS_H - 18, 12, '#707090', 'center');
  }

  _drawPaused() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.7)';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 20;
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.fillStyle = '#00f5ff';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2);
    ctx.shadowBlur = 0;
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText('P — resume', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 34);
    ctx.fillText('Q — quit to menu', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 58);
    ctx.restore();
  }

  _drawGameOver(scorer) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,10,0.85)';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 25;
    ctx.font = "bold 30px 'Courier New', monospace";
    ctx.fillStyle = '#ff1744';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 - 50);
    ctx.shadowBlur = 0;
    if (scorer) {
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`Score: ${scorer.score.toLocaleString()}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2);
      ctx.fillStyle = DIM_COLOR;
      ctx.fillText(`Level ${scorer.level}  •  ${scorer.lines} lines`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 24);
    }
    ctx.restore();
  }

  render({ state, engine, scorer, highScores, musicMuted, musicTrack, version }) {
    this._updateEffects();
    const ctx = this.ctx;

    if (state === 'menu') {
      this._drawMenu(highScores, version);
      return;
    }

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this._drawLeftPanel(scorer, musicMuted, musicTrack);
    this._drawBoard(engine);
    this._drawRightPanel(engine);

    if (state === 'paused') this._drawPaused();
    if (state === 'gameover') this._drawGameOver(scorer);
  }
}
