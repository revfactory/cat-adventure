/**
 * HUD — 인게임 UI (체력 하트, 점수, 동료 구출 현황, 일시정지 버튼)
 */
export class HUD {
  constructor(renderer) {
    this.renderer = renderer;
    this.hudLayer = renderer.layers.hud;
    this.elements = {};
    this._created = false;
  }

  create() {
    if (this._created) return;
    this._created = true;

    const ns = 'http://www.w3.org/2000/svg';
    this.hudLayer.innerHTML = '';

    // Background bar
    const bar = this._el('rect', { x: 0, y: 0, width: 800, height: 50, fill: 'rgba(0,0,0,0.4)', rx: 0 });
    this.hudLayer.appendChild(bar);

    // Hearts container
    this.elements.hearts = [];
    for (let i = 0; i < 6; i++) {
      const heart = this._el('text', {
        x: 20 + i * 28, y: 32,
        fill: '#E74C3C', 'font-size': '22', 'font-family': 'sans-serif',
      });
      heart.textContent = '\u2665'; // filled heart
      this.hudLayer.appendChild(heart);
      this.elements.hearts.push(heart);
    }

    // Score
    this.elements.score = this._el('text', {
      x: 400, y: 32,
      'text-anchor': 'middle',
      fill: '#FFD700', 'font-size': '18', 'font-weight': 'bold', 'font-family': 'sans-serif',
    });
    this.elements.score.textContent = '0';
    this.hudLayer.appendChild(this.elements.score);

    // Score label
    const scoreLabel = this._el('text', {
      x: 400, y: 15,
      'text-anchor': 'middle',
      fill: '#fff', 'font-size': '10', 'font-family': 'sans-serif',
    });
    scoreLabel.textContent = 'SCORE';
    this.hudLayer.appendChild(scoreLabel);

    // Rescued NPCs
    this.elements.npcs = [];
    const npcColors = ['#95A5A6', '#2C3E50', '#ECF0F1', '#FF8C42', '#F5E6CC'];
    const npcNames = ['잿빛', '깜이', '하양', '삼돌', '코코'];
    for (let i = 0; i < 5; i++) {
      const g = this._el('g');
      const circle = this._el('circle', {
        cx: 600 + i * 36, cy: 25,
        r: 12, fill: 'rgba(255,255,255,0.15)', stroke: npcColors[i], 'stroke-width': 2,
      });
      const text = this._el('text', {
        x: 600 + i * 36, y: 29,
        'text-anchor': 'middle', fill: '#666', 'font-size': '8', 'font-family': 'sans-serif',
      });
      text.textContent = npcNames[i][0];
      g.appendChild(circle);
      g.appendChild(text);
      this.hudLayer.appendChild(g);
      this.elements.npcs.push({ group: g, circle, text, rescued: false });
    }

    // Pause button
    const pauseBtn = this._el('g', { cursor: 'pointer' });
    pauseBtn.addEventListener('click', () => {
      if (this.onPause) this.onPause();
    });
    const pauseBg = this._el('rect', { x: 760, y: 8, width: 30, height: 30, rx: 4, fill: 'rgba(255,255,255,0.2)' });
    const pauseBar1 = this._el('rect', { x: 769, y: 14, width: 4, height: 18, fill: '#fff', rx: 1 });
    const pauseBar2 = this._el('rect', { x: 778, y: 14, width: 4, height: 18, fill: '#fff', rx: 1 });
    pauseBtn.appendChild(pauseBg);
    pauseBtn.appendChild(pauseBar1);
    pauseBtn.appendChild(pauseBar2);
    this.hudLayer.appendChild(pauseBtn);
    this.elements.pauseBtn = pauseBtn;

    // Stage name (shows briefly)
    this.elements.stageName = this._el('text', {
      x: 400, y: 300,
      'text-anchor': 'middle',
      fill: '#fff', 'font-size': '32', 'font-weight': 'bold', 'font-family': 'sans-serif',
      opacity: 0,
    });
    this.hudLayer.appendChild(this.elements.stageName);

    // Callback
    this.onPause = null;
  }

  update(scene) {
    if (!this._created || !scene) return;

    const player = scene.player;
    if (!player) return;

    // Hearts
    for (let i = 0; i < 6; i++) {
      const heart = this.elements.hearts[i];
      if (i < player.maxHealth) {
        heart.style.display = '';
        heart.setAttribute('fill', i < player.health ? '#E74C3C' : '#555');
        heart.textContent = i < player.health ? '\u2665' : '\u2661';
      } else {
        heart.style.display = 'none';
      }
    }

    // Score
    this.elements.score.textContent = scene.score.toString();

    // Rescued NPCs
    const npcTypes = ['gray-cat', 'black-cat', 'white-cat', 'calico-cat', 'siamese-cat'];
    for (let i = 0; i < 5; i++) {
      const npcEl = this.elements.npcs[i];
      const rescued = scene.rescuedNPCs.has(npcTypes[i]);
      if (rescued && !npcEl.rescued) {
        npcEl.rescued = true;
        npcEl.circle.setAttribute('fill', npcEl.circle.getAttribute('stroke'));
        npcEl.text.setAttribute('fill', '#fff');
      }
    }

    // Hint system (activated by rescuing 잿빛)
    if (scene._hintSystemActive && player) {
      this._updateHints(scene, player);
    }
  }

  _updateHints(scene, player) {
    // Remove old hint arrow
    if (this._hintArrow && this._hintArrow.parentNode) {
      this._hintArrow.parentNode.removeChild(this._hintArrow);
    }
    // Find nearest uncollected tuna or hidden item
    const items = scene.getEntitiesByType('Item');
    let nearest = null;
    let nearestDist = Infinity;
    for (const item of items) {
      if (item.collected || item.destroyed) continue;
      if (item.itemType === 'tuna' || item.itemType === 'star') {
        const d = Math.hypot(item.x - player.x, item.y - player.y);
        if (d < nearestDist && d > 50) {
          nearestDist = d;
          nearest = item;
        }
      }
    }
    if (nearest && nearestDist < 600) {
      const ns = 'http://www.w3.org/2000/svg';
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const ax = 400 + Math.cos(angle) * 40;
      const ay = 580 + Math.sin(angle) * 20;
      this._hintArrow = document.createElementNS(ns, 'text');
      this._hintArrow.setAttribute('x', ax);
      this._hintArrow.setAttribute('y', ay);
      this._hintArrow.setAttribute('text-anchor', 'middle');
      this._hintArrow.setAttribute('fill', '#FFD700');
      this._hintArrow.setAttribute('font-size', '16');
      this._hintArrow.setAttribute('opacity', '0.7');
      this._hintArrow.textContent = nearest.x > player.x ? '>>>' : '<<<';
      this.hudLayer.appendChild(this._hintArrow);
    }
  }

  showStageName(name, duration = 2) {
    if (!this.elements.stageName) return;
    this.elements.stageName.textContent = name;
    this.elements.stageName.setAttribute('opacity', 1);
    setTimeout(() => {
      this.elements.stageName.setAttribute('opacity', 0);
    }, duration * 1000);
  }

  _el(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  destroy() {
    this.hudLayer.innerHTML = '';
    this._created = false;
  }
}
