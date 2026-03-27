/**
 * LevelLoader — 레벨 JSON 파싱, 엔티티 인스턴스화, 물리 바디/제약/힘 생성
 * Phase 3: 물리엔진 + SVG 에셋 통합
 */
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { NPC } from '../entities/NPC.js';
import { Item } from '../entities/Item.js';
import { Entity } from '../entities/Entity.js';

// SVG asset path mapping
const ASSET_MAP = {
  player: {
    IDLE: './assets/characters/cat-idle.svg',
    RUNNING: './assets/characters/cat-run.svg',
    JUMPING: './assets/characters/cat-jump.svg',
    FALLING: './assets/characters/cat-fall.svg',
    WALL_SLIDING: './assets/characters/cat-wallslide.svg',
    HURT: './assets/characters/cat-hurt.svg',
    DEAD: './assets/characters/cat-dead.svg',
    HAPPY: './assets/characters/cat-happy.svg',
  },
  enemy: {
    dog: './assets/characters/enemy-bulldog.svg',
    car: './assets/characters/enemy-car.svg',
    crow: './assets/characters/enemy-crow.svg',
    boss: './assets/characters/boss-bultang.svg',
  },
  npc: {
    'gray-cat': './assets/characters/ally-gray.svg',
    'black-cat': './assets/characters/ally-black.svg',
    'white-cat': './assets/characters/ally-white.svg',
    'calico-cat': './assets/characters/ally-calico.svg',
    'siamese-cat': './assets/characters/ally-siamese.svg',
  },
  item: {
    fish: './assets/items/item-fish.svg',
    milk: './assets/items/item-milk.svg',
    tuna: './assets/items/item-tuna.svg',
    health: './assets/items/item-bungeoppang.svg',
    star: './assets/items/item-star.svg',
    boots: './assets/items/item-boots.svg',
  },
  platform: {
    ground: './assets/objects/platform-ground.svg',
    platform: './assets/objects/platform-wood.svg',
    'one-way': './assets/objects/platform-oneway.svg',
    moving: './assets/objects/platform-metal.svg',
    collapsing: './assets/objects/platform-wood.svg',
    ice: './assets/objects/platform-ice.svg',
  },
  object: {
    trash_can: './assets/objects/obj-trashcan.svg',
    crate_cardboard_small: './assets/objects/obj-crate-cardboard-s.svg',
    crate_cardboard_large: './assets/objects/obj-crate-cardboard-l.svg',
    crate_wood: './assets/objects/obj-crate-wood.svg',
    clothesline: null,
    seesaw: './assets/objects/obj-seesaw.svg',
    swing: './assets/objects/obj-swing.svg',
    fountain: './assets/objects/obj-fountain.svg',
    awning: './assets/objects/obj-awning.svg',
    conveyor: './assets/objects/obj-conveyor.svg',
    crane: './assets/objects/obj-crane.svg',
    pipe: './assets/objects/obj-pipe.svg',
    scaffold: './assets/objects/obj-scaffold.svg',
    spring_pad: './assets/objects/obj-spring-pad.svg',
    water_tank: './assets/objects/obj-water-tank.svg',
    antenna: './assets/objects/obj-antenna.svg',
  },
};

export class LevelLoader {
  constructor() {
    this.levelCache = new Map();
  }

  async loadLevel(levelId) {
    if (this.levelCache.has(levelId)) {
      return JSON.parse(JSON.stringify(this.levelCache.get(levelId)));
    }
    try {
      const module = await import(`./data/${levelId}.json`);
      const data = module.default || module;
      this.levelCache.set(levelId, data);
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      console.warn(`Failed to load level ${levelId}, using fallback`);
      return this._fallbackLevel(levelId);
    }
  }

