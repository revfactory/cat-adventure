/**
 * ParticleSystem — 파티클 이펙트 (먼지, 물방울, 반짝임)
 */
export class ParticleSystem {
  constructor(renderer) {
    this.renderer = renderer;
    this.particles = [];
    this.effectsLayer = renderer?.layers?.effects || null;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.element && p.element.parentNode) {
          p.element.parentNode.removeChild(p.element);
        }
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;

      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.element) {
        p.element.setAttribute('transform', `translate(${p.x}, ${p.y})`);
        p.element.setAttribute('opacity', alpha);
      }
    }
  }

  /**
   * Emit dust particles (landing, running)
   */
  emitDust(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      this._spawn({
        x, y,
        vx: (Math.random() - 0.5) * 80,
        vy: -Math.random() * 40 - 10,
        gravity: 100,
        life: 0.3 + Math.random() * 0.2,
        size: 3 + Math.random() * 3,
        color: '#C8B89A',
        shape: 'circle',
      });
    }
  }

  /**
   * Emit sparkle particles (item collect)
   */
  emitSparkle(x, y, color = '#FFD700', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      this._spawn({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        life: 0.4 + Math.random() * 0.2,
        size: 2 + Math.random() * 2,
        color,
        shape: 'circle',
      });
    }
  }

  /**
   * Emit water splash particles
   */
  emitSplash(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      this._spawn({
        x, y,
        vx: (Math.random() - 0.5) * 120,
        vy: -Math.random() * 100 - 30,
        gravity: 300,
        life: 0.5 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color: '#5DADE2',
        shape: 'circle',
      });
    }
  }

  /**
   * Emit fragment particles (box break)
   */
  emitFragments(x, y, color = '#C49A6C', count = 6) {
    for (let i = 0; i < count; i++) {
      this._spawn({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 150 - 50,
        gravity: 500,
        life: 0.8 + Math.random() * 0.5,
        size: 4 + Math.random() * 6,
        color,
        shape: 'rect',
      });
    }
  }

  /**
   * Emit score popup text
   */
  emitScorePopup(x, y, text, color = '#FFD700') {
    if (!this.effectsLayer) return;

    const ns = 'http://www.w3.org/2000/svg';
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', color);
    t.setAttribute('font-size', '14');
    t.setAttribute('font-weight', 'bold');
    t.setAttribute('class', 'score-popup');
    t.textContent = text;
    this.effectsLayer.appendChild(t);

    setTimeout(() => {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 800);
  }

  _spawn(config) {
    if (!this.effectsLayer) return;

    const ns = 'http://www.w3.org/2000/svg';
    let el;

    if (config.shape === 'rect') {
      el = document.createElementNS(ns, 'rect');
      el.setAttribute('width', config.size);
      el.setAttribute('height', config.size);
      el.setAttribute('fill', config.color);
      el.setAttribute('rx', 1);
    } else {
      el = document.createElementNS(ns, 'circle');
      el.setAttribute('r', config.size / 2);
      el.setAttribute('fill', config.color);
    }

    el.setAttribute('transform', `translate(${config.x}, ${config.y})`);
    this.effectsLayer.appendChild(el);

    config.element = el;
    config.maxLife = config.life;
    this.particles.push(config);
  }

  clear() {
    for (const p of this.particles) {
      if (p.element && p.element.parentNode) {
        p.element.parentNode.removeChild(p.element);
      }
    }
    this.particles = [];
  }
}
