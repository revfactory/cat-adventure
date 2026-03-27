/**
 * main.js — 냥이의 도시 대모험 초기화, 게임 루프 연결
 * Phase 3: 물리엔진 + SVG 에셋 + 애니메이션 통합
 */
import { GameLoop } from './engine/GameLoop.js';
import { Camera } from './engine/Camera.js';
import { Scene } from './engine/Scene.js';
import { Renderer } from './engine/Renderer.js';
import { InputSystem } from './systems/InputSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { LevelLoader } from './levels/LevelLoader.js';
import { HUD } from './HUD.js';
import { Menu } from './Menu.js';
import { Dialog } from './Dialog.js';

class Game {
  constructor() {
    // Engine
    this.camera = new Camera(800, 600);
    this.renderer = new Renderer(this.camera);
    this.scene = new Scene();
    this.gameLoop = new GameLoop({ physicsTimestep: 1 / 60, maxSubsteps: 5 });

    // Systems
    this.input = new InputSystem();
    this.animation = new AnimationSystem(this.renderer);
    this.audio = new AudioSystem();
    this.particles = new ParticleSystem(this.renderer);

    // Level
    this.levelLoader = new LevelLoader();
    this.currentStage = 'stage1';
    this.stageOrder = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'];

    // UI
    this.hud = new HUD(this.renderer);
    this.menu = new Menu(this.renderer);
    this.dialog = new Dialog(this.renderer);

    // Physics (loaded dynamically)
    this.physicsWorld = null;
    this.characterController = null;
    this.physicsModules = null; // { PhysicsWorld, CharacterController, Capsule, Polygon, ... }

    // Game state
    this.state = 'menu'; // menu, playing, paused, dialog, clear, loading, ending
    this.checkpointX = 50;
    this.checkpointY = 400;

    // Alpha for interpolation (from physics world)
    this._renderAlpha = 0;

    // Dialogs per stage
    this.stageDialogs = {
      stage1: [
        { speaker: '나비', text: '동료들이 모두 사라졌어... 찾으러 가야해!', color: '#FF8C42' },
        { speaker: '나비', text: '← → 로 이동, Space로 점프! 가보자!', color: '#FF8C42' },
      ],
      stage2: [
        { speaker: '잿빛', text: '깜이가 공원의 높은 나무 위에 갇혀있어!', color: '#95A5A6' },
        { speaker: '나비', text: '시소와 그네를 이용해서 올라가 보자!', color: '#FF8C42' },
      ],
      stage3: [
        { speaker: '깜이', text: '시장에서 하양이 소식을 들었어. 상자 탑 아래 갇혀있대!', color: '#2C3E50' },
        { speaker: '나비', text: '상자들을 부수고 하양이를 구출하자!', color: '#FF8C42' },
      ],
      stage4: [
        { speaker: '하양', text: '삼돌이가 공사장에 묶여있어... 위험해!', color: '#ECF0F1' },
        { speaker: '나비', text: '크레인을 활용해서 삼돌이를 구하자!', color: '#FF8C42' },
      ],
      stage5: [
        { speaker: '삼돌', text: '코코가 불탱에게 잡혀있어! 옥상으로 올라가!', color: '#FF8C42' },
        { speaker: '나비', text: '불탱... 각오해라! 동료들을 되찾겠어!', color: '#FF8C42' },
      ],
    };
  }

