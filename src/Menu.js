/**
 * Menu — 메인 메뉴, 스테이지 선택, 일시정지
 */
export class Menu {
  constructor(renderer) {
    this.renderer = renderer;
    this.uiLayer = renderer.layers.ui;
    this.currentMenu = null;
    this.onAction = null; // callback(action, data)
  }

  showMainMenu() {
    this._clear();
    this.currentMenu = 'main';

    const g = this._createOverlay();

    // Title
    this._addText(g, 400, 140, '냥이의 도시 대모험', 36, '#FFD700', 'bold');
    this._addText(g, 400, 180, 'Meow City Adventure', 16, '#BDC3C7');

    // Title logo SVG (with text fallback)
    const logoGroup = this._el('g');
    const logoFallback = this._addText(logoGroup, 400, 240, '=^._.^=', 48, '#FF8C42', 'bold');
    g.appendChild(logoGroup);
    this._loadTitleLogo(logoGroup, logoFallback);

    // Buttons
    this._addButton(g, 300, 320, 200, 50, '게임 시작', () => {
      this._emit('start');
    });
    this._addButton(g, 300, 390, 200, 50, '스테이지 선택', () => {
      this.showStageSelect();
    });

    // Controls info
    this._addText(g, 400, 500, '← → 이동  |  Space 점프  |  ESC 일시정지', 12, '#95A5A6');
    this._addText(g, 400, 520, '터치: 좌측=좌 | 중앙=우 | 우측=점프', 10, '#7F8C8D');

    this.uiLayer.appendChild(g);
  }

  showStageSelect() {
    this._clear();
    this.currentMenu = 'stage-select';

    const g = this._createOverlay();
    this._addText(g, 400, 80, '스테이지 선택', 28, '#FFD700', 'bold');

    const stages = [
      { id: 'stage1', name: '1. 골목길', desc: '첫 발걸음', color: '#E67E22' },
      { id: 'stage2', name: '2. 공원', desc: '높이 뛰어라', color: '#27AE60' },
      { id: 'stage3', name: '3. 시장', desc: '부수고 나아가라', color: '#E74C3C' },
      { id: 'stage4', name: '4. 공사장', desc: '위험을 넘어서', color: '#F39C12' },
      { id: 'stage5', name: '5. 옥상', desc: '마지막 대결', color: '#8E44AD' },
    ];

    stages.forEach((stage, i) => {
      const row = i < 3 ? 0 : 1;
      const col = i < 3 ? i : i - 3;
      const x = 120 + col * 220;
      const y = 140 + row * 200;

      const btn = this._el('g', { cursor: 'pointer' });
      btn.addEventListener('click', () => this._emit('selectStage', stage.id));

      const rect = this._el('rect', {
        x, y, width: 180, height: 160, rx: 10,
        fill: stage.color, opacity: 0.8,
        stroke: '#fff', 'stroke-width': 2,
      });
      btn.appendChild(rect);
      this._addText(btn, x + 90, y + 60, stage.name, 18, '#fff', 'bold');
      this._addText(btn, x + 90, y + 90, stage.desc, 12, '#ECF0F1');
      g.appendChild(btn);
    });

    // Back button
    this._addButton(g, 300, 520, 200, 40, '뒤로', () => {
      this.showMainMenu();
    });

    this.uiLayer.appendChild(g);
  }

  showPauseMenu() {
    this._clear();
    this.currentMenu = 'pause';

    const g = this._createOverlay(0.7);
    this._addText(g, 400, 200, '일시정지', 32, '#fff', 'bold');

    this._addButton(g, 300, 280, 200, 50, '계속하기', () => {
      this._emit('resume');
    });
    this._addButton(g, 300, 350, 200, 50, '다시 시작', () => {
      this._emit('restart');
    });
    this._addButton(g, 300, 420, 200, 50, '메인 메뉴', () => {
      this._emit('mainMenu');
    });

    this.uiLayer.appendChild(g);
  }

