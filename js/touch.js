export class TouchInputHandler {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.paused = false;
    this.das = {};
    this._startX = 0;
    this._startY = 0;
    this._startTime = 0;
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove  = this._onTouchMove.bind(this);
    this._onTouchEnd   = this._onTouchEnd.bind(this);
  }

  attach() {
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    this.canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
  }

  detach() {
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove',  this._onTouchMove);
    this.canvas.removeEventListener('touchend',   this._onTouchEnd);
    Object.keys(this.das).forEach(d => this._stopDAS(d));
  }

  setPaused(bool) {
    this.paused = bool;
    if (bool) Object.keys(this.das).forEach(d => this._stopDAS(d));
  }

  attachButtons(map) {
    this._wireDAS(map.left,     this.cb.moveLeft,  'left',     167, 33);
    this._wireDAS(map.right,    this.cb.moveRight, 'right',    167, 33);
    this._wireDAS(map.softDrop, this.cb.softDrop,  'softDrop',   0, 33);
    this._wireOneShot(map.hardDrop,  () => { if (!this.paused) this.cb.hardDrop();  });
    this._wireOneShot(map.rotateCW,  () => { if (!this.paused) this.cb.rotateCW();  });
    this._wireOneShot(map.rotateCCW, () => { if (!this.paused) this.cb.rotateCCW(); });
    this._wireOneShot(map.pause,     () => this.cb.pause());
  }

  _wireDAS(el, action, dir, delay, repeat) {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.paused) return;
      el.classList.add('pressed');
      this._startDAS(dir, action, delay, repeat);
    }, { passive: false });
    const release = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      this._stopDAS(dir);
    };
    el.addEventListener('touchend',    release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  }

  _wireOneShot(el, action) {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      action();
    }, { passive: false });
    const release = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
    };
    el.addEventListener('touchend',    release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._startX = t.clientX;
    this._startY = t.clientY;
    this._startTime = Date.now();
  }

  _onTouchMove(e) {
    e.preventDefault();
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (this.paused) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this._startX;
    const dy = t.clientY - this._startY;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - this._startTime;

    if (dist < 15 && dt < 250) {
      this.cb.rotateCW();
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 20) {
      dx < 0 ? this.cb.moveLeft() : this.cb.moveRight();
    } else if (dy >= 20 && Math.abs(dy) >= Math.abs(dx)) {
      dy / dt >= 0.8 ? this.cb.hardDrop() : this.cb.softDrop();
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