  async init() {
    this.input.init();
    this.audio.init();
    this.hud.create();

    // Physics engine: default ON, ?physics=off to disable
    const params = new URLSearchParams(window.location.search);
    this.usePhysicsEngine = params.get('physics') !== 'off';

    if (this.usePhysicsEngine) {
      await this._loadPhysicsModules();
      console.log('Physics engine: ON (SAT collision, rigid body dynamics)');
    } else {
      console.log('Physics engine: OFF (fallback AABB physics)');
    }

    // Game loop callbacks
    this.gameLoop.onInput = (dt) => {
      this.input.update();
      this._handleGlobalInput();
    };

    this.gameLoop.onPhysics = (fixedDt) => {
      if (this.state !== 'playing') return;

      // jumpPressed 버퍼: InputSystem에서 감지된 점프 입력을 physics step까지 보존
      if (this.input.jumpPressed) {
        this._jumpPressedBuffer = true;
      }

      // Step physics world (accumulator is handled by PhysicsWorld internally)
      // CharacterController is updated via onPreStep at each substep
      if (this.physicsWorld) {
        this._renderAlpha = this.physicsWorld.update(fixedDt);
      }
    };

    this.gameLoop.onUpdate = (dt) => {
      if (this.state === 'playing') {
        // Sync entity positions from physics bodies
        this._syncPhysicsToEntities();

        // Update scene (collision checks, etc.)
        this.scene.update(dt);

        // Camera follow player
        if (this.scene.player) {
          this.camera.follow(this.scene.player, dt);
        }

        this._checkGameState();
      }
      if (this.state === 'dialog') {
        this.dialog.update(dt);
      }
    };

    this.gameLoop.onRender = (alpha) => {
      // Use physics alpha if available, otherwise gameloop alpha
      const renderAlpha = this.physicsWorld ? this._renderAlpha : alpha;
      this.renderer.render(renderAlpha, this.scene);
      this.animation.update(this.scene);
      this.hud.update(this.scene);
    };

    this.gameLoop.onLateUpdate = (dt) => {
      this.particles.update(dt);
    };

    // Menu actions
    this.menu.onAction = (action, data) => {
      this.audio.resume();
      this.audio.playMenuSelect();
      switch (action) {
        case 'start':
          this.startStage('stage1');
          break;
        case 'selectStage':
          this.startStage(data);
          break;
        case 'resume':
          this.resumeGame();
          break;
        case 'restart':
          this.startStage(this.currentStage);
          break;
        case 'mainMenu':
          this.showMainMenu();
          break;
        case 'nextStage':
          this._nextStage();
          break;
      }
    };

    // HUD pause callback
    this.hud.onPause = () => this.pauseGame();

    // Show main menu
    this.showMainMenu();
    this.gameLoop.start();
  }

  async _loadPhysicsModules() {
    try {
      const [
        { PhysicsWorld },
        { CharacterController },
        { Capsule },
        { Polygon },
        { Circle },
        { DistanceJoint },
        { RevoluteJoint },
        { SpringJoint },
        { PrismaticJoint },
        { Wind },
        { Buoyancy },
        { MovingPlatform },
        { Conveyor },
      ] = await Promise.all([
        import('./physics/PhysicsWorld.js'),
        import('./physics/character/CharacterController.js'),
        import('./physics/shapes/Capsule.js'),
        import('./physics/shapes/Polygon.js'),
        import('./physics/shapes/Circle.js'),
        import('./physics/constraints/DistanceJoint.js'),
        import('./physics/constraints/RevoluteJoint.js'),
        import('./physics/constraints/SpringJoint.js'),
        import('./physics/constraints/PrismaticJoint.js'),
        import('./physics/forces/Wind.js'),
        import('./physics/forces/Buoyancy.js'),
        import('./physics/environment/MovingPlatform.js'),
        import('./physics/environment/Conveyor.js'),
      ]);

      this.physicsModules = {
        PhysicsWorld, CharacterController,
        Capsule, Polygon, Circle,
        DistanceJoint, RevoluteJoint, SpringJoint, PrismaticJoint,
        Wind, Buoyancy, MovingPlatform, Conveyor,
      };
      console.log('Physics engine modules loaded');
    } catch (e) {
      console.warn('Physics engine not available, using fallback physics:', e.message);
      this.physicsModules = null;
    }
  }