  /**
   * Instantiate all entities and create physics bodies/constraints/forces
   * @param {Scene} scene
   * @param {Object} levelData
   * @param {Renderer} renderer
   * @param {PhysicsWorld|null} world
   * @param {Object|null} pm — physics modules
   */
  populateScene(scene, levelData, renderer, world = null, pm = null) {
    scene.levelData = levelData;

    // Create player
    const spawn = levelData.spawn || { x: 50, y: 400 };
    const player = new Player(spawn.x, spawn.y);
    player.svgAssets = ASSET_MAP.player;
    scene.addEntity(player);

    // Create platforms
    if (levelData.platforms) {
      for (const p of levelData.platforms) {
        const platform = new Entity(p.x, p.y, p.width, p.height);
        platform.type = 'platform';
        platform.color = this._platformColor(p.material || 'CONCRETE');
        platform.label = '';
        platform.platformData = p;
        platform.svgAssetPath = ASSET_MAP.platform[p.type] || ASSET_MAP.platform.ground;
        scene.addEntity(platform);

        if (world && pm) {
          this._createPlatformBody(world, pm, p, platform);
        }
      }
    }

    // Create physics objects
    if (levelData.physics_objects) {
      for (const obj of levelData.physics_objects) {
        const w = obj.width || 40;
        const h = obj.height || 40;
        const ent = new Entity(obj.x, obj.y, w, h);
        ent.type = 'object';
        ent.color = this._materialColor(obj.material || 'WOOD');
        ent.label = '';
        ent.objectData = obj;
        ent.svgAssetPath = ASSET_MAP.object[obj.type] || null;
        scene.addEntity(ent);

        if (world && pm) {
          this._createPhysicsObjectBody(world, pm, obj, ent);
        }
      }
    }

    // Create forces
    if (levelData.forces && world && pm) {
      for (const f of levelData.forces) {
        this._createForce(world, pm, f);
      }
    }

    // Create enemies
    if (levelData.enemies) {
      for (const e of levelData.enemies) {
        const enemy = new Enemy(e.x, e.y, e.type, e);
        enemy.svgAssetPath = ASSET_MAP.enemy[e.type];
        scene.addEntity(enemy);

        if (world && pm) {
          this._createEnemyBody(world, pm, e, enemy);
        }
      }
    }

    // Create items
    if (levelData.items) {
      for (const i of levelData.items) {
        const item = new Item(i.x, i.y, i.type, i);
        item.svgAssetPath = ASSET_MAP.item[i.type];
        scene.addEntity(item);

        if (world && pm && i.physics) {
          this._createItemBody(world, pm, i, item);
        }
      }
    }

    // Create NPCs
    if (levelData.npcs) {
      for (const n of levelData.npcs) {
        const npc = new NPC(n.x, n.y, n.type, n);
        npc.svgAssetPath = ASSET_MAP.npc[n.type];
        scene.addEntity(npc);
      }
    }

    // Background parallax
    if (renderer && levelData.background?.layers) {
      renderer.setupBackground(levelData.background.layers);
    }

    // Load SVG assets for all entities
    if (renderer) {
      this._loadAllAssets(scene, renderer);
    }

    return player;
  }

  // === Physics body creation ===

  _createPlatformBody(world, pm, p, entity) {
    const { Polygon, MovingPlatform, Conveyor } = pm;
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;

    const isMoving = p.type === 'moving';
    const isConveyor = p.type === 'conveyor';

    const body = world.createBody({
      type: isMoving ? 'kinematic' : 'static',
      position: { x: cx, y: cy },
      shape: Polygon.createBox(p.width, p.height),
      material: p.material || 'CONCRETE',
      userData: { entityId: entity.id, type: 'platform', platformType: p.type },
    });

    entity.rigidBody = body;

    if (p.type === 'one-way') {
      world.addOneWayPlatform(body);
    }

    if (isMoving && p.path && MovingPlatform) {
      const mp = new MovingPlatform(body, {
        path: p.path,
        speed: p.speed || 60,
        pauseDuration: 0.5,
        pingPong: true,
      });
      world.addMovingPlatform(mp);
    }

    if (isConveyor && Conveyor) {
      const conveyor = new Conveyor(body, {
        beltSpeed: p.conveyorSpeed || 120,
        direction: { x: p.conveyorDir || 1, y: 0 },
        frictionForce: 500,
      });
      world.addConveyor(conveyor);
    }

    // Collapsing platform: remove after delay when stepped on
    if (p.type === 'collapsing') {
      const delay = p.collapseDelay || 3;
      entity._collapsing = false;
      entity._collapseTimer = delay;
      entity._collapseShaking = false;
      body.onCollision = (manifold, other) => {
        if (other.userData?.type === 'player' && !entity._collapsing) {
          entity._collapsing = true;
          entity._collapseTimer = delay;
          entity._collapseShaking = true;
        }
      };
      const origUpdate = entity.update.bind(entity);
      entity.update = (dt, scene) => {
        origUpdate(dt, scene);
        if (entity._collapsing) {
          entity._collapseTimer -= dt;
          // Shake effect
          if (entity._collapseShaking && entity._collapseTimer > 0.5) {
            entity.x += (Math.random() - 0.5) * 3;
          }
          if (entity._collapseTimer <= 0) {
            // Remove platform
            world.removeBody(body);
            entity.rigidBody = null;
            entity.active = false;
            entity.destroyed = true;
          }
        }
      };
    }
  }

