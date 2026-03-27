/**
 * InputSystem — 키보드+터치 입력 (좌/우/점프/일시정지)
 */
export class InputSystem {
  constructor() {
    this.left = false;
    this.right = false;
    this.jump = false;
    this.jumpPressed = false;  // True only on the frame jump was pressed
    this.pause = false;
    this.pausePressed = false;

    this._jumpWasDown = false;
    this._pauseWasDown = false;
    this._jumpQueued = false; // Queued from keydown, consumed in update()

    // Keyboard
    this._keys = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    // Touch
    this._touches = {};
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);
    window.addEventListener('touchcancel', this._onTouchEnd);

    // Prevent default for game keys
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Space'].includes(e.key || e.code)) {
        e.preventDefault();
      }
    });
  }

  update() {
    // Edge detection for jump and pause
    const jumpDown = this._keys.has('Space') || this._keys.has('ArrowUp') ||
                     this._keys.has(' ') || this._keys.has('w') || this._keys.has('W');
    // jumpPressed: true on edge OR if queued from keydown event
    this.jumpPressed = (jumpDown && !this._jumpWasDown) || this._jumpQueued;
    this._jumpQueued = false; // Consume the queue
    this.jump = jumpDown;
    this._jumpWasDown = jumpDown;

    const pauseDown = this._keys.has('Escape') || this._keys.has('p') || this._keys.has('P');
    this.pausePressed = pauseDown && !this._pauseWasDown;
    this._pauseWasDown = pauseDown;

    // Movement
    this.left = this._keys.has('ArrowLeft') || this._keys.has('a') || this._keys.has('A');
    this.right = this._keys.has('ArrowRight') || this._keys.has('d') || this._keys.has('D');

    // Touch virtual buttons
    if (this._touches.left) this.left = true;
    if (this._touches.right) this.right = true;
    if (this._touches.jump) {
      if (!this._touches._jumpWas) {
        this.jumpPressed = true;
      }
      this.jump = true;
      this._touches._jumpWas = true;
    } else {
      this._touches._jumpWas = false;
    }
  }

  getState() {
    return {
      left: this.left,
      right: this.right,
      jump: this.jump,
      jumpPressed: this.jumpPressed,
    };
  }

  _onKeyDown(e) {
    this._keys.add(e.key);
    // Queue jump immediately on keydown so it's never missed between update() calls
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      this._jumpQueued = true;
    }
  }

  _onKeyUp(e) {
    this._keys.delete(e.key);
  }

  _onTouchStart(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const x = touch.clientX;
      const y = touch.clientY;
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (x < w / 3) {
        this._touches.left = touch.identifier;
      } else if (x > w * 2 / 3) {
        this._touches.jump = touch.identifier;
      } else {
        this._touches.right = touch.identifier;
      }
    }
  }

  _onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (this._touches.left === touch.identifier) this._touches.left = null;
      if (this._touches.right === touch.identifier) this._touches.right = null;
      if (this._touches.jump === touch.identifier) this._touches.jump = null;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
  }
}