  _createPhysicsWorld() {
    if (!this.physicsModules) return;
    const { PhysicsWorld } = this.physicsModules;
    this.physicsWorld = new PhysicsWorld({
      timestep: 1 / 60,
      maxSubsteps: 5,
      velocityIterations: 8,
      positionIterations: 3,
      cellSize: 128,
      gravity: { x: 0, y: 980 },
    });

    // 점프 입력 버퍼: physics step이 실행될 때까지 jumpPressed를 보존
    this._jumpPressedBuffer = false;

    // Pre-step: update character controller at each physics substep
    this.physicsWorld.onPreStep = (stepDt) => {
      if (this.characterController) {
        // 캐리 속도 제거 후 컨트롤러 업데이트, 다시 적용
        this.characterController.removeCarryVelocity();

        // jumpPressed는 InputSystem에서 한 프레임만 true.
        // physics accumulator가 그 프레임에서 step을 실행하지 않을 수 있으므로 버퍼링.
        const jumpPressed = this._jumpPressedBuffer;
        const inputState = {
          horizontal: (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0),
          jumpPressed: jumpPressed,
          jumpHeld: this.input.jump,
        };
        this.characterController.update(inputState, stepDt);
        // 첫 substep에서만 jumpPressed 전달, 이후 substep에서는 false
        this._jumpPressedBuffer = false;

        this.characterController.applyCarryVelocity(stepDt);
      }
    };

    // Physics events
    this.physicsWorld.onCollision = (manifold) => {
      // Collision audio/particles
      if (manifold.depth > 2) {
        const speed = Math.abs(manifold.bodyA.velocity?.y || 0) + Math.abs(manifold.bodyB.velocity?.y || 0);
        if (speed > 100) {
          this.particles.emitDust(
            (manifold.bodyA.position.x + manifold.bodyB.position.x) / 2,
            (manifold.bodyA.position.y + manifold.bodyB.position.y) / 2,
            3
          );
        }
      }
    };

    this.physicsWorld.onBreak = (originalBody, fragments) => {
      const pos = originalBody.position;
      this.particles.emitFragments(pos.x, pos.y, '#C49A6C', fragments.length + 2);
      this.audio.playStomp();
      this.scene.addScore(25);
      this.camera.shake(3, 0.15);
    };
  }

  _setupCharacterController(player) {
    if (!this.physicsModules || !this.physicsWorld) return;

    const { CharacterController, Capsule } = this.physicsModules;

    // Create cat body
    // collisionLayer=0x0001 (player layer), collisionMask=0x0001 (only collide with same layer)
    // Platforms also use layer 0x0001 by default, so player collides with platforms.
    // Physics objects use layer 0x0002 so they don't push the player.
    // 캐릭터 전용 머티리얼: friction=0 (collision solver가 수평 속도를 먹지 않도록).
    // CharacterController가 자체적으로 감속/마찰을 처리.
    // restitution=0 (착지 시 바운스 없음)
    const catBody = this.physicsWorld.createBody({
      type: 'dynamic',
      position: { x: player.x + player.width / 2, y: player.y + player.height / 2 },
      shape: new Capsule(12, 20),
      material: 'ICE',
      mass: 4,
      fixedRotation: true,
      userData: { entityId: player.id, type: 'player' },
      collisionLayer: 0x0001,
      collisionMask: 0x0001,
    });
    // Override material: zero friction, zero restitution
    catBody.material = { friction: 0, restitution: 0, density: 1.0 };

    player.rigidBody = catBody;

    // Create controller and link to player
    this.characterController = new CharacterController(catBody, this.physicsWorld, {
      mass: 4,
      moveForce: 2000,
      maxSpeed: 280,
      jumpImpulse: 500,
      airControl: 0.7,
      coyoteTime: 0.1,
      jumpBuffer: 0.15,
      wallSlideSpeed: 50,
      wallJumpHorizontal: 250,
      wallJumpVertical: -350,
      terminalVelocity: 500,
      landingSquashThreshold: 250,
    });

    // Link controller to player entity for direct access
    player.characterController = this.characterController;

    // Wire events
    this.characterController.onLand = (intensity) => {
      this.audio.playLand();
      if (intensity > 0.3) {
        this.particles.emitDust(player.x + player.width / 2, player.y + player.height, Math.ceil(intensity * 8));
      }
    };

    this.characterController.onJump = () => {
      this.audio.playJump();
      this.particles.emitDust(player.x + player.width / 2, player.y + player.height, 3);
    };

    this.characterController.onWallJump = (wallDir) => {
      this.audio.playJump();
    };

    this.characterController.onHurt = () => {
      this.audio.playHurt();
      this.camera.shake(6, 0.2);
    };
  }