  showGameOver(scene) {
    this._clear();
    this.currentMenu = 'gameover';

    const g = this._createOverlay(0.8);
    this._addText(g, 400, 180, 'GAME OVER', 36, '#E74C3C', 'bold');
    this._addText(g, 400, 230, `점수: ${scene?.score || 0}`, 20, '#FFD700');

    this._addButton(g, 300, 300, 200, 50, '다시 시작', () => {
      this._emit('restart');
    });
    this._addButton(g, 300, 370, 200, 50, '메인 메뉴', () => {
      this._emit('mainMenu');
    });

    this.uiLayer.appendChild(g);
  }

  showStageClear(scene) {
    this._clear();
    this.currentMenu = 'clear';

    const g = this._createOverlay(0.8);
    this._addText(g, 400, 120, '스테이지 클리어!', 32, '#FFD700', 'bold');
    this._addText(g, 400, 170, `점수: ${scene?.score || 0}`, 22, '#fff');

    // Grade
    const deaths = scene?.deaths || 0;
    const rescued = scene?.rescuedNPCs?.size || 0;
    let grade = 'C';
    if (rescued > 0 && deaths === 0) grade = 'S';
    else if (rescued > 0 && deaths <= 2) grade = 'A';
    else if (rescued > 0) grade = 'B';

    const gradeColors = { S: '#FFD700', A: '#4ECDC4', B: '#3498DB', C: '#95A5A6' };
    this._addText(g, 400, 230, `등급: ${grade}`, 40, gradeColors[grade], 'bold');

    this._addText(g, 400, 280, `사망 횟수: ${deaths}`, 16, '#BDC3C7');
    this._addText(g, 400, 305, `동료 구출: ${rescued}/5`, 16, '#BDC3C7');

    this._addButton(g, 300, 370, 200, 50, '다음 스테이지', () => {
      this._emit('nextStage');
    });
    this._addButton(g, 300, 440, 200, 50, '메인 메뉴', () => {
      this._emit('mainMenu');
    });

    this.uiLayer.appendChild(g);
  }

  hide() {
    this._clear();
    this.currentMenu = null;
  }

  _emit(action, data) {
    if (this.onAction) this.onAction(action, data);
  }

  _clear() {
    this.uiLayer.innerHTML = '';
  }

  _createOverlay(opacity = 0.6) {
    const g = this._el('g', { class: 'menu-overlay visible' });
    const bg = this._el('rect', {
      x: 0, y: 0, width: 800, height: 600,
      fill: `rgba(0,0,0,${opacity})`,
    });
    g.appendChild(bg);
    return g;
  }

  _addText(parent, x, y, text, size = 16, fill = '#fff', weight = 'normal') {
    const t = this._el('text', {
      x, y,
      'text-anchor': 'middle',
      fill, 'font-size': size, 'font-weight': weight,
      'font-family': 'sans-serif',
    });
    t.textContent = text;
    parent.appendChild(t);
    return t;
  }

  _addButton(parent, x, y, w, h, text, onClick) {
    const btn = this._el('g', { cursor: 'pointer' });

    const rect = this._el('rect', {
      x, y, width: w, height: h, rx: 8,
      fill: '#2C3E50', stroke: '#4ECDC4', 'stroke-width': 2,
    });
    rect.addEventListener('mouseenter', () => rect.setAttribute('fill', '#34495E'));
    rect.addEventListener('mouseleave', () => rect.setAttribute('fill', '#2C3E50'));

    const t = this._el('text', {
      x: x + w / 2, y: y + h / 2 + 6,
      'text-anchor': 'middle',
      fill: '#fff', 'font-size': 16, 'font-family': 'sans-serif',
    });
    t.textContent = text;
    t.setAttribute('pointer-events', 'none');

    btn.appendChild(rect);
    btn.appendChild(t);
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
    return btn;
  }

  async _loadTitleLogo(container, fallback) {
    try {
      const resp = await fetch('./assets/ui/ui-title-logo.svg');
      if (!resp.ok) return;
      const svgText = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgRoot = doc.documentElement;
      const imported = document.importNode(svgRoot, true);
      const logoWidth = 300;
      const logoHeight = 90;
      imported.setAttribute('x', 400 - logoWidth / 2);
      imported.setAttribute('y', 195);
      imported.setAttribute('width', logoWidth);
      imported.setAttribute('height', logoHeight);
      if (fallback.parentNode === container) {
        container.replaceChild(imported, fallback);
      }
    } catch (e) {
      // Keep text fallback
    }
  }

  _el(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }
}
