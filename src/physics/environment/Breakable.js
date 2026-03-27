/**
 * Breakable — 파괴 가능 오브젝트
 * 충돌 임펄스 > threshold → 파편 RigidBody 생성 → 2초 후 fade
 */
import { Vector2 } from '../Vector2.js';
import { RigidBody } from '../RigidBody.js';
import { Polygon } from '../shapes/Polygon.js';

export class Breakable {
  constructor(body, options = {}) {
    this.body = body;
    this.threshold = options.threshold || 300;
    this.fragmentCount = options.fragments || 4;
    this.fadeDuration = options.fadeDuration || 2;
    this.isBroken = false;

    this.onBreak = options.onBreak || null;
    this._fragments = [];
  }

  checkBreak(impulseMagnitude) {
    if (this.isBroken) return null;
    if (impulseMagnitude < this.threshold) return null;

    this.isBroken = true;
    const fragments = this._createFragments();
    if (this.onBreak) this.onBreak(fragments);
    return fragments;
  }

  _createFragments() {
    const pos = this.body.position;
    const aabb = this.body.getAABB();
    const width = aabb.max.x - aabb.min.x;
    const height = aabb.max.y - aabb.min.y;
    const fragments = [];

    for (let i = 0; i < this.fragmentCount; i++) {
      // 파편 크기 (원래의 30~60%)
      const scale = 0.3 + Math.random() * 0.3;
      const fw = width * scale;
      const fh = height * scale;

      // 파편 위치 (원래 위치 근처에 랜덤 오프셋)
      const offsetX = (Math.random() - 0.5) * width * 0.5;
      const offsetY = (Math.random() - 0.5) * height * 0.5;

      const fragmentBody = new RigidBody({
        type: 'dynamic',
        position: { x: pos.x + offsetX, y: pos.y + offsetY },
        shape: Polygon.createBox(fw, fh),
        material: this.body.material,
        mass: this.body.mass / this.fragmentCount,
        angularDamping: 2,
        linearDamping: 0.5,
      });

      // 파편에 폭발 임펄스 적용
      const angle = (Math.PI * 2 * i) / this.fragmentCount + (Math.random() - 0.5) * 0.5;
      const force = 100 + Math.random() * 200;
      fragmentBody.applyImpulse(new Vector2(
        Math.cos(angle) * force,
        Math.sin(angle) * force - 150 // 약간 위로
      ));

      fragmentBody.angularVelocity = (Math.random() - 0.5) * 10;

      // fade 관련 데이터
      fragmentBody.userData = {
        isFragment: true,
        fadeTimer: this.fadeDuration,
        fadeDuration: this.fadeDuration,
        opacity: 1,
      };

      fragments.push(fragmentBody);
    }

    this._fragments = fragments;
    return fragments;
  }

  // 파편 업데이트 (fade out)
  static updateFragments(fragments, dt) {
    const alive = [];
    for (const frag of fragments) {
      if (!frag.userData || !frag.userData.isFragment) {
        alive.push(frag);
        continue;
      }

      frag.userData.fadeTimer -= dt;
      frag.userData.opacity = Math.max(0, frag.userData.fadeTimer / frag.userData.fadeDuration);

      if (frag.userData.fadeTimer > 0) {
        alive.push(frag);
      }
    }
    return alive;
  }
}
