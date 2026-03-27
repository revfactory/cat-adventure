/**
 * Scene — 씬/레벨 관리, 엔티티 관리
 */
export class Scene {
  constructor() {
    this.entities = [];
    this.entitiesByType = new Map();
    this.player = null;
    this.levelData = null;
    this.state = 'playing'; // playing, paused, dialog, cutscene, gameover, clear
    this.score = 0;
    this.deaths = 0;
    this.rescuedNPCs = new Set();
    this.collectedItems = new Set();
  }

  addEntity(entity) {
    this.entities.push(entity);
    const type = entity.constructor.name;
    if (!this.entitiesByType.has(type)) {
      this.entitiesByType.set(type, []);
    }
    this.entitiesByType.get(type).push(entity);
    if (type === 'Player') {
      this.player = entity;
    }
    return entity;
  }

  removeEntity(entity) {
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) this.entities.splice(idx, 1);
    const type = entity.constructor.name;
    const list = this.entitiesByType.get(type);
    if (list) {
      const ti = list.indexOf(entity);
      if (ti !== -1) list.splice(ti, 1);
    }
    if (entity.svgElement && entity.svgElement.parentNode) {
      entity.svgElement.parentNode.removeChild(entity.svgElement);
    }
    entity.destroyed = true;
  }

  getEntitiesByType(typeName) {
    return this.entitiesByType.get(typeName) || [];
  }

  update(dt) {
    if (this.state !== 'playing') return;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.destroyed) {
        this.removeEntity(e);
        continue;
      }
      if (e.active) {
        e.update(dt, this);
      }
    }

    this._checkCollisions();
  }

  _checkCollisions() {
    const player = this.player;
    if (!player || !player.active || player.state === 'DEAD') return;

    // Player vs Items
    const items = this.getEntitiesByType('Item');
    for (const item of items) {
      if (!item.active || item.collected) continue;
      if (this._aabbOverlap(player, item)) {
        item.collect(this);
      }
    }

    // Player vs Enemies
    const enemies = this.getEntitiesByType('Enemy');
    for (const enemy of enemies) {
      if (!enemy.active || enemy.state === 'STUNNED' || enemy.dead) continue;
      if (this._aabbOverlap(player, enemy)) {
        // Stomp check: player falling and player bottom near enemy top
        const playerBottom = player.y + player.height;
        const enemyTop = enemy.y;
        if (player.vy > 0 && playerBottom - enemyTop < 16) {
          enemy.stomp(this);
          player.vy = -250; // Bounce
        } else if (!player.invincible) {
          player.hurt(enemy, this);
        }
      }
    }

    // Player vs NPCs
    const npcs = this.getEntitiesByType('NPC');
    for (const npc of npcs) {
      if (!npc.active || npc.rescued) continue;
      if (this._aabbOverlap(player, npc) && npc.canRescue(this)) {
        npc.rescue(this);
      }
    }

    // Player vs goal
    if (this.levelData && this.levelData.goal) {
      const g = this.levelData.goal;
      if (player.x + player.width > g.x && player.x < g.x + 40 &&
          player.y + player.height > g.y && player.y < g.y + 60) {
        this.state = 'clear';
        this.score += 1000;
      }
    }
  }

  _aabbOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  addScore(points) {
    this.score += points;
  }

  clear() {
    for (const e of [...this.entities]) {
      this.removeEntity(e);
    }
    this.entities = [];
    this.entitiesByType.clear();
    this.player = null;
    this.levelData = null;
    this.state = 'playing';
  }
}