  _syncPhysicsToEntities() {
    if (!this.physicsWorld) return;

    for (const entity of this.scene.entities) {
      if (!entity.rigidBody || entity.destroyed) continue;

      const body = entity.rigidBody;
      entity.prevX = entity.x;
      entity.prevY = entity.y;

      // 중심 정렬: 캡슐 크기 = 엔티티 크기이므로 중심=중심 → 하단=하단
      entity.x = body.position.x - entity.width / 2;
      entity.y = body.position.y - entity.height / 2;

      // 보간된 위치는 렌더링 전용
      if (body.getInterpolatedPosition) {
        const interpPos = body.getInterpolatedPosition(this._renderAlpha);
        entity.renderX = interpPos.x - entity.width / 2;
        entity.renderY = interpPos.y - entity.height / 2;
      } else {
        entity.renderX = entity.x;
        entity.renderY = entity.y;
      }

      entity.vx = body.velocity?.x || 0;
      entity.vy = body.velocity?.y || 0;
    }

    // Sync player-specific state from CharacterController
    const player = this.scene.player;
    if (player && this.characterController) {
      const ctrl = this.characterController;
      player.onGround = ctrl.isOnGround;
      player.onWallLeft = ctrl.isOnWall && ctrl.wallSlide?.wallDirection === -1;
      player.onWallRight = ctrl.isOnWall && ctrl.wallSlide?.wallDirection === 1;
      player.facingRight = ctrl.facingDirection > 0;
      player.invincible = ctrl.isInvincible;

      // Map controller state to player state
      const stateMap = {
        'idle': 'IDLE',
        'running': 'RUNNING',
        'jumping': 'JUMPING',
        'falling': 'FALLING',
        'wall_sliding': 'WALL_SLIDING',
        'wall_jumping': 'WALL_JUMPING',
        'landing': 'LANDING_SQUASH',
        'hurt': 'HURT',
      };
      const mappedState = stateMap[ctrl.state] || 'IDLE';
      if (player.state !== 'DEAD' && player.state !== 'HAPPY') {
        player.state = mappedState;
      }

      // Squash/stretch from controller
      const t = ctrl.getTransform();
      player.scaleX = Math.abs(t.scaleXStretch);
      player.scaleY = t.scaleY;
    }
  }

  showMainMenu() {
    this.state = 'menu';
    this.scene.clear();
    this.renderer.clearAll();
    this.hud.destroy();
    if (this.physicsWorld) {
      this.physicsWorld.clear();
      this.physicsWorld = null;
    }
    this.characterController = null;
    this.menu.showMainMenu();
  }

  async startStage(stageId) {
    this.state = 'loading';
    this.currentStage = stageId;
    this.menu.hide();
    this.scene.clear();
    this.renderer.clearAll();
    this.particles.clear();
    this.hud.create();

    // Create fresh physics world
    this._createPhysicsWorld();

    // Load level
    const levelData = await this.levelLoader.loadLevel(stageId);
    this.camera.setWorldBounds(levelData.width, levelData.height);
    this.camera.x = 0;
    this.camera.y = 0;

    // Populate scene (creates entities and physics bodies)
    const player = this.levelLoader.populateScene(
      this.scene, levelData, this.renderer,
      this.physicsWorld, this.physicsModules
    );
    player.input = this.input;
    player.audio = this.audio;

    // Setup character controller for player
    this._setupCharacterController(player);

    // Set checkpoint
    const spawn = levelData.spawn || { x: 50, y: 400 };
    this.checkpointX = spawn.x;
    this.checkpointY = spawn.y;

    // Show stage name
    this.hud.showStageName(levelData.name || stageId, 2);

    // Show intro dialog
    const dialogs = this.stageDialogs[stageId];
    if (dialogs && dialogs.length > 0) {
      this.state = 'dialog';
      this.dialog.show(dialogs, () => {
        this.state = 'playing';
      });
    } else {
      this.state = 'playing';
    }
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.gameLoop.pause();
    this.menu.showPauseMenu();
  }

