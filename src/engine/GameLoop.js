/**
 * GameLoop — RAF 기반 게임 루프
 * 고정 timestep 물리 + 가변 렌더링, accumulator 패턴
 */
export class GameLoop {
  constructor({ physicsTimestep = 1 / 60, maxSubsteps = 5 } = {}) {
    this.physicsTimestep = physicsTimestep;
    this.maxSubsteps = maxSubsteps;
    this.accumulator = 0;
    this.lastTime = 0;
    this.rafId = null;
    this.running = false;
    this.paused = false;

    // Callback slots
    this.onInput = null;       // (dt) => void
    this.onPhysics = null;     // (fixedDt) => void — PhysicsWorld.update slot
    this.onUpdate = null;      // (dt) => void
    this.onRender = null;      // (alpha) => void
    this.onLateUpdate = null;  // (dt) => void

    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  _tick(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    if (this.paused) return;

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp large dt (e.g., tab was backgrounded)
    if (dt > 0.25) dt = 0.25;

    // Input
    if (this.onInput) this.onInput(dt);

    // Physics update — pass raw dt.
    // PhysicsWorld.update(dt) runs its own fixed-timestep accumulator internally.
    // When no physics world is attached, the game loop accumulator provides fallback stepping.
    if (this.onPhysics) {
      this.onPhysics(dt);
    }

    // Interpolation alpha for rendering (fallback; real alpha comes from PhysicsWorld)
    const alpha = 0;

    // Game logic update (variable dt)
    if (this.onUpdate) this.onUpdate(dt);

    // Render with interpolation
    if (this.onRender) this.onRender(alpha);

    // Late update (cleanup, particles, etc.)
    if (this.onLateUpdate) this.onLateUpdate(dt);
  }
}
