/**
 * PhysicsMaterial — 물리 머티리얼 (마찰, 반발, 밀도)
 * 7종 프리셋 제공
 */
export class PhysicsMaterial {
  constructor(friction = 0.5, restitution = 0.3, density = 1.0) {
    this.friction = friction;
    this.restitution = restitution;
    this.density = density;
  }

  clone() {
    return new PhysicsMaterial(this.friction, this.restitution, this.density);
  }

  static combine(a, b) {
    return new PhysicsMaterial(
      Math.sqrt(a.friction * b.friction),
      Math.min(a.restitution, b.restitution),
      (a.density + b.density) * 0.5
    );
  }
}

export const MATERIALS = {
  CONCRETE:  new PhysicsMaterial(0.8, 0.1, 2.4),
  WOOD:      new PhysicsMaterial(0.5, 0.3, 0.6),
  CARDBOARD: new PhysicsMaterial(0.4, 0.2, 0.2),
  METAL:     new PhysicsMaterial(0.3, 0.5, 7.8),
  RUBBER:    new PhysicsMaterial(0.9, 0.7, 1.0),
  ICE:       new PhysicsMaterial(0.05, 0.1, 0.9),
  BOUNCY:    new PhysicsMaterial(0.3, 0.9, 0.5),
};

export function getMaterial(name) {
  if (name instanceof PhysicsMaterial) return name;
  const mat = MATERIALS[name];
  if (!mat) {
    console.warn(`Unknown material: ${name}, using default`);
    return new PhysicsMaterial();
  }
  return mat;
}
