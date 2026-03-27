/**
 * NPC — 동료 고양이 (구출 대상, 상호작용)
 */
import { Entity } from './Entity.js';

const NPC_DATA = {
  'gray-cat': { name: '잿빛', color: '#95A5A6', rescueBonus: 'hint' },
  'black-cat': { name: '깜이', color: '#2C3E50', rescueBonus: 'speed' },
  'white-cat': { name: '하양', color: '#ECF0F1', rescueBonus: 'health' },
  'calico-cat': { name: '삼돌', color: '#FF8C42', rescueBonus: 'knockback' },
  'siamese-cat': { name: '코코', color: '#F5E6CC', rescueBonus: 'ending' },
};

export class NPC extends Entity {
  constructor(x, y, npcType = 'gray-cat', config = {}) {
    super(x, y, 36, 40);
    this.type = 'npc';

    const data = NPC_DATA[npcType] || NPC_DATA['gray-cat'];
    this.npcType = npcType;
    this.color = data.color;
    this.label = data.name;
    this.rescueBonus = data.rescueBonus;

    this.rescued = false;
    this.rescueCondition = config.rescue_condition || 'reach';
    this.trappedBy = config.trapped_by || null;

    // Speech bubble
    this.showBubble = false;
    this.bubbleTimer = 0;

    // Animation
    this.bobAngle = 0;
  }

  update(dt, scene) {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.rescued) {
      // Happy bounce
      this.bobAngle += dt * 6;
      this.scaleY = 1 + Math.sin(this.bobAngle) * 0.05;
      return;
    }

    // Idle bob
    this.bobAngle += dt * 3;
    this.y += Math.sin(this.bobAngle) * 0.3;

    // Show speech bubble when player is near
    const player = scene.player;
    if (player) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      this.showBubble = dist < 120;
    }
  }

  canRescue(scene) {
    if (this.rescued) return false;

    switch (this.rescueCondition) {
      case 'reach':
        return true; // Just reaching is enough
      case 'boss_defeat':
        // Check if boss is dead
        const enemies = scene.getEntitiesByType('Enemy');
        return enemies.some(e => e.enemyType === 'boss' && e.dead);
      default:
        return true;
    }
  }

  rescue(scene) {
    if (this.rescued) return;
    this.rescued = true;
    scene.rescuedNPCs.add(this.npcType);
    scene.addScore(500);

    // Apply bonus
    const player = scene.player;
    if (player) {
      player.triggerHappy(1.5);
      switch (this.rescueBonus) {
        case 'hint':
          // "고양이 직감" — show directional hints toward hidden items
          scene._hintSystemActive = true;
          break;
        case 'speed':
          player.speed *= 1.1;
          player.airSpeed *= 1.1;
          break;
        case 'health':
          player.maxHealth = 6;
          player.health = Math.min(player.health + 1, player.maxHealth);
          break;
        case 'knockback':
          player.knockbackResist = 0.5;
          break;
      }
    }

    // Visual feedback
    this.color = '#FFD700';
    if (this.svgElement) {
      this.svgElement.className.baseVal = 'entity-npc anim-happy';
    }
  }
}

export { NPC_DATA };
