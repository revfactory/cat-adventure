/**
 * AnimationSystem — 물리 상태 → animations.css 클래스 매핑
 * Phase 3: svg-artist CSS 애니메이션 클래스 통합
 */
export class AnimationSystem {
  constructor(renderer) {
    this.renderer = renderer;
    // Player state → animations.css class
    this.playerStateMap = {
      IDLE: 'cat-idle',
      RUNNING: 'cat-running',
      JUMPING: 'cat-jumping',
      FALLING: 'cat-falling',
      WALL_SLIDING: 'cat-wall-sliding',
      WALL_JUMPING: 'cat-wall-jumping',
      LANDING_SQUASH: 'cat-landing',
      HURT: 'cat-hurt',
      DEAD: 'cat-dead',
      HAPPY: 'cat-idle',
      COYOTE: 'cat-idle',
    };

    // Enemy AI state → class
    this.enemyStateMap = {
      PATROL: 'enemy-patrol',
      CHASE: '',
      ATTACK: '',
      STUNNED: 'enemy-stunned',
      IDLE: '',
      ALERT: '',
      CHARGE: '',
      FLY: 'crow-flying',
      DIVE: 'crow-diving',
      RISE: '',
    };

    // Item class
    this.itemClass = 'collectible item-floating';

    // SVG asset swap cache per entity
    this._lastAssetState = new Map();
  }

  update(scene) {
    if (!scene) return;

    for (const entity of scene.entities) {
      if (!entity.svgElement || !entity.active) continue;

      // Determine animation class
      let animClass = '';

      if (entity.type === 'player') {
        const state = entity.state || 'IDLE';
        animClass = this.playerStateMap[state] || '';

        // Swap SVG asset based on player state
        this._swapPlayerAsset(entity, state);
      } else if (entity.type === 'enemy' || entity.type === 'boss') {
        const state = entity.aiState || 'IDLE';
        animClass = this.enemyStateMap[state] || '';
      } else if (entity.type === 'item' && !entity.collected) {
        animClass = this.itemClass;
      } else if (entity.type === 'npc') {
        animClass = entity.rescued ? 'cat-idle' : '';
      }

      // Apply class to inner group (if available) to avoid CSS transform overriding SVG positioning
      const target = entity._svgInner || entity.svgElement;
      const baseClass = `entity-${entity.type}`;
      const newClass = animClass ? `${baseClass} ${animClass}` : baseClass;
      if (target.className.baseVal !== newClass) {
        target.className.baseVal = newClass;
      }

      // Invincibility blink (from physics controller or entity timer)
      const isInvincible = entity.invincible ||
        (entity.invincibleTimer !== undefined && entity.invincibleTimer > 0);
      if (isInvincible) {
        const t = entity.invincibleTimer || 0;
        target.style.opacity = Math.sin(t * 20) > 0 ? '1' : '0.3';
      } else if (target.style.opacity !== '') {
        target.style.opacity = '';
      }
    }
  }

  /**
   * Swap player SVG asset when state changes
   */
  _swapPlayerAsset(entity, state) {
    if (!entity.svgAssets) return;

    const lastState = this._lastAssetState.get(entity.id);
    if (lastState === state) return;

    const assetPath = entity.svgAssets[state] || entity.svgAssets.IDLE;
    if (!assetPath) return;

    this._lastAssetState.set(entity.id, state);

    // Async load — non-blocking
    this._loadAndSwap(entity, assetPath);
  }

  async _loadAndSwap(entity, svgPath) {
    if (this.renderer && this.renderer.swapEntityAsset) {
      await this.renderer.swapEntityAsset(entity, svgPath);
    }
  }
}