  _createPhysicsObjectBody(world, pm, obj, entity) {
    const { Polygon, DistanceJoint, RevoluteJoint, SpringJoint } = pm;
    const w = obj.width || 40;
    const h = obj.height || 40;
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2;

    // Clotheslines are constraint-only
    if (obj.type === 'clothesline' && obj.x1 !== undefined && DistanceJoint) {
      const a1 = world.createBody({ type: 'static', position: { x: obj.x1, y: obj.y1 }, shape: Polygon.createBox(4, 4) });
      const a2 = world.createBody({ type: 'static', position: { x: obj.x2, y: obj.y2 }, shape: Polygon.createBox(4, 4) });
      world.addConstraint(new DistanceJoint(a1, a2, {
        maxLength: Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1),
        damping: 0.3, stiffness: 1.0,
      }));
      return;
    }

    const isDynamic = obj.mass && obj.mass > 0;
    const body = world.createBody({
      type: isDynamic ? 'dynamic' : 'static',
      position: { x: cx, y: cy },
      shape: Polygon.createBox(w, h),
      material: obj.material || 'WOOD',
      mass: obj.mass || 1,
      fixedRotation: false,
      breakable: obj.breakable || undefined,
      userData: { entityId: entity.id, type: obj.type },
      // 동적 오브젝트: layer 0x0002 (플레이어와 충돌 안 함, 플랫폼/다른 오브젝트와는 충돌)
      collisionLayer: isDynamic ? 0x0002 : 0x0001,
      collisionMask: isDynamic ? 0x0003 : 0xFFFF,  // 0x0003 = platform(0x0001) + objects(0x0002)
    });

    entity.rigidBody = body;

    // Spring-attached (antennas, awnings)
    if (obj.constraint === 'spring' && SpringJoint) {
      const anchor = world.createBody({
        type: 'static', position: { x: cx, y: cy + h / 2 },
        shape: Polygon.createBox(4, 4),
      });
      world.addConstraint(new SpringJoint(anchor, body, {
        anchorA: { x: 0, y: 0 }, anchorB: { x: 0, y: h / 2 },
        springConstant: obj.springStiffness || 400,
        dampingCoefficient: 0.4, restLength: 0,
      }));
    }

    // Revolute (seesaws)
    if (obj.constraint === 'revolute' && RevoluteJoint) {
      const pivot = world.createBody({
        type: 'static', position: { x: cx, y: cy + h / 2 + 5 },
        shape: Polygon.createBox(8, 8),
      });
      world.addConstraint(new RevoluteJoint(pivot, body, {
        anchorA: { x: 0, y: -5 }, anchorB: { x: 0, y: 0 },
      }));
    }

