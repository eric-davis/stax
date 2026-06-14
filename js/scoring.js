const BASE = {
  normal:  [0, 100, 300, 500, 800],
  mini:    [100, 200, 400],
  tspin:   [400, 800, 1200, 1600],
};

function isB2BEligible(linesCleared, tspinType) {
  if (linesCleared === 4) return true;
  if (tspinType === 'full') return true;
  if (tspinType === 'mini' && linesCleared === 2) return true;
  return false;
}

export class Scorer {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;
    this.backToBack = false;
  }

  addDrop(cells, isHard) {
    this.score += isHard ? cells * 2 : cells;
  }

  addLineClear(linesCleared, tspinType) {
    const prevLevel = this.level;
    let base = 0;

    if (!tspinType) {
      base = BASE.normal[linesCleared] ?? 0;
    } else if (tspinType === 'mini') {
      base = BASE.mini[linesCleared] ?? 0;
    } else {
      base = BASE.tspin[linesCleared] ?? 0;
    }

    const eligible = isB2BEligible(linesCleared, tspinType);
    const b2bActive = this.backToBack && eligible;
    const b2bBonus = b2bActive ? Math.floor(base * 0.5) : 0;

    const pts = (base + b2bBonus) * this.level;

    if (linesCleared > 0) {
      this.combo++;
    } else {
      this.combo = -1;
    }
    const comboBonus = this.combo > 0 ? 50 * this.combo * this.level : 0;

    this.score += pts + comboBonus;
    this.lines += linesCleared;
    this.level = Math.min(20, 1 + Math.floor(this.lines / 10));

    // Update B2B chain
    if (linesCleared > 0 || tspinType) {
      if (eligible) {
        this.backToBack = true;
      } else if (linesCleared > 0) {
        this.backToBack = false;
      }
    }

    return {
      points: pts + comboBonus,
      base,
      b2bBonus,
      combo: this.combo,
      tspinType,
      linesCleared,
      levelUp: this.level > prevLevel,
    };
  }

  getGravityMs() {
    return Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1) * 1000;
  }

  toJSON() {
    return { score: this.score, level: this.level, lines: this.lines, combo: this.combo, backToBack: this.backToBack };
  }
}
