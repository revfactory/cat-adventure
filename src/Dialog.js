/**
 * Dialog — 스토리 다이얼로그 시스템
 */
export class Dialog {
  constructor(renderer) {
    this.renderer = renderer;
    this.uiLayer = renderer.layers.ui;
    this.queue = [];
    this.currentDialog = null;
    this.onComplete = null;
    this._showing = false;
    this._charIndex = 0;
    this._charTimer = 0;
    this._charSpeed = 0.03; // seconds per character
    this._fullText = '';
  }

  /**
   * Show a sequence of dialog messages
   * @param {Array<{speaker, text, color}>} messages
   * @param {Function} onComplete
   */
  show(messages, onComplete) {
    this.queue = [...messages];
    this.onComplete = onComplete;
    this._showNext();
  }

  _showNext() {
    if (this.queue.length === 0) {
      this.hide();
      if (this.onComplete) this.onComplete();
      return;
    }

    const msg = this.queue.shift();
    this.currentDialog = msg;
    this._showing = true;
    this._charIndex = 0;
    this._fullText = msg.text;
    this._render(msg);
  }

  _render(msg) {
    this.uiLayer.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'dialog-box visible');

    // Dialog background
    const bg = this._el('rect', {
      x: 50, y: 440, width: 700, height: 130, rx: 12,
      fill: 'rgba(0,0,0,0.85)', stroke: '#4ECDC4', 'stroke-width': 2,
    });
    g.appendChild(bg);

    // Speaker name
    if (msg.speaker) {
      const nameBg = this._el('rect', {
        x: 70, y: 425, width: msg.speaker.length * 14 + 20, height: 28, rx: 6,
        fill: msg.color || '#4ECDC4',
      });
      g.appendChild(nameBg);

      const name = this._el('text', {
        x: 80, y: 445,
        fill: '#fff', 'font-size': 14, 'font-weight': 'bold', 'font-family': 'sans-serif',
      });
      name.textContent = msg.speaker;
      g.appendChild(name);
    }

    // Message text (typewriter)
    this._textElement = this._el('text', {
      x: 80, y: 480,
      fill: '#ECF0F1', 'font-size': 15, 'font-family': 'sans-serif',
    });
    this._textElement.textContent = '';
    g.appendChild(this._textElement);

    // Continue prompt
    this._promptElement = this._el('text', {
      x: 700, y: 558,
      'text-anchor': 'end',
      fill: '#7F8C8D', 'font-size': 12, 'font-family': 'sans-serif',
      opacity: 0,
    });
    this._promptElement.textContent = '클릭 또는 Space로 계속 ▶';
    g.appendChild(this._promptElement);

    // Click to advance
    const clickArea = this._el('rect', {
      x: 50, y: 440, width: 700, height: 130,
      fill: 'transparent', cursor: 'pointer',
    });
    clickArea.addEventListener('click', () => this._advance());
    g.appendChild(clickArea);

    this.uiLayer.appendChild(g);

    // Keyboard advance
    this._keyHandler = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._advance();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  _advance() {
    if (this._charIndex < this._fullText.length) {
      // Show full text immediately
      this._charIndex = this._fullText.length;
      this._textElement.textContent = this._fullText;
      this._promptElement.setAttribute('opacity', 1);
    } else {
      // Next dialog
      window.removeEventListener('keydown', this._keyHandler);
      this._showNext();
    }
  }

  update(dt) {
    if (!this._showing || !this._textElement) return;

    if (this._charIndex < this._fullText.length) {
      this._charTimer += dt;
      while (this._charTimer >= this._charSpeed && this._charIndex < this._fullText.length) {
        this._charTimer -= this._charSpeed;
        this._charIndex++;
        this._textElement.textContent = this._fullText.substring(0, this._charIndex);
      }
    } else {
      this._promptElement?.setAttribute('opacity', 1);
    }
  }

  hide() {
    this._showing = false;
    this.currentDialog = null;
    this.uiLayer.innerHTML = '';
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
  }

  get isShowing() {
    return this._showing;
  }

  _el(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }
}