  resumeGame() {
    this.menu.hide();
    this.state = 'playing';
    this.gameLoop.resume();
  }

  _handleGlobalInput() {
    if (this.input.pausePressed) {
      if (this.state === 'playing') {
        this.pauseGame();
      } else if (this.state === 'paused') {
        this.resumeGame();
      }
    }
  }

  _checkGameState() {
    const player = this.scene.player;
    if (!player) return;

    // Player death → respawn at checkpoint
    if (player.state === 'DEAD' && player.stateTimer > 1.5) {
      this.scene.deaths++;
      this.audio.playDeath();
      player.respawn(this.checkpointX, this.checkpointY);
      // Reset physics body position
      if (player.rigidBody) {
        player.rigidBody.setPosition(this.checkpointX + player.width / 2, this.checkpointY + player.height / 2);
        player.rigidBody.setVelocity(0, 0);
      }
      if (this.characterController) {
        this.characterController.state = 'idle';
        this.characterController._invincibleTimer = 2;
      }
    }

    // Fell off world
    if (player.y > (this.scene.levelData?.height || 600) + 100) {
      player.health = 0;
      player.state = 'DEAD';
      player.stateTimer = 0;
    }

    // Stage clear
    if (this.scene.state === 'clear') {
      this.state = 'clear';
      this.audio.playStageClear();
      this.menu.showStageClear(this.scene);
    }
  }

  _nextStage() {
    const idx = this.stageOrder.indexOf(this.currentStage);
    if (idx < this.stageOrder.length - 1) {
      this.startStage(this.stageOrder[idx + 1]);
    } else {
      this._showEnding();
    }
  }

  _showEnding() {
    this.state = 'ending';
    this.menu.hide();

    const rescued = this.scene.rescuedNPCs?.size || 0;
    // Count collected tuna cans across all stages
    const tunaCount = this._countCollectedTuna();
    const dialogs = [];

    if (rescued >= 5 && tunaCount >= 10) {
      // Perfect ending: all allies + 10 tuna cans
      dialogs.push({ speaker: '나비', text: '모두 다시 함께야! 도시는 다시 우리의 것이다 냥~', color: '#FF8C42' });
      dialogs.push({ speaker: '코코', text: '고마워 나비! 이제 옥상에서 파티하자!', color: '#F5E6CC' });
      dialogs.push({ speaker: '', text: '--- 완벽 엔딩: 옥상 파티 ---', color: '#FFD700' });
    } else if (rescued >= 5) {
      dialogs.push({ speaker: '나비', text: '모두 다시 함께야! 도시는 다시 우리의 것이다 냥~', color: '#FF8C42' });
      dialogs.push({ speaker: '코코', text: '고마워 나비! 이제 옥상에서 파티하자!', color: '#F5E6CC' });
    } else if (rescued >= 3) {
      dialogs.push({ speaker: '나비', text: '불탱을 물리쳤어! 하지만 아직 구하지 못한 친구가 있어...', color: '#FF8C42' });
    } else {
      dialogs.push({ speaker: '나비', text: '불탱을 물리쳤지만... 혼자서는 외로워 냥...', color: '#FF8C42' });
    }

    this.state = 'dialog';
    this.dialog.show(dialogs, () => {
      this.showMainMenu();
    });
  }

  _countCollectedTuna() {
    let count = 0;
    if (this.scene.collectedItems) {
      for (const entity of this.scene.entities) {
        if (entity.itemType === 'tuna' && entity.collected) count++;
      }
    }
    // Also count from collectedItems set (items already removed from scene)
    return Math.max(count, this.scene._tunaCount || 0);
  }
}

// Bootstrap
const game = new Game();
window._game = game; // Debug access
game.init().catch(console.error);
