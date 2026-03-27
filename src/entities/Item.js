/**
 * Item — 수집 아이템 (6종, 수집 판정)
 */
import { Entity } from './Entity.js';

const ITEM_TYPES = {
  fish: { name: '생선', color: '#4ECDC4', points: 100, effect: null, width: 32, height: 32 },
  milk: { name: '우유', color: '#ECF0F1', points: 50, effect: null, width: 28, height: 36 },
  tuna: { name: '참치캔', color: '#F1C40F', points: 200, effect: null, width: 32, height: 28 },
  health: { name: '붕어빵', color: '#E74C3C', points: 0, effect: 'heal', width: 32, height: 32 },
  star: { name: '무적 별', color: '#FFD700', points: 0, effect: 'invincible', width: 36, height: 36 },
  boots: { name: '스피드 부츠', color: '#9B59B6', points: 0, effect: 'speed', width: 32, height: 32 },
};

export class Item extends Entity {
  constructor(x, y, itemType = 'fish', config = {}) {
    const data = ITEM_TYPES[itemType] || ITEM_TYPES.fish;
    super(x, y, data.width, data.height);
    this.type = 'item';
    this.itemType = itemType;
    this.color = data.color;
    this.label = '';
    this.points = config.points ?? data.points;
    this.effect = data.effect;
    this.collected = false;
    this.hasPhysics = config.physics || false;

    // Bob animation
    this.bobAngle = Math.random() * Math.PI * 2;
    this.baseY = y;

    // Gravity for physics items
    this.gravity = this.hasPhysics ? 600 : 0;
  }

  update(dt, scene) {
    if (this.collected) return;
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.rigidBody) {
      this.x = this.rigidBody.position.x - this.width / 2;
      this.y = this.rigidBody.position.y - this.height / 2;
      return;
    }

    if (!this.hasPhysics) {
      // Floating bob animation
      this.bobAngle += dt * 3;
      this.y = this.baseY + Math.sin(this.bobAngle) * 4;
    } else {
      // Simple fallback physics for physics items
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      this.vx *= 0.98;

      // Ground collision
      if (scene.levelData) {
        for (const p of scene.levelData.platforms) {
          if (this.x + this.width > p.x && this.x < p.x + p.width &&
              this.y + this.height > p.y && this.y + this.height < p.y + 10) {
            this.y = p.y - this.height;
            this.vy = -this.vy * 0.3;
            if (Math.abs(this.vy) < 20) this.vy = 0;
          }
        }
      }
    }
  }

  collect(scene) {
    if (this.collected) return;
    this.collected = true;

    // Sound
    if (scene.player?.audio) {
      scene.player.audio.playCollect();
    }

    // Score
    if (this.points > 0) {
      scene.addScore(this.points);
    }

    // Effects
    const player = scene.player;
    if (player && this.effect) {
      switch (this.effect) {
        case 'heal':
          player.health = Math.min(player.health + 1, player.maxHealth);
          break;
        case 'invincible':
          player.invincible = true;
          player.invincibleTimer = 5;
          break;
        case 'speed':
          const origSpeed = player.speed;
          player.speed *= 1.5;
          player.airSpeed *= 1.5;
          setTimeout(() => {
            player.speed = origSpeed;
            player.airSpeed = origSpeed * 0.8;
          }, 10000);
          break;
      }
    }

    // Track collection
    scene.collectedItems.add(this.id);
    if (this.itemType === 'tuna') {
      scene._tunaCount = (scene._tunaCount || 0) + 1;
    }

    // Remove with animation delay
    this.active = false;
    setTimeout(() => {
      this.destroyed = true;
    }, 200);
  }
}

export { ITEM_TYPES };
