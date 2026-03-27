/**
 * Renderer — SVG DOM 렌더러 (보간 지원)
 * 엔티티 위치를 SVG transform으로 반영, 패럴랙스 배경 처리
 */
export class Renderer {
  constructor(camera) {
    this.camera = camera;
    this.svg = document.getElementById('game-svg');
    this.worldGroup = document.getElementById('game-world');
    this.layers = {
      bgFar: document.getElementById('layer-bg-far'),
      bgMid: document.getElementById('layer-bg-mid'),
      bgNear: document.getElementById('layer-bg-near'),
      platforms: document.getElementById('layer-platforms'),
      objects: document.getElementById('layer-objects'),
      items: document.getElementById('layer-items'),
      npcs: document.getElementById('layer-npcs'),
      enemies: document.getElementById('layer-enemies'),
      player: document.getElementById('layer-player'),
      effects: document.getElementById('layer-effects'),
      hud: document.getElementById('layer-hud'),
      ui: document.getElementById('layer-ui'),
    };
    this.parallaxLayers = [];
    this._svgCache = new Map();
  }

  /**
   * Set up parallax background layers from level data
   * @param {Array} layers — [{image, speed}]
   */
  setupBackground(layers) {
    this.parallaxLayers = [];
    // Clear existing backgrounds
    this.layers.bgFar.innerHTML = '';
    this.layers.bgMid.innerHTML = '';
    this.layers.bgNear.innerHTML = '';

    const targets = [this.layers.bgFar, this.layers.bgMid, this.layers.bgNear];
    layers.forEach((layer, i) => {
      const target = targets[Math.min(i, targets.length - 1)];
      const g = this._createSVGElement('g');
      // Create a placeholder colored rect as fallback
      const rect = this._createSVGElement('rect', {
        x: 0, y: 0,
        width: this.camera.worldWidth,
        height: this.camera.vh,
        fill: this._bgColor(i, layers.length),
        opacity: 0.6 - i * 0.1,
      });
      g.appendChild(rect);
      target.appendChild(g);

      const entry = { element: g, speed: layer.speed, tileWidth: this.camera.worldWidth };
      this.parallaxLayers.push(entry);

      // Load actual SVG background if image is specified
      if (layer.image) {
        this._loadBackgroundSVG(entry, layer.image, g, rect);
      }
    });
  }