    // Distance (crane chains, swings)
    if (obj.constraint === 'distance' && obj.chainLength && DistanceJoint) {
      const anchor = world.createBody({
        type: 'static', position: { x: cx, y: cy - obj.chainLength },
        shape: Polygon.createBox(4, 4),
      });
      world.addConstraint(new DistanceJoint(anchor, body, {
        maxLength: obj.chainLength, damping: 0.2,
      }));
    }
  }

  _createEnemyBody(world, pm, data, entity) {
    const { Polygon } = pm;
    const body = world.createBody({
      type: 'dynamic',
      position: { x: data.x + entity.width / 2, y: data.y + entity.height / 2 },
      shape: Polygon.createBox(entity.width, entity.height),
      material: 'CONCRETE',
      mass: data.mass || 15,
      fixedRotation: true,
      userData: { entityId: entity.id, type: 'enemy', enemyType: data.type },
      // 적: layer 0x0004 (플레이어, 오브젝트와 물리 충돌 안 함)
      collisionLayer: 0x0004,
      collisionMask: 0x0005,  // 0x0005 = platform(0x0001) + enemy(0x0004)
    });
    entity.rigidBody = body;
  }

  _createItemBody(world, pm, data, entity) {
    const { Polygon } = pm;
    const body = world.createBody({
      type: 'dynamic',
      position: { x: data.x + entity.width / 2, y: data.y + entity.height / 2 },
      shape: Polygon.createBox(entity.width, entity.height),
      material: 'RUBBER',
      mass: data.mass || 0.5,
      userData: { entityId: entity.id, type: 'item' },
    });
    entity.rigidBody = body;
  }

  _createForce(world, pm, forceData) {
    const { Wind, Buoyancy } = pm;
    if (forceData.type === 'wind' && Wind) {
      world.addForce(new Wind({
        area: forceData.area,
        direction: forceData.direction,
        turbulence: forceData.turbulence || 0,
        oscillate: !!forceData.cyclePeriod,
        oscillatePeriod: forceData.cyclePeriod || 3,
      }));
    }
    if (forceData.type === 'buoyancy' && Buoyancy) {
      world.addForce(new Buoyancy({
        area: forceData.area,
        upForce: forceData.strength || 500,
        linearDrag: 3,
      }));
    }
  }

  // === SVG asset loading ===

  async _loadAllAssets(scene, renderer) {
    // Collect all unique SVG paths for preloading
    const paths = new Set();
    for (const entity of scene.entities) {
      const path = entity.svgAssetPath || entity.svgAssets?.IDLE;
      if (path) paths.add(path);
      // Also preload all animation states if available
      if (entity.svgAssets) {
        for (const p of Object.values(entity.svgAssets)) {
          if (p) paths.add(p);
        }
      }
    }

    // Preload all SVGs into cache, then assign to entities
    if (paths.size > 0 && renderer.preloadSVGs) {
      await renderer.preloadSVGs([...paths]);
    }

    for (const entity of scene.entities) {
      const path = entity.svgAssetPath || entity.svgAssets?.IDLE;
      if (path) {
        renderer.loadSVGAsset(entity, path);
      }
    }
  }

  _platformColor(material) {
    const colors = {
      CONCRETE: '#4A5568', WOOD: '#A0522D', METAL: '#718096',
      CARDBOARD: '#D4A574', RUBBER: '#E74C3C', ICE: '#AED6F1', BOUNCY: '#F39C12',
    };
    return colors[material] || '#4A5568';
  }

  _materialColor(material) {
    return this._platformColor(material);
  }

  _fallbackLevel(levelId) {
    return {
      id: levelId, name: '테스트 레벨', width: 3200, height: 600,
      background: { layers: [
        { image: 'bg-sky.svg', speed: 0.1 },
        { image: 'bg-far.svg', speed: 0.3 },
        { image: 'bg-near.svg', speed: 0.6 },
      ]},
      platforms: [
        { x: 0, y: 520, width: 3200, height: 80, type: 'ground', material: 'CONCRETE' },
        { x: 300, y: 420, width: 120, height: 20, type: 'platform', material: 'WOOD' },
        { x: 600, y: 350, width: 100, height: 20, type: 'one-way', material: 'WOOD' },
      ],
      physics_objects: [], forces: [],
      enemies: [{ type: 'dog', x: 800, y: 480, patrol: { min: 700, max: 1000 }, mass: 15 }],
      items: [
        { type: 'fish', x: 350, y: 390, points: 100 },
        { type: 'fish', x: 650, y: 320, points: 100 },
      ],
      npcs: [], goal: { x: 3000, y: 480 }, spawn: { x: 50, y: 400 },
    };
  }
}
