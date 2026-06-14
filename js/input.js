export class InputHandler {
  constructor(callbacks) {
    this.cb = callbacks;
    this.paused = false;
    this.das = {};
    this._onKeydown = this._onKeydown.bind(this);
    this._onKeyup = this._onKeyup.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeydown);
    window.addEventListener('keyup', this._onKeyup);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeydown);
    window.removeEventListener('keyup', this._onKeyup);
    Object.keys(this.das).forEach(d => this._stopDAS(d));
  }

  setPaused(bool) {
    this.paused = bool;
    if (bool) Object.keys(this.das).forEach(d => this._stopDAS(d));
  }

  _onKeydown(e) {
    if (e.target.tagName === 'INPUT') return;
    const { code } = e;

    if (code === 'KeyP' || code === 'Escape') { e.preventDefault(); this.cb.pause(); return; }
    if (code === 'KeyR') { e.preventDefault(); this.cb.restart(); return; }
    if (code === 'KeyM') { e.preventDefault(); this.cb.toggleMute?.(); return; }
    if (code === 'KeyN') { e.preventDefault(); this.cb.cycleTrack?.(); return; }
    if (code === 'KeyQ') { e.preventDefault(); this.cb.quit?.(); return; }
    if (this.paused) return;

    if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].some(k => code === k)) {
      e.preventDefault();
    }

    switch (code) {
      case 'ArrowLeft':  case 'KeyA': this._startDAS('left',  this.cb.moveLeft,  167, 33); break;
      case 'ArrowRight': case 'KeyD': this._startDAS('right', this.cb.moveRight, 167, 33); break;
      case 'ArrowDown':  case 'KeyS': this._startDAS('down',  this.cb.softDrop,    0, 33); break;
      case 'Space':      this.cb.hardDrop(); break;
      case 'ArrowUp': case 'KeyW': case 'KeyX': this.cb.rotateCW();  break;
      case 'KeyZ':                              this.cb.rotateCCW(); break;
    }
  }

  _onKeyup(e) {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': this._stopDAS('left');  break;
      case 'ArrowRight': case 'KeyD': this._stopDAS('right'); break;
      case 'ArrowDown':  case 'KeyS': this._stopDAS('down');  break;
    }
  }

  _startDAS(dir, action, delay, repeat) {
    if (this.das[dir]) return;
    action();
    const obj = { timer: null, interval: null };
    this.das[dir] = obj;
    if (delay === 0) {
      obj.interval = setInterval(action, repeat);
    } else {
      obj.timer = setTimeout(() => {
        if (this.das[dir] === obj) obj.interval = setInterval(action, repeat);
      }, delay);
    }
  }

  _stopDAS(dir) {
    const obj = this.das[dir];
    if (!obj) return;
    if (obj.timer)    clearTimeout(obj.timer);
    if (obj.interval) clearInterval(obj.interval);
    delete this.das[dir];
  }
}