  async _loadBackgroundSVG(entry, imageName, g, fallbackRect) {
    // Vite root is src/, so paths are relative to src/
    const svgPath = `./assets/backgrounds/${imageName}`;
    try {
      const svgText = await this._fetchSVG(svgPath);
      // Verify it's actually SVG, not HTML fallback
      if (!svgText.includes('<svg') || svgText.includes('<!DOCTYPE html>')) {
        throw new Error('Not SVG content');
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgRoot = doc.documentElement;
      if (svgRoot.nodeName !== 'svg') throw new Error('Not SVG root');

      // Get viewBox dimensions for tile width
      const vb = svgRoot.getAttribute('viewBox');
      const vbWidth = vb ? parseFloat(vb.split(/\s+/)[2]) : 800;
      const vbHeight = vb ? parseFloat(vb.split(/\s+/)[3]) : 600;
      const tileHeight = this.camera.vh;
      const tileWidth = (vbWidth / vbHeight) * tileHeight;
      entry.tileWidth = tileWidth;

      // Remove fallback rect
      if (fallbackRect.parentNode === g) {
        g.removeChild(fallbackRect);
      }

      // Create two tiles for seamless scrolling using <image> elements
      // This avoids nested SVG issues in the DOM
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      for (let t = 0; t < 2; t++) {
        const img = this._createSVGElement('image', {
          href: url,
          x: t * tileWidth,
          y: 0,
          width: tileWidth,
          height: tileHeight,
          preserveAspectRatio: 'xMidYMid slice',
        });
        g.appendChild(img);
      }
    } catch (e) {
      // Keep fallback rect on any error
    }
  }

  _bgColor(index, total) {
    const colors = ['#87CEEB', '#6BB5D6', '#4A9CC7', '#3388B0'];
    return colors[index % colors.length];
  }

  render(alpha, scene) {
    const cam = this.camera;

    // Move game world (camera)
    this.worldGroup.setAttribute('transform',
      `translate(${-cam.viewX}, ${-cam.viewY})`);

    // Parallax with seamless tiling
    for (const layer of this.parallaxLayers) {
      let px = -cam.viewX * layer.speed;
      // Wrap the offset so it loops seamlessly within one tile width
      if (layer.tileWidth > 0) {
        px = px % layer.tileWidth;
      }
      layer.element.setAttribute('transform', `translate(${px}, 0)`);
    }

    // Render entities
    if (!scene) return;
    for (const entity of scene.entities) {
      if (!entity.active || entity.destroyed) continue;
      this._renderEntity(entity, alpha);
    }
  }

  _renderEntity(entity, alpha) {
    if (!entity.svgElement) {
      this._createEntitySVG(entity);
    }
    // 물리 엔진에서 계산한 보간 위치가 있으면 사용, 없으면 자체 보간
    let x, y;
    if (entity.renderX !== undefined && entity.renderY !== undefined) {
      x = entity.renderX;
      y = entity.renderY;
    } else {
      x = entity.prevX !== undefined
        ? entity.prevX + (entity.x - entity.prevX) * alpha
        : entity.x;
      y = entity.prevY !== undefined
        ? entity.prevY + (entity.y - entity.prevY) * alpha
        : entity.y;
    }

    let transform = `translate(${Math.round(x)}, ${Math.round(y)})`;

    // Facing direction flip
    if (entity.facingRight === false) {
      transform += ` translate(${entity.width}, 0) scale(-1, 1)`;
    }

    // Squash/stretch
    if (entity.scaleX !== undefined && entity.scaleY !== undefined) {
      if (entity.scaleX !== 1 || entity.scaleY !== 1) {
        const cx = entity.width / 2;
        const cy = entity.height;
        transform += ` translate(${cx}, ${cy}) scale(${entity.scaleX}, ${entity.scaleY}) translate(${-cx}, ${-cy})`;
      }
    }

    entity.svgElement.setAttribute('transform', transform);
  }

  _createEntitySVG(entity) {
    // Outer group: positioning only (SVG transform attribute)
    const g = this._createSVGElement('g');
    g.setAttribute('id', `entity-${entity.id}`);

    // Inner group: CSS animations applied here (won't interfere with positioning)
    const inner = this._createSVGElement('g');
    inner.setAttribute('class', `entity-${entity.type}`);

    // Ground platform: render with tiled pattern for visibility
    if (entity.type === 'platform' && entity.platformData?.type === 'ground') {
      this._createGroundVisual(inner, entity);
    } else {
      // Placeholder rectangle
      const rect = this._createSVGElement('rect', {
        x: 0, y: 0,
        width: entity.width,
        height: entity.height,
        rx: entity.type === 'player' ? 8 : 3,
        fill: entity.color || '#888',
        stroke: entity.type === 'player' ? '#D35400' : '#333',
        'stroke-width': entity.type === 'player' ? 2 : 1,
      });
      inner.appendChild(rect);

      // Label
      if (entity.label) {
        const text = this._createSVGElement('text', {
          x: entity.width / 2,
          y: entity.height / 2 + 4,
          'text-anchor': 'middle',
          fill: '#fff',
          'font-size': Math.min(14, entity.width / 3),
          'pointer-events': 'none',
        });
        text.textContent = entity.label;
        inner.appendChild(text);
      }
    }

    g.appendChild(inner);

    // Add to appropriate layer
    const layerName = this._getLayerForEntity(entity);
    const layer = this.layers[layerName];
    if (layer) layer.appendChild(g);

    entity.svgElement = g;
    entity._svgInner = inner;  // CSS classes go on this element
    return g;
  }

  /**
   * Create a visible ground visual with tiled pattern
   */
  _createGroundVisual(g, entity) {
    // Main ground body - dark color
    const rect = this._createSVGElement('rect', {
      x: 0, y: 0,
      width: entity.width,
      height: entity.height,
      fill: '#3D4F5F',
    });
    g.appendChild(rect);

    // Top edge - grass/surface line
    const topLine = this._createSVGElement('rect', {
      x: 0, y: 0,
      width: entity.width,
      height: 4,
      fill: '#5D8A68',
    });
    g.appendChild(topLine);

    // Subtle surface detail line
    const surfaceLine = this._createSVGElement('rect', {
      x: 0, y: 4,
      width: entity.width,
      height: 2,
      fill: '#4A6A55',
    });
    g.appendChild(surfaceLine);

    // Add some tile lines for texture
    for (let x = 0; x < entity.width; x += 64) {
      const line = this._createSVGElement('line', {
        x1: x, y1: 6,
        x2: x, y2: entity.height,
        stroke: '#344555',
        'stroke-width': 1,
        opacity: 0.5,
      });
      g.appendChild(line);
    }
    // Horizontal middle line
    const midLine = this._createSVGElement('line', {
      x1: 0, y1: entity.height / 2,
      x2: entity.width, y2: entity.height / 2,
      stroke: '#344555',
      'stroke-width': 1,
      opacity: 0.3,
    });
    g.appendChild(midLine);
  }

  _getLayerForEntity(entity) {
    switch (entity.type) {
      case 'player': return 'player';
      case 'enemy': case 'boss': return 'enemies';
      case 'npc': return 'npcs';
      case 'item': return 'items';
      case 'platform': case 'object': return 'platforms';
      case 'particle': case 'effect': return 'effects';
      default: return 'objects';
    }
  }

  /**
   * Fetch an SVG file, returning cached text if available.
   */
  async _fetchSVG(svgPath) {
    if (this._svgCache.has(svgPath)) {
      return this._svgCache.get(svgPath);
    }
    const resp = await fetch(svgPath);
    if (!resp.ok) throw new Error(`Failed to fetch ${svgPath}`);
    const svgText = await resp.text();
    this._svgCache.set(svgPath, svgText);
    return svgText;
  }

  /**
   * Preload a list of SVG asset paths into the cache.
   * Returns a promise that resolves when all are loaded (failures are silently ignored).
   */
  async preloadSVGs(paths) {
    await Promise.all(paths.map(p => this._fetchSVG(p).catch(() => {})));
  }

  /**
   * Make SVG IDs unique by prefixing with entity id
   */
  _uniquifySVGIds(svgText, entityId) {
    const prefix = `e${entityId}_`;
    // Replace id="..." and url(#...) and href="#..." references
    let result = svgText;
    // Find all IDs
    const idRegex = /id="([^"]+)"/g;
    const ids = new Set();
    let match;
    while ((match = idRegex.exec(svgText)) !== null) {
      ids.add(match[1]);
    }
    // Replace each ID and its references
    for (const id of ids) {
      const newId = prefix + id;
      result = result.replace(new RegExp(`id="${id}"`, 'g'), `id="${newId}"`);
      result = result.replace(new RegExp(`url\\(#${id}\\)`, 'g'), `url(#${newId})`);
      result = result.replace(new RegExp(`href="#${id}"`, 'g'), `href="#${newId}"`);
    }
    return result;
  }

  /**
   * Parse SVG text and embed as inline <svg> element inside entity's inner group
   */
  _embedInlineSVG(entity, svgText) {
    const target = entity._svgInner || entity.svgElement;
    if (!target) return false;

    // Remove all existing children from inner group
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }

    // Make IDs unique
    const uniqueSvg = this._uniquifySVGIds(svgText, entity.id);

    // Parse
    const parser = new DOMParser();
    const doc = parser.parseFromString(uniqueSvg, 'image/svg+xml');
    const svgRoot = doc.documentElement;
    if (svgRoot.nodeName !== 'svg') return false;

    // Import into document
    const imported = document.importNode(svgRoot, true);
    imported.setAttribute('width', entity.width);
    imported.setAttribute('height', entity.height);
    imported.setAttribute('x', '0');
    imported.setAttribute('y', '0');
    // Ensure viewBox is preserved for proper scaling
    if (!imported.getAttribute('viewBox')) {
      imported.setAttribute('viewBox', '0 0 48 48');
    }
    // SVG를 엔티티 영역에 완전히 채움 (비율 무시)
    // viewBox가 이미 콘텐츠에 맞게 잘려 있으므로 stretch해도 자연스러움
    imported.setAttribute('preserveAspectRatio', 'none');

    target.appendChild(imported);
    return true;
  }

  /**
   * Load SVG asset and replace placeholder.
   * Uses inline SVG embedding for reliable rendering.
   * Falls back to placeholder if fetch fails.
   */
  async loadSVGAsset(entity, svgPath) {
    // Skip ground platforms - they use a custom tiled visual
    if (entity.type === 'platform' && entity.platformData?.type === 'ground') return;
    try {
      const svgText = await this._fetchSVG(svgPath);
      if (!svgText.includes('<svg')) return;

      this._embedInlineSVG(entity, svgText);
    } catch (e) {
      // Keep placeholder
    }
  }

  /**
   * Swap player SVG asset for state changes (e.g. idle -> run)
   */
  async swapEntityAsset(entity, svgPath) {
    if (!entity.svgElement || !svgPath) return;
    if (entity._lastSwapPath === svgPath) return; // Already showing this
    entity._lastSwapPath = svgPath;
    try {
      const svgText = await this._fetchSVG(svgPath);
      if (!svgText.includes('<svg')) return;

      this._embedInlineSVG(entity, svgText);
    } catch (e) {
      // Keep current asset
    }
  }

  _createSVGElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  clearLayer(layerName) {
    const layer = this.layers[layerName];
    if (layer) layer.innerHTML = '';
  }

  clearAll() {
    for (const key of Object.keys(this.layers)) {
      if (key !== 'hud' && key !== 'ui') {
        this.layers[key].innerHTML = '';
      }
    }
  }
}
