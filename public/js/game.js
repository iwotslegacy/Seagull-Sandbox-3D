import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

    const MAX_ROOM_PLAYERS = 12;

    const app = {
      paused: false,
      clock: new THREE.Clock(),
      keys: new Set(),
      cameraYaw: Math.PI * 0.24,
      cameraPitch: 0.42,
      cameraYawTarget: Math.PI * 0.24,
      cameraPitchTarget: 0.42,
      cameraDrag: {
        active: false,
        pointerId: null,
        x: 0,
        y: 0,
        moved: false
      },
      pointerLockWanted: false,
      seed: Math.floor(Math.random() * 999999999),
      rng: null,
      superPoop: {
        value: 0,
        charged: false
      },
      cameraShake: 0,
      poopSerial: 0,
      customization: loadCustomization(),
      multiplayer: {
        socket: null,
        connected: false,
        connecting: false,
        roomCode: null,
        playerId: null,
        playerCount: 1,
        lastSend: 0,
        remotePlayers: new Map()
      }
    };

    const input = {
      moveX: 0,
      moveY: 0,
      mobileMoveX: 0,
      mobileMoveY: 0,
      verticalMode: 0,
      mobileVertical: 0,
      moving: false
    };

    const player = {
      id: "local",
      group: null,
      visual: null,
      parts: {},
      beakAnchor: new THREE.Object3D(),
      yaw: 0,
      isFlying: false,
      carrying: null,
      surfaceY: 0,
      speedWalk: 4.7,
      speedFly: 8.6,
      climbSpeed: 4.6,
      descendSpeed: 4.2,
      anim: {
        peck: 0,
        grab: 0,
        poop: 0,
        land: 0
      }
    };

    const world = {
      scene: new THREE.Scene(),
      renderer: null,
      camera: null,
      colliders: [],
      solids: [],
      items: [],
      itemsById: new Map(),
      generated: [],
      spawnAnchors: [],
      effects: []
    };

    const COLORS = {
      sand: 0xf4d58d,
      wetSand: 0xe9c46a,
      ocean: 0x42b8e8,
      grass: 0x7ccf7a,
      boardwalk: 0xb77b4b,
      road: 0x778492,
      roadLine: 0xf8f9fa,
      white: 0xf8fbff,
      wing: 0xcbd5df,
      wingDark: 0x9ca9b5,
      featherTip: 0x5f6c78,
      beak: 0xf2a13b,
      leg: 0xee8f2e,
      poop: 0x8a5a32
    };

    const MODEL_URLS = {
      seagull: "./assets/models/seagull.glb",
      chips: "./assets/models/chips.glb",
      fish: "./assets/models/fish.glb",
      hotdog: "./assets/models/hotdog.glb",
      bread: "./assets/models/bread.glb",
      phone: "./assets/models/phone.glb",
      poop: "./assets/models/poop.glb",
      fries: "./assets/models/fries.glb",
      burger: "./assets/models/burger.glb",
      donut: "./assets/models/donut.glb",
      soda: "./assets/models/soda.glb",
      pizza: "./assets/models/pizza.glb",
      shell: "./assets/models/shell.glb",
      sunglasses: "./assets/models/sunglasses.glb",
      bottle: "./assets/models/bottle.glb"
    };

    const gltfLoader = new GLTFLoader();
    const modelCache = new Map();

    const CUSTOMIZER_KEY = "seagullCustomizerV32";

    function loadCustomization() {
      try {
        const saved = JSON.parse(localStorage.getItem(CUSTOMIZER_KEY) || "{}");
        return {
          name: String(saved.name || "").slice(0, 18),
          color: /^#[0-9a-f]{6}$/i.test(saved.color || "") ? saved.color : "#ffd166",
          style: String(saved.style || "classic").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "classic"
        };
      } catch {
        return { name: "", color: "#ffd166", style: "classic" };
      }
    }

    function saveCustomization(data = app.customization) {
      app.customization = {
        name: String(data.name || "").slice(0, 18),
        color: /^#[0-9a-f]{6}$/i.test(data.color || "") ? data.color : "#ffd166",
        style: String(data.style || "classic").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "classic"
      };
      localStorage.setItem(CUSTOMIZER_KEY, JSON.stringify(app.customization));
      return app.customization;
    }

    function customizationPayload() {
      const c = saveCustomization(app.customization);
      return {
        name: c.name || "Unnamed Gull",
        customization: {
          color: c.color,
          style: c.style
        }
      };
    }

    function colorHex(value) {
      return new THREE.Color(value || "#ffd166").getHex();
    }


    const ui = {
      pauseButton: document.getElementById("pauseButton"),
      pauseOverlay: document.getElementById("pauseOverlay"),
      resumeButton: document.getElementById("resumeButton"),
      multiplayerButton: document.getElementById("multiplayerButton"),
      restartButton: document.getElementById("restartButton"),
      newMapButton: document.getElementById("newMapButton"),
      controlsButton: document.getElementById("controlsButton"),
      customizeButton: document.getElementById("customizeButton"),
      leaveRoomButton: document.getElementById("leaveRoomButton"),
      multiplayerPanel: document.getElementById("multiplayerPanel"),
      controlsPanel: document.getElementById("controlsPanel"),
      customizePanel: document.getElementById("customizePanel"),
      createRoomButton: document.getElementById("createRoomButton"),
      joinRoomButton: document.getElementById("joinRoomButton"),
      roomCodeInput: document.getElementById("roomCodeInput"),
      roomStatus: document.getElementById("roomStatus"),
      roomCodeDisplay: document.getElementById("roomCodeDisplay"),
      playerCountDisplay: document.getElementById("playerCountDisplay"),
      copyRoomLinkButton: document.getElementById("copyRoomLinkButton"),
      gamePlayerName: document.getElementById("gamePlayerName"),
      gameGullColor: document.getElementById("gameGullColor"),
      gameGullStyle: document.getElementById("gameGullStyle"),
      applyCustomizerButton: document.getElementById("applyCustomizerButton"),
      superPoopHud: document.getElementById("superPoopHud"),
      superPoopFill: document.getElementById("superPoopFill"),
      superPoopPercent: document.getElementById("superPoopPercent"),
      joystick: document.getElementById("joystick"),
      stickKnob: document.getElementById("stickKnob"),
      upButton: document.getElementById("upButton"),
      downButton: document.getElementById("downButton"),
      eatButton: document.getElementById("eatButton"),
      interactButton: document.getElementById("interactButton"),
      poopButton: document.getElementById("poopButton")
    };

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function lerpAngle(a, b, t) {
      let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
      return a + diff * t;
    }

    function randomSeeded(seed) {
      let t = seed >>> 0;
      return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }

    function rand(min = 0, max = 1) {
      return min + (app.rng ? app.rng() : Math.random()) * (max - min);
    }

    function choose(list) {
      return list[Math.floor(rand(0, list.length))];
    }

    function mat(color, roughness = 0.82, metalness = 0) {
      return new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }

    function spawnEffectBurst(position, {
      color = 0xffffff,
      count = 10,
      size = 0.06,
      speed = 2.2,
      life = 0.65,
      spread = 1,
      gravity = 1.8
    } = {}) {
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(size * (0.75 + Math.random() * 0.55), 8, 6),
          mat(color, 0.55, 0)
        );
        mesh.position.copy(position);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        world.scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const lift = Math.random() * speed + speed * 0.25;
        const flat = Math.random() * speed * spread;

        world.effects.push({
          mesh,
          velocity: new THREE.Vector3(Math.cos(angle) * flat, lift, Math.sin(angle) * flat),
          life,
          maxLife: life,
          gravity
        });
      }
    }

    function updateEffects(dt) {
      for (const effect of [...world.effects]) {
        effect.life -= dt;
        effect.velocity.y -= effect.gravity * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.scale.setScalar(Math.max(0.01, effect.life / effect.maxLife));

        if (effect.life <= 0) {
          world.scene.remove(effect.mesh);
          const index = world.effects.indexOf(effect);
          if (index >= 0) world.effects.splice(index, 1);
        }
      }
    }

    function makeNameTag(text, color = "#ffd166") {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(8, 14, 24, 0.72)";
      roundRect(ctx, 18, 22, 476, 76, 28);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = "900 42px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = "#fff7df";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(text || "Gull").slice(0, 18), 256, 61);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.7, 0.68, 1);
      sprite.position.set(0, 2.32, 0);
      return sprite;
    }

    function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }


    function setObjectShadows(object, cast = true, receive = true) {
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = cast;
          child.receiveShadow = receive;
        }
      });
    }

    function cloneLoadedModel(gltf) {
      return gltf.scene.clone(true);
    }

    function tryAttachGLB(parent, key, {
      scale = 1,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      hideExistingChildren = true
    } = {}) {
      const url = MODEL_URLS[key];
      if (!url) return;

      function attach(gltf) {
        const model = cloneLoadedModel(gltf);
        model.name = `GLB_${key}`;
        model.position.set(position[0], position[1], position[2]);
        model.rotation.set(rotation[0], rotation[1], rotation[2]);
        model.scale.setScalar(scale);
        setObjectShadows(model, true, true);

        const existing = [...parent.children];
        parent.add(model);

        if (hideExistingChildren) {
          for (const child of existing) child.visible = false;
        }
      }

      if (modelCache.has(key)) {
        const cached = modelCache.get(key);
        if (cached) attach(cached);
        return;
      }

      modelCache.set(key, null);
      gltfLoader.load(
        url,
        (gltf) => {
          modelCache.set(key, gltf);
          attach(gltf);
        },
        undefined,
        () => {}
      );
    }

    function createRenderer() {
      world.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance"
      });
      world.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      world.renderer.setSize(window.innerWidth, window.innerHeight);
      world.renderer.shadowMap.enabled = true;
      world.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.appendChild(world.renderer.domElement);
    }

    function createCamera() {
      world.camera = new THREE.PerspectiveCamera(
        62,
        window.innerWidth / window.innerHeight,
        0.1,
        800
      );
      world.camera.position.set(0, 8, 10);
    }

    function createLights() {
      world.scene.background = new THREE.Color(0x92d6ff);
      world.scene.fog = new THREE.Fog(0x92d6ff, 110, 310);

      const hemi = new THREE.HemisphereLight(0xffffff, 0x5d86b2, 1.78);
      world.scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xffffff, 2.38);
      sun.position.set(-55, 72, 35);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 220;
      sun.shadow.camera.left = -150;
      sun.shadow.camera.right = 150;
      sun.shadow.camera.top = 150;
      sun.shadow.camera.bottom = -150;
      world.scene.add(sun);

      const fill = new THREE.DirectionalLight(0x8fd3ff, 0.54);
      fill.position.set(44, 28, -58);
      world.scene.add(fill);
    }

    function track(object) {
      world.generated.push(object);
      return object;
    }

    function clearGeneratedWorld() {
      for (const object of world.generated) world.scene.remove(object);
      world.generated.length = 0;
      world.colliders.length = 0;
      world.solids.length = 0;
      world.items.length = 0;
      world.itemsById.clear();
      world.spawnAnchors.length = 0;
    }

    function addBox({
      name,
      x,
      y,
      z,
      sx,
      sy,
      sz,
      color,
      cast = true,
      receive = true,
      collider = false,
      solid = false,
      parent = world.scene,
      generated = true,
      material = null
    }) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material || mat(color));
      mesh.name = name || "box";
      mesh.position.set(x, y + sy / 2, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      if (generated) track(mesh);

      if (collider) {
        world.colliders.push({
          type: "box",
          minX: x - sx / 2,
          maxX: x + sx / 2,
          minZ: z - sz / 2,
          maxZ: z + sz / 2,
          height: y + sy,
          label: name || "surface"
        });
      }

      if (solid) {
        world.solids.push({
          minX: x - sx / 2,
          maxX: x + sx / 2,
          minZ: z - sz / 2,
          maxZ: z + sz / 2,
          height: y + sy
        });
      }

      return mesh;
    }

    function addCylinder({
      name,
      x,
      y,
      z,
      radius = 1,
      height = 1,
      color,
      segments = 16,
      cast = true,
      receive = true,
      collider = false,
      parent = world.scene,
      generated = true
    }) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat(color));
      mesh.name = name || "cylinder";
      mesh.position.set(x, y + height / 2, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      if (generated) track(mesh);

      if (collider) {
        world.colliders.push({
          type: "circle",
          x,
          z,
          radius,
          height: y + height,
          label: name || "round surface"
        });
      }

      return mesh;
    }

    function addCone({
      name,
      x,
      y,
      z,
      radius = 1,
      height = 1,
      color,
      segments = 16,
      cast = true,
      receive = true,
      collider = false,
      parent = world.scene,
      generated = true
    }) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), mat(color));
      mesh.name = name || "cone";
      mesh.position.set(x, y + height / 2, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      if (generated) track(mesh);

      if (collider) {
        world.colliders.push({
          type: "circle",
          x,
          z,
          radius,
          height: y + height,
          label: name || "cone surface"
        });
      }

      return mesh;
    }

    function createWorld(seed = app.seed) {
      app.seed = Number(seed) || Math.floor(Math.random() * 999999999);
      app.rng = randomSeeded(app.seed);
      clearGeneratedWorld();

      const sand = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), mat(COLORS.sand));
      sand.rotation.x = -Math.PI / 2;
      sand.receiveShadow = true;
      world.scene.add(sand);
      track(sand);

      addBox({
        name: "wet sand strip",
        x: 0,
        y: 0.005,
        z: -92,
        sx: 320,
        sy: 0.04,
        sz: 28,
        color: COLORS.wetSand,
        cast: false,
        receive: true
      });

      const ocean = new THREE.Mesh(
        new THREE.PlaneGeometry(360, 130),
        new THREE.MeshStandardMaterial({
          color: COLORS.ocean,
          roughness: 0.34,
          transparent: true,
          opacity: 0.88
        })
      );
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(0, -0.045, -158);
      ocean.receiveShadow = true;
      world.scene.add(ocean);
      track(ocean);

      addBox({
        name: "long boardwalk",
        x: 0,
        y: 0.03,
        z: -40,
        sx: 292,
        sy: 0.18,
        sz: 9.4,
        color: COLORS.boardwalk,
        collider: true
      });

      addBox({
        name: "main road",
        x: 0,
        y: 0.025,
        z: 34,
        sx: 300,
        sy: 0.08,
        sz: 9,
        color: COLORS.road,
        cast: false,
        receive: true
      });

      addBox({
        name: "side road west",
        x: -54,
        y: 0.026,
        z: 34,
        sx: 8,
        sy: 0.08,
        sz: 210,
        color: COLORS.road,
        cast: false,
        receive: true
      });

      addBox({
        name: "side road east",
        x: 64,
        y: 0.026,
        z: 44,
        sx: 8,
        sy: 0.08,
        sz: 190,
        color: COLORS.road,
        cast: false,
        receive: true
      });

      for (let x = -138; x <= 138; x += 12) {
        addBox({
          name: "road line",
          x,
          y: 0.08,
          z: 34,
          sx: 5,
          sy: 0.035,
          sz: 0.22,
          color: COLORS.roadLine,
          cast: false,
          receive: false
        });
      }

      for (let z = -52; z <= 138; z += 12) {
        addBox({
          name: "side road line",
          x: -54,
          y: 0.08,
          z,
          sx: 0.22,
          sy: 0.035,
          sz: 5,
          color: COLORS.roadLine,
          cast: false,
          receive: false
        });
      }

      for (let z = -38; z <= 128; z += 12) {
        addBox({
          name: "side road line",
          x: 64,
          y: 0.08,
          z,
          sx: 0.22,
          sy: 0.035,
          sz: 5,
          color: COLORS.roadLine,
          cast: false,
          receive: false
        });
      }

      createPier(-112, -112, rand(44, 64));
      createPier(112, -110, rand(38, 54));
      createPier(0, -118, rand(34, 48));

      generateBuildings();
      generateBeachProps();
      generateTownProps();
      spawnItems();
    }

    function createPier(x, z, length) {
      addBox({
        name: "pier deck",
        x,
        y: 0.08,
        z,
        sx: 9,
        sy: 0.26,
        sz: length,
        color: 0x98613b,
        collider: true
      });

      for (let i = 0; i < length / 4; i++) {
        const pz = z - length / 2 + i * 4 + 2;
        addBox({
          name: "pier left rail",
          x: x - 4.95,
          y: 0.35,
          z: pz,
          sx: 0.32,
          sy: 0.65,
          sz: 1.85,
          color: 0x71482f,
          collider: true
        });
        addBox({
          name: "pier right rail",
          x: x + 4.95,
          y: 0.35,
          z: pz,
          sx: 0.32,
          sy: 0.65,
          sz: 1.85,
          color: 0x71482f,
          collider: true
        });
        addCylinder({
          name: "pier post",
          x: x - 3.7,
          y: -1.1,
          z: pz,
          radius: 0.18,
          height: 1.25,
          color: 0x56351e,
          segments: 8
        });
        addCylinder({
          name: "pier post",
          x: x + 3.7,
          y: -1.1,
          z: pz,
          radius: 0.18,
          height: 1.25,
          color: 0x56351e,
          segments: 8
        });
      }
    }

    function generateBuildings() {
      const palettes = [
        [0xffc7a7, 0xe76f51],
        [0xbde0fe, 0x457b9d],
        [0xcaffbf, 0x40916c],
        [0xffd6ff, 0x9d4edd],
        [0xfde2e4, 0xdb5461],
        [0xfff1a8, 0xf4a261],
        [0xcdb4db, 0x6d597a],
        [0xe9edc9, 0x606c38],
        [0xd8e2dc, 0x264653]
      ];

      const rows = [
        { z: 18, count: 10, minX: -136, gap: 28 },
        { z: 58, count: 13, minX: -142, gap: 23 },
        { z: 83, count: 12, minX: -132, gap: 24 },
        { z: 110, count: 10, minX: -118, gap: 25 },
        { z: 136, count: 8, minX: -96, gap: 27 }
      ];

      for (const row of rows) {
        for (let i = 0; i < row.count; i++) {
          if (rand() < 0.1) continue;
          const x = row.minX + i * row.gap + rand(-3, 3);
          const z = row.z + rand(-2.7, 2.7);
          const sx = rand(9, 17);
          const sz = rand(8, 15);
          const sy = rand(4.8, 13.5);
          const [bodyColor, roofColor] = choose(palettes);
          createBuilding(x, z, sx, sy, sz, bodyColor, roofColor);
        }
      }

      createShop(-38, -29, "snack");
      createShop(-13, -29, "arcade");
      createShop(13, -29, "ice cream");
      createShop(39, -29, "fish");
      createShop(68, -30, "souvenirs");
    }

    function createBuilding(x, z, sx, sy, sz, bodyColor, roofColor) {
      addBox({
        name: "building body",
        x,
        y: 0,
        z,
        sx,
        sy,
        sz,
        color: bodyColor,
        solid: true
      });

      addBox({
        name: "flat rooftop",
        x,
        y: sy,
        z,
        sx: sx + 0.65,
        sy: 0.4,
        sz: sz + 0.65,
        color: roofColor,
        collider: true,
        solid: true
      });

      addBox({
        name: "roof lip front",
        x,
        y: sy + 0.4,
        z: z - sz / 2,
        sx: sx + 0.9,
        sy: 0.3,
        sz: 0.35,
        color: roofColor,
        collider: true,
        solid: true
      });

      addBox({
        name: "door",
        x,
        y: 0.55,
        z: z - sz / 2 - 0.04,
        sx: 1.35,
        sy: 1.8,
        sz: 0.08,
        color: 0x463f3a,
        cast: false,
        receive: false
      });

      const awningColor = choose([0xef476f, 0x06d6a0, 0xffd166, 0x118ab2]);
      if (rand() < 0.65) {
        addBox({
          name: "awning",
          x,
          y: 2.25,
          z: z - sz / 2 - 0.45,
          sx: sx * 0.65,
          sy: 0.22,
          sz: 0.95,
          color: awningColor,
          collider: true
        });
      }

      const windowMat = mat(0xdff7ff, 0.28, 0.05);
      const windowRows = Math.max(1, Math.floor(sy / 2.5));
      const windowCols = Math.max(2, Math.floor(sx / 3.2));
      for (let r = 0; r < windowRows; r++) {
        for (let c = 0; c < windowCols; c++) {
          addBox({
            name: "window",
            x: x - sx / 2 + 1.3 + c * (sx - 2.6) / Math.max(1, windowCols - 1),
            y: 1.45 + r * 2.15,
            z: z - sz / 2 - 0.035,
            sx: 0.86,
            sy: 0.72,
            sz: 0.07,
            color: 0xdff7ff,
            cast: false,
            receive: false,
            material: windowMat
          });
        }
      }

      if (rand() < 0.55) {
        addBox({
          name: "roof vent",
          x: x + rand(-sx * 0.25, sx * 0.25),
          y: sy + 0.42,
          z: z + rand(-sz * 0.25, sz * 0.25),
          sx: 1.2,
          sy: 0.55,
          sz: 1,
          color: 0x6c757d,
          collider: true
        });
      }

      if (rand() < 0.4) {
        addCylinder({
          name: "roof water tank",
          x: x + rand(-sx * 0.25, sx * 0.25),
          y: sy + 0.42,
          z: z + rand(-sz * 0.25, sz * 0.25),
          radius: 0.82,
          height: 1.1,
          color: 0x7f5539,
          segments: 12,
          collider: true
        });
      }
    }

    function createShop(x, z, type) {
      const colors = {
        snack: [0xffbe0b, 0xfb5607],
        arcade: [0x845ec2, 0x00c2a8],
        "ice cream": [0xff90b3, 0x3a86ff],
        fish: [0x90e0ef, 0x0077b6],
        souvenirs: [0xcdb4db, 0x9d4edd]
      };
      const [bodyColor, roofColor] = colors[type] || [0xffbe0b, 0xfb5607];

      addBox({
        name: `${type} shop`,
        x,
        y: 0,
        z,
        sx: 12,
        sy: 3.3,
        sz: 6.5,
        color: bodyColor,
        solid: true
      });

      addBox({
        name: `${type} shop roof`,
        x,
        y: 3.3,
        z,
        sx: 13.6,
        sy: 0.45,
        sz: 7.4,
        color: roofColor,
        collider: true,
        solid: true
      });

      addBox({
        name: `${type} sign`,
        x,
        y: 3.25,
        z: z - 3.55,
        sx: 8.2,
        sy: 1,
        sz: 0.24,
        color: 0xf8f9fa,
        collider: true
      });

      world.spawnAnchors.push({ x, z: z - 5, kind: "shop" });
    }

    function generateBeachProps() {
      const umbrellaColors = [0xef476f, 0x118ab2, 0x06d6a0, 0xffbe0b, 0x8338ec];

      for (let i = 0; i < 80; i++) {
        const x = rand(-142, 142);
        const z = rand(-86, -47);
        if (rand() < 0.68) createUmbrella(x, z, choose(umbrellaColors));
        createTowel(x + rand(-2.5, 2.5), z + rand(-2.4, 2.4), choose(umbrellaColors));
        world.spawnAnchors.push({ x: x + rand(-1.8, 1.8), z: z + rand(-1.8, 1.8), kind: "beach" });
      }

      for (let i = 0; i < 18; i++) createBin(rand(-142, 142), rand(-42, -24));
      for (let i = 0; i < 10; i++) createBoat(rand(-142, 142), rand(-132, -96));
    }

    function generateTownProps() {
      for (let i = 0; i < 46; i++) {
        const x = rand(-140, 140);
        const z = rand(-32, 126);
        if (rand() < 0.52) {
          createCafeSet(x, z);
          world.spawnAnchors.push({ x, z, kind: "table" });
        } else {
          addBench(x, z);
        }
      }

      for (let i = 0; i < 42; i++) createBin(rand(-144, 144), rand(-32, 142));
      for (let i = 0; i < 68; i++) createLampPost(rand(-148, 148), rand(-42, 142));

      for (let i = 0; i < 18; i++) {
        const x = rand(-142, 142);
        const z = rand(-36, 88);
        addBox({
          name: "sign post",
          x,
          y: 0,
          z,
          sx: 0.24,
          sy: 2,
          sz: 0.24,
          color: 0x6b4f3a
        });
        addBox({
          name: "sign",
          x,
          y: 2.0,
          z,
          sx: rand(2.4, 4.2),
          sy: 0.95,
          sz: 0.18,
          color: 0xf8f9fa,
          collider: true
        });
      }

      for (let i = 0; i < 30; i++) createTree(rand(-145, 145), rand(22, 150));
      for (let i = 0; i < 16; i++) createCar(rand(-140, 140), choose([29, 39, 58, 82]));
    }

    function createCafeSet(x, z) {
      addCylinder({
        name: "cafe table",
        x,
        y: 0,
        z,
        radius: 0.92,
        height: 0.64,
        color: 0xf7ede2,
        segments: 18,
        collider: true
      });

      const chairColor = choose([0x6d597a, 0x2a9d8f, 0xe76f51, 0x457b9d]);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        addBox({
          name: "cafe chair",
          x: x + Math.cos(angle) * 1.42,
          y: 0,
          z: z + Math.sin(angle) * 1.42,
          sx: 0.7,
          sy: 0.55,
          sz: 0.7,
          color: chairColor,
          collider: true
        });
      }
    }

    function addBench(x, z) {
      const bench = new THREE.Group();
      bench.position.set(x, 0, z);
      bench.rotation.y = rand(0, Math.PI * 2);
      world.scene.add(bench);
      track(bench);

      addBox({
        name: "bench seat",
        x: 0,
        y: 0.35,
        z: 0,
        sx: 3.1,
        sy: 0.32,
        sz: 0.8,
        color: 0x8d5524,
        collider: false,
        parent: bench,
        generated: false
      });
      addBox({
        name: "bench back",
        x: 0,
        y: 0.9,
        z: 0.38,
        sx: 3.1,
        sy: 0.72,
        sz: 0.25,
        color: 0x7a461f,
        collider: false,
        parent: bench,
        generated: false
      });

      world.colliders.push({ type: "circle", x, z, radius: 1.8, height: 0.68, label: "bench" });
    }

    function createUmbrella(x, z, color) {
      addCylinder({
        name: "umbrella pole",
        x,
        y: 0,
        z,
        radius: 0.08,
        height: 2.1,
        color: 0x6b4f3a,
        segments: 8
      });
      const canopy = addCone({
        name: "umbrella canopy",
        x,
        y: 1.75,
        z,
        radius: 1.75,
        height: 0.9,
        color,
        segments: 18,
        collider: true
      });
      canopy.rotation.y = rand(0, Math.PI);
    }

    function createTowel(x, z, color) {
      const towel = addBox({
        name: "beach towel",
        x,
        y: 0.04,
        z,
        sx: 2.2,
        sy: 0.05,
        sz: 3.2,
        color,
        cast: false,
        receive: true
      });
      towel.rotation.y = rand(0, Math.PI);
    }

    function createBin(x, z) {
      addCylinder({
        name: "bin",
        x,
        y: 0,
        z,
        radius: 0.55,
        height: 1.15,
        color: choose([0x2d6a4f, 0x277da1, 0x577590]),
        segments: 14,
        collider: true
      });
    }

    function createLampPost(x, z) {
      addCylinder({
        name: "lamp post",
        x,
        y: 0,
        z,
        radius: 0.08,
        height: 3.8,
        color: 0x3a3a3a,
        segments: 8
      });
      addCylinder({
        name: "lamp head",
        x,
        y: 3.75,
        z,
        radius: 0.28,
        height: 0.26,
        color: 0xfff3b0,
        segments: 12,
        collider: true
      });
    }

    function createBoat(x, z) {
      const boat = new THREE.Group();
      boat.position.set(x, 0.08, z);
      boat.rotation.y = rand(-0.4, 0.4);
      world.scene.add(boat);
      track(boat);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.58, 1.62), mat(choose([0xffffff, 0xffd166, 0x90e0ef])));
      hull.scale.z = 0.7;
      hull.castShadow = true;
      hull.receiveShadow = true;
      boat.add(hull);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.22, 4), mat(0xffffff));
      nose.rotation.x = Math.PI / 2;
      nose.rotation.z = Math.PI / 4;
      nose.position.x = 2.55;
      nose.castShadow = true;
      boat.add(nose);

      world.colliders.push({ type: "circle", x, z, radius: 2.4, height: 0.72, label: "boat" });
    }

    function createTree(x, z) {
      addCylinder({
        name: "tree trunk",
        x,
        y: 0,
        z,
        radius: 0.18,
        height: 1.8,
        color: 0x7f5539,
        segments: 8
      });
      addCone({
        name: "tree top",
        x,
        y: 1.3,
        z,
        radius: 1.15,
        height: 2.1,
        color: choose([0x2d6a4f, 0x40916c, 0x588157]),
        segments: 12,
        collider: true
      });
    }

    function createCar(x, z) {
      const carColor = choose([0xef476f, 0x118ab2, 0xffbe0b, 0x06d6a0, 0xf8f9fa]);
      addBox({
        name: "car body",
        x,
        y: 0,
        z,
        sx: 3.8,
        sy: 0.75,
        sz: 1.8,
        color: carColor,
        collider: true
      });
      addBox({
        name: "car cabin",
        x: x + 0.15,
        y: 0.72,
        z,
        sx: 1.85,
        sy: 0.75,
        sz: 1.35,
        color: 0xdff7ff,
        collider: true
      });
    }

    function heightAt(x, z) {
      let height = 0;

      for (const c of world.colliders) {
        if (c.type === "box") {
          if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) height = Math.max(height, c.height);
        } else if (c.type === "circle") {
          const dx = x - c.x;
          const dz = z - c.z;
          if (dx * dx + dz * dz <= c.radius * c.radius) height = Math.max(height, c.height);
        }
      }

      return height;
    }

    function isInsideTallSolid(x, z) {
      for (const s of world.solids) {
        if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && s.height > 1.2) return true;
      }
      return false;
    }

    function isSolidWallForWalking(x, z, currentSurfaceY) {
      for (const s of world.solids) {
        if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
          if (s.height > currentSurfaceY + 0.62) return true;
        }
      }
      return false;
    }

    function isGroundLevelPosition(x, z) {
      return heightAt(x, z) <= 0.36 && !isInsideTallSolid(x, z);
    }

    function randomItemPosition() {
      if (world.spawnAnchors.length && rand() < 0.55) {
        const a = choose(world.spawnAnchors);
        return { x: a.x + rand(-2.3, 2.3), z: a.z + rand(-2.3, 2.3) };
      }

      const zones = [
        { x1: -144, x2: 144, z1: -38, z2: 28 },
        { x1: -146, x2: 146, z1: -88, z2: -48 },
        { x1: -144, x2: 144, z1: 42, z2: 146 }
      ];
      const zone = choose(zones);
      return { x: rand(zone.x1, zone.x2), z: rand(zone.z1, zone.z2) };
    }

    function findFloorSpawnPosition() {
      for (let attempt = 0; attempt < 90; attempt++) {
        const pos = randomItemPosition();
        if (isGroundLevelPosition(pos.x, pos.z)) return pos;
      }
      return { x: rand(-112, 112), z: rand(-36, -22) };
    }

    function createSeagullObject({ color = "#ffffff", style = "classic", name = "", remote = false } = {}) {
      const group = new THREE.Group();
      const visual = new THREE.Group();
      group.add(visual);

      const colorInt = new THREE.Color(color).getHex();

      const bodyGroup = new THREE.Group();
      visual.add(bodyGroup);

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 26, 18), mat(COLORS.white));
      body.scale.set(1.42, 0.72, 1.02);
      body.position.set(0, 0.72, 0);
      body.castShadow = true;
      bodyGroup.add(body);

      const back = new THREE.Mesh(new THREE.SphereGeometry(0.47, 22, 14), mat(colorInt === 0xffffff ? 0xe9eef5 : colorInt));
      back.scale.set(1.34, 0.28, 0.82);
      back.position.set(0, 0.91, -0.08);
      back.castShadow = true;
      bodyGroup.add(back);

      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.35, 22, 14), mat(0xffffff));
      chest.scale.set(1.05, 0.58, 0.75);
      chest.position.set(0, 0.62, 0.28);
      chest.castShadow = true;
      bodyGroup.add(chest);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 1.05, 0.56);
      visual.add(headGroup);

      const neck = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), mat(0xf8fbff));
      neck.scale.set(0.9, 0.7, 0.85);
      neck.position.set(0, -0.14, -0.08);
      neck.castShadow = true;
      headGroup.add(neck);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 26, 18), mat(COLORS.white));
      head.castShadow = true;
      headGroup.add(head);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 10), mat(colorInt === 0xffffff ? 0xd7dee8 : colorInt));
      cap.scale.set(0.86, 0.38, 0.72);
      cap.position.set(0, 0.18, -0.05);
      cap.castShadow = true;
      headGroup.add(cap);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.52, 16), mat(COLORS.beak));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.02, 0.39);
      beak.castShadow = true;
      headGroup.add(beak);

      const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 16), mat(0xe98e2a));
      lowerBeak.rotation.x = Math.PI / 2;
      lowerBeak.position.set(0, -0.075, 0.35);
      lowerBeak.castShadow = true;
      headGroup.add(lowerBeak);

      const eyeMat = mat(0x101010);
      const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
      leftEye.position.set(-0.14, 0.07, 0.28);
      headGroup.add(leftEye);

      const rightEye = leftEye.clone();
      rightEye.position.x = 0.14;
      headGroup.add(rightEye);

      const cheekMat = mat(0xffd6d6);
      const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), cheekMat);
      leftCheek.position.set(-0.18, -0.04, 0.285);
      leftCheek.scale.set(1.35, 0.8, 0.45);
      headGroup.add(leftCheek);

      const rightCheek = leftCheek.clone();
      rightCheek.position.x = 0.18;
      headGroup.add(rightCheek);

      addGullAccessories(headGroup, bodyGroup, style, color);

      const beakAnchor = new THREE.Object3D();
      beakAnchor.position.set(0, -0.035, 0.72);
      headGroup.add(beakAnchor);

      const leftWingRoot = new THREE.Group();
      leftWingRoot.position.set(-0.5, 0.8, -0.04);
      visual.add(leftWingRoot);

      const rightWingRoot = new THREE.Group();
      rightWingRoot.position.set(0.5, 0.8, -0.04);
      visual.add(rightWingRoot);

      createWing(leftWingRoot, -1, colorInt);
      createWing(rightWingRoot, 1, colorInt);

      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.74, -0.72);
      visual.add(tailGroup);

      for (let i = -1; i <= 1; i++) {
        const feather = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.78), mat(i === 0 ? COLORS.wingDark : COLORS.featherTip));
        feather.position.set(i * 0.16, 0, -0.24);
        feather.rotation.x = 0.16;
        feather.rotation.z = -i * 0.12;
        feather.castShadow = true;
        tailGroup.add(feather);
      }

      const leftLeg = createLeg(-0.2);
      const rightLeg = createLeg(0.2);
      visual.add(leftLeg.root, rightLeg.root);

      const parts = { bodyGroup, headGroup, leftWingRoot, rightWingRoot, tailGroup, leftLeg, rightLeg };

      if (!remote) {
        player.beakAnchor = beakAnchor;
        tryAttachGLB(visual, "seagull", {
          scale: 1,
          position: [0, 0, 0],
          rotation: [0, Math.PI, 0],
          hideExistingChildren: true
        });
      }

      if (name) {
        const nameTag = makeNameTag(name, color);
        group.add(nameTag);
      }

      return {
        group,
        visual,
        parts,
        beakAnchor,
        yaw: 0,
        isFlying: false,
        moving: false,
        target: {
          position: new THREE.Vector3(),
          yaw: 0,
          isFlying: false,
          moving: false,
          carrying: null
        },
        anim: {
          peck: 0,
          grab: 0,
          poop: 0,
          land: 0
        }
      };
    }


    function addGullAccessories(headGroup, bodyGroup, style, color) {
      const accent = colorHex(color);
      const dark = 0x111827;

      if (style === "punk") {
        for (let i = -1; i <= 1; i++) {
          const crest = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 8), mat(accent));
          crest.position.set(i * 0.075, 0.43 - Math.abs(i) * 0.04, -0.02);
          crest.rotation.x = -0.35 + i * 0.04;
          crest.castShadow = true;
          headGroup.add(crest);
        }
      }

      if (style === "captain") {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.13, 18), mat(0x1f2937, 0.5, 0.05));
        hat.position.set(0, 0.39, -0.02);
        hat.castShadow = true;
        headGroup.add(hat);

        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.18), mat(accent));
        brim.position.set(0, 0.32, 0.14);
        brim.castShadow = true;
        headGroup.add(brim);
      }

      if (style === "bandit") {
        const mask = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.105, 0.04), mat(dark));
        mask.position.set(0, 0.055, 0.325);
        mask.castShadow = true;
        headGroup.add(mask);
      }

      if (style === "fancy") {
        const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 3), mat(accent));
        bowLeft.rotation.z = Math.PI / 2;
        bowLeft.position.set(-0.12, -0.44, 0.04);
        bowLeft.castShadow = true;
        bodyGroup.add(bowLeft);

        const bowRight = bowLeft.clone();
        bowRight.rotation.z = -Math.PI / 2;
        bowRight.position.x = 0.12;
        bodyGroup.add(bowRight);

        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mat(0x111827));
        knot.position.set(0, -0.44, 0.04);
        knot.castShadow = true;
        bodyGroup.add(knot);
      }
    }

    function createWing(root, side, accentColor) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.95), mat(COLORS.wing));
      upper.position.set(side * 0.18, 0, -0.15);
      upper.rotation.z = side * 0.1;
      upper.castShadow = true;
      root.add(upper);

      for (let i = 0; i < 5; i++) {
        const featherColor = i === 0 && accentColor !== 0xffffff ? accentColor : (i > 2 ? COLORS.featherTip : COLORS.wingDark);
        const feather = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.72 - i * 0.055), mat(featherColor));
        feather.position.set(side * (0.14 + i * 0.115), -0.02, -0.34 - i * 0.06);
        feather.rotation.z = side * (0.16 + i * 0.025);
        feather.castShadow = true;
        root.add(feather);
      }
    }

    function createLeg(x) {
      const root = new THREE.Group();
      root.position.set(x, 0.35, 0.08);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), mat(COLORS.leg));
      leg.position.y = -0.12;
      leg.castShadow = true;
      root.add(leg);

      const foot = new THREE.Group();
      foot.position.set(0, -0.32, 0.1);
      root.add(foot);

      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.045, 0.27), mat(COLORS.leg));
      palm.castShadow = true;
      foot.add(palm);

      for (let i = -1; i <= 1; i++) {
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.22), mat(COLORS.leg));
        toe.position.set(i * 0.08, 0, 0.18);
        toe.rotation.y = i * 0.28;
        toe.castShadow = true;
        foot.add(toe);
      }

      return { root, leg, foot };
    }

    function createPlayer() {
      const c = saveCustomization(app.customization);
      const gull = createSeagullObject({
        color: c.color,
        style: c.style,
        name: c.name,
        remote: false
      });
      player.group = gull.group;
      player.visual = gull.visual;
      player.parts = gull.parts;
      player.beakAnchor = gull.beakAnchor;
      player.group.position.set(-10, 0, -32);
      world.scene.add(player.group);
    }

    function rebuildLocalSeagullAppearance() {
      if (!player.group) return;

      const oldPosition = player.group.position.clone();
      const oldRotationY = player.group.rotation.y;
      const oldYaw = player.yaw;
      const wasFlying = player.isFlying;
      const carried = player.carrying;

      world.scene.remove(player.group);

      const c = saveCustomization(app.customization);
      const gull = createSeagullObject({
        color: c.color,
        style: c.style,
        name: c.name,
        remote: false
      });

      player.group = gull.group;
      player.visual = gull.visual;
      player.parts = gull.parts;
      player.beakAnchor = gull.beakAnchor;
      player.group.position.copy(oldPosition);
      player.group.rotation.y = oldRotationY;
      player.yaw = oldYaw;
      player.isFlying = wasFlying;
      player.carrying = carried;

      world.scene.add(player.group);

      spawnEffectBurst(oldPosition.clone().add(new THREE.Vector3(0, 1.2, 0)), {
        color: colorHex(c.color),
        count: 18,
        size: 0.055,
        speed: 1.8,
        life: 0.75
      });

      if (app.multiplayer.connected) {
        sendSocket({
          type: "playerCustomize",
          name: c.name || "Unnamed Gull",
          customization: { color: c.color, style: c.style }
        });
      }
    }

    function createItemMesh(type) {
      const group = new THREE.Group();

      if (type === "chips") {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.18), mat(0xff006e));
        bag.castShadow = true;
        group.add(bag);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.2), mat(0xffd166));
        stripe.position.y = 0.08;
        stripe.castShadow = true;
        group.add(stripe);
      }

      if (type === "fries") {
        const cup = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.48, 4), mat(0xef476f));
        cup.rotation.y = Math.PI / 4;
        cup.castShadow = true;
        group.add(cup);
        for (let i = 0; i < 5; i++) {
          const fry = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.045), mat(0xffd166));
          fry.position.set(rand(-0.13, 0.13), 0.22, rand(-0.08, 0.08));
          fry.rotation.z = rand(-0.25, 0.25);
          fry.castShadow = true;
          group.add(fry);
        }
      }

      if (type === "fish") {
        const fish = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 12), mat(0x6ec6ff));
        fish.scale.set(1.65, 0.55, 0.55);
        fish.castShadow = true;
        group.add(fish);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 3), mat(0x4da3d9));
        tail.rotation.z = Math.PI / 2;
        tail.position.x = -0.44;
        tail.castShadow = true;
        group.add(tail);
      }

      if (type === "hotdog") {
        const bun = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.3), mat(0xf4a261));
        bun.castShadow = true;
        group.add(bun);
        const sausage = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.84, 14), mat(0xb23a48));
        sausage.rotation.z = Math.PI / 2;
        sausage.position.y = 0.12;
        sausage.castShadow = true;
        group.add(sausage);
      }

      if (type === "burger") {
        const bunTop = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10), mat(0xf4a261));
        bunTop.scale.set(1.3, 0.38, 1.1);
        bunTop.position.y = 0.17;
        bunTop.castShadow = true;
        group.add(bunTop);
        const patty = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.46), mat(0x6f1d1b));
        patty.position.y = 0.03;
        patty.castShadow = true;
        group.add(patty);
      }

      if (type === "donut") {
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.075, 12, 24), mat(0xf4a261));
        torus.rotation.x = Math.PI / 2;
        torus.castShadow = true;
        group.add(torus);
        const icing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 12, 24), mat(0xffafcc));
        icing.rotation.x = Math.PI / 2;
        icing.position.y = 0.035;
        icing.castShadow = true;
        group.add(icing);
      }

      if (type === "soda") {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.46, 16), mat(0xef233c, 0.55, 0.12));
        can.castShadow = true;
        group.add(can);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.035, 16), mat(0xd9d9d9, 0.3, 0.25));
        top.position.y = 0.25;
        top.castShadow = true;
        group.add(top);
      }

      if (type === "pizza") {
        const slice = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.52, 3), mat(0xffd166));
        slice.rotation.x = Math.PI / 2;
        slice.rotation.z = Math.PI;
        slice.castShadow = true;
        group.add(slice);
        const pep = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0xc1121f));
        pep.position.set(0.08, 0.055, 0.05);
        pep.castShadow = true;
        group.add(pep);
      }

      if (type === "bread") {
        const bread = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.37), mat(0xf1c27d));
        bread.castShadow = true;
        group.add(bread);
      }

      if (type === "phone") {
        const phone = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.58), mat(0x20232a, 0.55, 0.1));
        phone.castShadow = true;
        group.add(phone);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.44), mat(0x80edff, 0.35, 0.05));
        screen.position.y = 0.045;
        group.add(screen);
      }

      if (type === "shell") {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 8), mat(0xffd6d6));
        shell.scale.set(1.2, 0.32, 0.85);
        shell.castShadow = true;
        group.add(shell);
      }

      if (type === "sunglasses") {
        const frame = mat(0x111111, 0.45, 0.1);
        const left = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.12), frame);
        left.position.x = -0.12;
        left.castShadow = true;
        group.add(left);
        const right = left.clone();
        right.position.x = 0.12;
        group.add(right);
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.04), frame);
        bridge.castShadow = true;
        group.add(bridge);
      }

      if (type === "bottle") {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.58, 12), mat(0x80ed99, 0.42, 0.05));
        bottle.castShadow = true;
        group.add(bottle);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 12), mat(0x80ed99, 0.42, 0.05));
        neck.position.y = 0.38;
        neck.castShadow = true;
        group.add(neck);
      }

      if (type === "poop") {
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), mat(COLORS.poop));
        base.scale.set(1.35, 0.28, 1.25);
        base.position.y = 0.04;
        base.castShadow = true;
        group.add(base);
        const mid = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mat(0x75491f));
        mid.scale.set(1.1, 0.5, 1.0);
        mid.position.y = 0.16;
        mid.castShadow = true;
        group.add(mid);
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat(0x5f3a18));
        top.position.set(0.07, 0.28, 0.01);
        top.castShadow = true;
        group.add(top);
      }

      tryAttachGLB(group, type, { scale: 1, hideExistingChildren: true });
      return group;
    }

    function spawnItem(type, x, z, id = null, options = {}) {
      const edibleTypes = new Set(["chips", "fish", "hotdog", "bread", "fries", "burger", "donut", "soda", "pizza", "poop"]);
      const mesh = createItemMesh(type);
      const y = options.y ?? (heightAt(x, z) + 0.2);
      mesh.position.set(x, y, z);
      mesh.rotation.y = options.ry ?? rand(0, Math.PI * 2);
      mesh.rotation.x = options.rx ?? 0;
      mesh.rotation.z = options.rz ?? 0;
      world.scene.add(mesh);
      track(mesh);

      const item = {
        id: id || `item_${world.items.length}`,
        type,
        edible: edibleTypes.has(type),
        mesh,
        carried: false,
        carriedBy: null,
        velocity: new THREE.Vector3(),
        radius: 0.48,
        splatted: type === "poop" || Boolean(options.splatted),
        lifetime: type === "poop" ? 45 : Infinity,
        explosive: Boolean(options.explosive),
        explosionDone: false,
        dynamic: Boolean(options.dynamic),
        createdAt: options.createdAt || Date.now()
      };

      world.items.push(item);
      world.itemsById.set(item.id, item);
      return item;
    }

    function spawnItems() {
      const itemTypes = [
        "chips", "chips", "chips", "fries", "fries",
        "fish", "fish",
        "hotdog", "hotdog",
        "burger", "burger",
        "donut", "donut",
        "soda", "soda",
        "pizza", "pizza",
        "bread", "bread", "bread",
        "shell", "shell", "sunglasses", "bottle",
        "phone" // rare because it only appears once in a large weighted list
      ];

      for (let i = 0; i < 165; i++) {
        const pos = findFloorSpawnPosition();
        spawnItem(choose(itemTypes), pos.x, pos.z, `seed_${i}`);
      }
    }

    function removeItem(item, broadcast = false) {
      const index = world.items.indexOf(item);
      if (index >= 0) world.items.splice(index, 1);
      world.itemsById.delete(item.id);
      world.scene.remove(item.mesh);
      const generatedIndex = world.generated.indexOf(item.mesh);
      if (generatedIndex >= 0) world.generated.splice(generatedIndex, 1);

      if (broadcast) {
        sendItemUpdate({
          id: item.id,
          type: item.type,
          exists: false
        });
      }
    }

    function nearestItem({ edibleOnly = false } = {}) {
      let best = null;
      let bestDist = Infinity;
      const pos = player.group.position;

      for (const item of world.items) {
        if (item.carried || item.carriedBy) continue;
        if (edibleOnly && !item.edible) continue;

        const dist = item.mesh.position.distanceTo(pos);
        if (dist < bestDist && dist < 1.85) {
          best = item;
          bestDist = dist;
        }
      }

      return best;
    }

    function foodChargeValue(type) {
      return {
        chips: 6,
        bread: 5,
        fish: 10,
        hotdog: 14,
        fries: 8,
        burger: 15,
        donut: 9,
        soda: 7,
        pizza: 12,
        phone: 0,
        poop: 0
      }[type] || 0;
    }

    function addSuperPoopCharge(amount) {
      if (app.superPoop.charged) return;
      app.superPoop.value = clamp(app.superPoop.value + amount, 0, 100);
      if (app.superPoop.value >= 100) {
        app.superPoop.value = 100;
        app.superPoop.charged = true;
      }
      updateSuperPoopHud();
    }

    function resetSuperPoopCharge() {
      app.superPoop.value = 0;
      app.superPoop.charged = false;
      updateSuperPoopHud();
    }

    function updateSuperPoopHud() {
      const percent = Math.round(clamp(app.superPoop.value, 0, 100));
      ui.superPoopFill.style.width = `${percent}%`;
      ui.superPoopPercent.textContent = app.superPoop.charged ? "READY" : `${percent}%`;
      ui.superPoopHud.classList.toggle("charged", app.superPoop.charged);
    }

    function interact() {
      if (app.paused) return;

      player.anim.grab = 0.22;

      if (player.carrying) {
        const item = player.carrying;
        item.carried = false;
        item.carriedBy = null;
        player.carrying = null;
        spawnEffectBurst(item.mesh.position.clone(), { color: 0xffffff, count: 7, size: 0.045, speed: 1.25, life: 0.45 });

        const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
        item.mesh.position.copy(player.beakAnchor.getWorldPosition(new THREE.Vector3()));
        item.velocity.copy(forward.multiplyScalar(player.isFlying ? 2.7 : 1.1));
        item.velocity.y = player.isFlying ? -0.45 : 0.55;

        sendItemUpdate(itemToNetworkState(item));
        return;
      }

      const item = nearestItem();
      if (!item) return;

      item.carried = true;
      item.carriedBy = app.multiplayer.playerId || "local";
      item.velocity.set(0, 0, 0);
      player.carrying = item;
      spawnEffectBurst(item.mesh.position.clone(), { color: 0xffd166, count: 8, size: 0.045, speed: 1.35, life: 0.5 });

      sendItemUpdate(itemToNetworkState(item));
    }

    function eat() {
      if (app.paused) return;

      let item = null;
      if (player.carrying && player.carrying.edible) item = player.carrying;
      else item = nearestItem({ edibleOnly: true });

      player.anim.peck = item ? 0.34 : 0.22;
      if (!item) return;

      addSuperPoopCharge(foodChargeValue(item.type));
      spawnEffectBurst(item.mesh.position.clone(), { color: 0xffd166, count: 12, size: 0.055, speed: 1.6, life: 0.62 });
      if (player.carrying === item) player.carrying = null;
      removeItem(item, true);
    }

    function poop({ explosive = false } = {}) {
      if (app.paused) return;

      player.anim.poop = explosive ? 0.7 : 0.42;

      const pos = player.group.position.clone();
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const id = `poop_${app.multiplayer.playerId || "solo"}_${Date.now()}_${app.poopSerial++}`;

      const item = spawnItem("poop", pos.x - forward.x * 0.35, pos.z - forward.z * 0.35, id, {
        dynamic: true,
        createdAt: Date.now(),
        explosive
      });

      item.mesh.position.y = pos.y + 0.5;
      item.velocity.set(
        -forward.x * (explosive ? 0.6 : 0.25),
        player.isFlying ? (explosive ? -3.4 : -2.3) : (explosive ? 1.2 : -0.35),
        -forward.z * (explosive ? 0.6 : 0.25)
      );
      item.splatted = false;
      item.explosive = explosive;
      item.lifetime = 45;

      spawnEffectBurst(item.mesh.position.clone(), {
        color: explosive ? 0xffbe0b : COLORS.poop,
        count: explosive ? 22 : 8,
        size: explosive ? 0.075 : 0.045,
        speed: explosive ? 3.1 : 1.2,
        life: explosive ? 0.9 : 0.45
      });

      if (explosive) {
        item.mesh.scale.multiplyScalar(1.9);
        app.cameraShake = Math.max(app.cameraShake, 1.0);
        resetSuperPoopCharge();
      } else {
        app.cameraShake = Math.max(app.cameraShake, 0.08);
      }

      sendItemUpdate(itemToNetworkState(item));
    }

    function itemToNetworkState(item) {
      return {
        id: item.id,
        type: item.type,
        exists: true,
        x: item.mesh.position.x,
        y: item.mesh.position.y,
        z: item.mesh.position.z,
        rx: item.mesh.rotation.x,
        ry: item.mesh.rotation.y,
        rz: item.mesh.rotation.z,
        carriedBy: item.carriedBy || null,
        splatted: item.splatted,
        explosive: item.explosive,
        createdAt: item.createdAt
      };
    }

    function applyItemState(state) {
      if (!state || !state.id) return;

      let item = world.itemsById.get(state.id);

      if (state.exists === false) {
        if (item) removeItem(item, false);
        return;
      }

      if (!item) {
        item = spawnItem(state.type || "chips", state.x || 0, state.z || 0, state.id, {
          y: state.y,
          dynamic: String(state.id).startsWith("poop_"),
          createdAt: state.createdAt,
          explosive: state.explosive,
          splatted: state.splatted
        });
      }

      item.type = state.type || item.type;
      item.carriedBy = state.carriedBy || null;
      item.carried = item.carriedBy === (app.multiplayer.playerId || "local");
      item.splatted = Boolean(state.splatted);
      item.explosive = Boolean(state.explosive);

      if (!item.carried && item.carriedBy !== (app.multiplayer.playerId || "local")) {
        item.mesh.position.set(state.x || 0, state.y || 0, state.z || 0);
        item.mesh.rotation.set(state.rx || 0, state.ry || 0, state.rz || 0);
      }

      if (item.type === "poop" && item.splatted) {
        item.mesh.scale.set(
          item.explosive ? 2.2 : 1.45,
          item.explosive ? 0.55 : 0.42,
          item.explosive ? 2.1 : 1.35
        );
      }
    }

    function explodePoop(item) {
      if (item.explosionDone) return;
      item.explosionDone = true;
      app.cameraShake = Math.max(app.cameraShake, 1.35);

      const center = item.mesh.position.clone();
      spawnEffectBurst(center.clone().add(new THREE.Vector3(0, 0.45, 0)), {
        color: 0xffbe0b,
        count: 42,
        size: 0.085,
        speed: 4.2,
        life: 1.0,
        gravity: 2.4
      });
      const chunks = 14;

      for (let i = 0; i < chunks; i++) {
        const angle = (Math.PI * 2 * i) / chunks + rand(-0.18, 0.18);
        const radius = rand(1.4, 4.6);
        const x = clamp(center.x + Math.cos(angle) * radius, -150, 150);
        const z = clamp(center.z + Math.sin(angle) * radius, -150, 150);
        const id = `poopsplat_${app.multiplayer.playerId || "solo"}_${Date.now()}_${i}_${app.poopSerial++}`;
        const splat = spawnItem("poop", x, z, id, {
          y: heightAt(x, z) + 0.17,
          dynamic: true,
          createdAt: Date.now()
        });
        splat.mesh.scale.set(rand(1.15, 1.85), 0.38, rand(1.15, 1.85));
        splat.splatted = true;
        splat.lifetime = 45;
        splat.velocity.set(Math.cos(angle) * rand(0.2, 1.1), rand(0.3, 1.2), Math.sin(angle) * rand(0.2, 1.1));
        sendItemUpdate(itemToNetworkState(splat));
      }
    }

    function splatPoop(item) {
      item.splatted = true;
      spawnEffectBurst(item.mesh.position.clone(), {
        color: item.explosive ? 0xffbe0b : COLORS.poop,
        count: item.explosive ? 24 : 9,
        size: item.explosive ? 0.07 : 0.045,
        speed: item.explosive ? 2.4 : 1.2,
        life: item.explosive ? 0.75 : 0.45
      });
      item.mesh.scale.set(
        item.explosive ? 2.2 : 1.45,
        item.explosive ? 0.55 : 0.42,
        item.explosive ? 2.1 : 1.35
      );
      sendItemUpdate(itemToNetworkState(item));
    }

    function resetBird() {
      if (player.carrying) {
        player.carrying.carried = false;
        player.carrying.carriedBy = null;
        sendItemUpdate(itemToNetworkState(player.carrying));
        player.carrying = null;
      }

      player.group.position.set(-10, 0, -32);
      player.yaw = -Math.PI * 0.2;
      player.group.rotation.y = player.yaw;
      player.isFlying = false;
      input.verticalMode = 0;
      input.mobileVertical = 0;
      player.anim.peck = 0;
      player.anim.grab = 0;
      player.anim.poop = 0;
      player.anim.land = 0;

      app.cameraYawTarget = player.yaw + Math.PI;
      app.cameraYaw = app.cameraYawTarget;
      app.cameraPitchTarget = 0.42;
      app.cameraPitch = app.cameraPitchTarget;
    }

    function restartBirdOnly() {
      for (const item of [...world.items]) {
        if (item.type === "poop") removeItem(item, true);
      }

      resetBird();
      setPaused(false);
    }

    function newMap() {
      if (app.multiplayer.connected) {
        sendSocket({ type: "newMap" });
        return;
      }

      app.seed = Math.floor(Math.random() * 999999999);
      createWorld(app.seed);
      resetSuperPoopCharge();
      resetBird();
      setPaused(false);
    }

    function updateKeyboardInput() {
      let x = 0;
      let y = 0;

      if (app.keys.has("KeyA") || app.keys.has("ArrowLeft")) x -= 1;
      if (app.keys.has("KeyD") || app.keys.has("ArrowRight")) x += 1;
      if (app.keys.has("KeyW") || app.keys.has("ArrowUp")) y += 1;
      if (app.keys.has("KeyS") || app.keys.has("ArrowDown")) y -= 1;

      input.moveX = x;
      input.moveY = y;
    }

    function normalizedMoveVector() {
      const x = input.moveX + input.mobileMoveX;
      const y = input.moveY + input.mobileMoveY;
      const len = Math.hypot(x, y);

      if (len < 0.02) return { x: 0, y: 0, active: false };

      return {
        x: x / Math.max(1, len),
        y: y / Math.max(1, len),
        active: true
      };
    }

    function updatePlayer(dt, t) {
      updateKeyboardInput();

      for (const key of Object.keys(player.anim)) {
        player.anim[key] = Math.max(0, player.anim[key] - dt);
      }

      const move = normalizedMoveVector();
      input.moving = move.active;

      const currentSurface = heightAt(player.group.position.x, player.group.position.z);
      player.surfaceY = currentSurface;

      const cameraForward = new THREE.Vector3(-Math.sin(app.cameraYawTarget), 0, -Math.cos(app.cameraYawTarget));
      const cameraRight = new THREE.Vector3(Math.cos(app.cameraYawTarget), 0, -Math.sin(app.cameraYawTarget));

      const desired = new THREE.Vector3();
      desired.addScaledVector(cameraRight, move.x);
      desired.addScaledVector(cameraForward, move.y);
      if (desired.lengthSq() > 0) desired.normalize();

      const speed = player.isFlying ? player.speedFly : player.speedWalk;
      const oldPos = player.group.position.clone();

      if (desired.lengthSq() > 0) {
        player.yaw = Math.atan2(desired.x, desired.z);
        player.group.rotation.y = lerpAngle(player.group.rotation.y, player.yaw, 1 - Math.pow(0.00002, dt));
        player.group.position.x += desired.x * speed * dt;
        player.group.position.z += desired.z * speed * dt;
      }

      player.group.position.x = clamp(player.group.position.x, -154, 154);
      player.group.position.z = clamp(player.group.position.z, -154, 154);

      if (!player.isFlying) {
        if (isSolidWallForWalking(player.group.position.x, player.group.position.z, oldPos.y)) {
          player.group.position.x = oldPos.x;
          player.group.position.z = oldPos.z;
        }

        const afterSurface = heightAt(player.group.position.x, player.group.position.z);

        if (afterSurface < oldPos.y - 0.56) {
          player.isFlying = true;
          input.verticalMode = -1;
        } else {
          player.group.position.y = afterSurface;
        }
      }

      if (player.isFlying) {
        const mobileV = input.mobileVertical;
        let vertical = mobileV !== 0 ? mobileV : input.verticalMode;

        if (app.keys.has("ControlLeft") || app.keys.has("ControlRight") || app.keys.has("KeyC")) vertical = -1;

        if (vertical > 0) player.group.position.y += player.climbSpeed * dt;
        else if (vertical < 0) player.group.position.y -= player.descendSpeed * dt;
        else player.group.position.y -= 0.08 * dt;

        player.group.position.y = clamp(player.group.position.y, 0, 36);

        const surface = heightAt(player.group.position.x, player.group.position.z);
        if (player.group.position.y <= surface + 0.03) {
          player.group.position.y = surface;
          player.isFlying = false;
          input.verticalMode = 0;
          input.mobileVertical = 0;
          player.anim.land = 0.25;
        }
      }

      animateSeagull(player, dt, t, move.active, player.isFlying);

      if (player.carrying) {
        const anchorWorld = player.beakAnchor.getWorldPosition(new THREE.Vector3());
        player.carrying.mesh.position.copy(anchorWorld);
        player.carrying.mesh.rotation.y = player.yaw;
        player.carrying.mesh.rotation.x = Math.sin(t * 8) * 0.04;
      }

      sendPlayerStateMaybe(t);
    }

    function animateSeagull(gull, dt, t, moving, flying) {
      const p = gull.parts;
      if (!p || !p.bodyGroup) return;

      const anim = gull.anim || player.anim;
      const flapWave = Math.sin(t * 14);
      const walkWave = Math.sin(t * 12);
      const walkAbs = Math.abs(walkWave);
      const peckAmount = anim.peck > 0 ? Math.sin((anim.peck / 0.34) * Math.PI) : 0;
      const grabAmount = anim.grab > 0 ? Math.sin((anim.grab / 0.22) * Math.PI) : 0;
      const poopAmount = anim.poop > 0 ? Math.sin((anim.poop / 0.42) * Math.PI) : 0;
      const landAmount = anim.land > 0 ? Math.sin((anim.land / 0.25) * Math.PI) : 0;

      if (flying) {
        const flapPower = moving ? 0.78 : 0.52;
        p.leftWingRoot.rotation.z = lerp(p.leftWingRoot.rotation.z, -0.25 - flapPower - flapWave * 0.58, dt * 12);
        p.rightWingRoot.rotation.z = lerp(p.rightWingRoot.rotation.z, 0.25 + flapPower + flapWave * 0.58, dt * 12);
        p.leftWingRoot.rotation.x = lerp(p.leftWingRoot.rotation.x, 0.06 + flapWave * 0.12, dt * 10);
        p.rightWingRoot.rotation.x = lerp(p.rightWingRoot.rotation.x, 0.06 + flapWave * 0.12, dt * 10);
        gull.visual.position.y = 0.06 * Math.sin(t * 7);
        gull.visual.rotation.x = lerp(gull.visual.rotation.x, moving ? -0.16 : -0.05, dt * 8);
        gull.visual.rotation.z = lerp(gull.visual.rotation.z, 0, dt * 8);
        p.leftLeg.root.rotation.x = lerp(p.leftLeg.root.rotation.x, 0.9, dt * 12);
        p.rightLeg.root.rotation.x = lerp(p.rightLeg.root.rotation.x, 0.9, dt * 12);
        p.tailGroup.rotation.x = lerp(p.tailGroup.rotation.x, 0.18, dt * 8);
      } else {
        p.leftWingRoot.rotation.z = lerp(p.leftWingRoot.rotation.z, -0.34, dt * 10);
        p.rightWingRoot.rotation.z = lerp(p.rightWingRoot.rotation.z, 0.34, dt * 10);
        p.leftWingRoot.rotation.x = lerp(p.leftWingRoot.rotation.x, 0, dt * 10);
        p.rightWingRoot.rotation.x = lerp(p.rightWingRoot.rotation.x, 0, dt * 10);
        gull.visual.position.y = moving ? 0.045 * walkAbs - landAmount * 0.08 : -landAmount * 0.08;
        gull.visual.rotation.z = moving ? 0.07 * walkWave : lerp(gull.visual.rotation.z, 0, dt * 8);
        gull.visual.rotation.x = lerp(gull.visual.rotation.x, poopAmount * 0.15 - landAmount * 0.12, dt * 10);
        p.leftLeg.root.rotation.x = moving ? Math.sin(t * 13) * 0.52 : lerp(p.leftLeg.root.rotation.x, 0, dt * 10);
        p.rightLeg.root.rotation.x = moving ? -Math.sin(t * 13) * 0.52 : lerp(p.rightLeg.root.rotation.x, 0, dt * 10);
        p.tailGroup.rotation.x = lerp(p.tailGroup.rotation.x, -poopAmount * 0.42, dt * 10);
      }

      p.headGroup.rotation.x = lerp(
        p.headGroup.rotation.x,
        -peckAmount * 0.95 - grabAmount * 0.32 + poopAmount * 0.12 + Math.sin(t * 2.5) * 0.025,
        dt * 16
      );
      p.headGroup.position.z = lerp(p.headGroup.position.z, 0.56 + peckAmount * 0.18, dt * 16);
      p.bodyGroup.scale.y = lerp(p.bodyGroup.scale.y, 1 - poopAmount * 0.08 - landAmount * 0.08, dt * 12);
    }

    function updateRemotePlayers(dt, t) {
      for (const remote of app.multiplayer.remotePlayers.values()) {
        remote.group.position.lerp(remote.target.position, 1 - Math.pow(0.000001, dt));
        remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.target.yaw, 1 - Math.pow(0.000001, dt));
        remote.yaw = remote.group.rotation.y;
        remote.isFlying = remote.target.isFlying;
        remote.moving = remote.target.moving;
        animateSeagull(remote, dt, t, remote.moving, remote.isFlying);
      }
    }

    function updateItems(dt) {
      for (const item of [...world.items]) {
        if (item.type === "poop" && !item.carried && !item.carriedBy) {
          item.lifetime -= dt;
          if (item.lifetime <= 0) {
            removeItem(item, true);
            continue;
          }
        }

        if (item.carried) continue;

        if (item.carriedBy) {
          const remote = app.multiplayer.remotePlayers.get(item.carriedBy);
          if (remote) {
            const anchor = remote.beakAnchor.getWorldPosition(new THREE.Vector3());
            item.mesh.position.copy(anchor);
            item.mesh.rotation.y = remote.yaw;
          }
          continue;
        }

        if (item.velocity.lengthSq() > 0.0001 || item.mesh.position.y > heightAt(item.mesh.position.x, item.mesh.position.z) + 0.2) {
          item.velocity.y -= 8.8 * dt;
          item.mesh.position.addScaledVector(item.velocity, dt);

          const surface = heightAt(item.mesh.position.x, item.mesh.position.z);
          const floorY = surface + 0.17;

          if (item.mesh.position.y <= floorY) {
            item.mesh.position.y = floorY;
            item.velocity.multiplyScalar(0.16);
            item.velocity.y = 0;

            if (item.type === "poop" && !item.splatted) {
              splatPoop(item);
              if (item.explosive) explodePoop(item);
            } else if (item.dynamic) {
              sendItemUpdate(itemToNetworkState(item));
            }
          }
        }
      }
    }

    function updateCamera(dt) {
      const target = player.group.position.clone();
      target.y += player.isFlying ? 1.05 : 0.95;

      const distance = player.isFlying ? 11.2 : 8.8;
      const baseHeight = player.isFlying ? 4.9 : 3.6;

      app.cameraYaw = lerpAngle(app.cameraYaw, app.cameraYawTarget, 1 - Math.pow(0.0000008, dt));
      app.cameraPitch = lerp(app.cameraPitch, app.cameraPitchTarget, 1 - Math.pow(0.0000008, dt));

      const pitchHeight = Math.sin(app.cameraPitch) * distance + baseHeight * 0.22;
      const flatDistance = Math.cos(app.cameraPitch) * distance;

      const camOffset = new THREE.Vector3(
        Math.sin(app.cameraYaw) * flatDistance,
        pitchHeight,
        Math.cos(app.cameraYaw) * flatDistance
      );

      const desiredPos = target.clone().add(camOffset);

      if (app.cameraShake > 0) {
        const shake = app.cameraShake;
        desiredPos.x += (Math.random() - 0.5) * shake * 0.45;
        desiredPos.y += (Math.random() - 0.5) * shake * 0.28;
        desiredPos.z += (Math.random() - 0.5) * shake * 0.45;
        app.cameraShake = Math.max(0, app.cameraShake - dt * 2.6);
      }

      world.camera.position.lerp(desiredPos, 1 - Math.pow(0.00000002, dt));
      world.camera.lookAt(target);
    }

    function takeOffOrToggleVertical() {
      if (app.paused) return;

      if (!player.isFlying) {
        player.isFlying = true;
        input.verticalMode = 1;
        player.group.position.y += 0.1;
        spawnEffectBurst(player.group.position.clone().add(new THREE.Vector3(0, 0.25, 0)), {
          color: 0xf8fbff,
          count: 12,
          size: 0.05,
          speed: 1.5,
          life: 0.55
        });
      } else {
        input.verticalMode = input.verticalMode === 1 ? -1 : 1;
      }
    }

    function animate() {
      requestAnimationFrame(animate);

      const dt = Math.min(app.clock.getDelta(), 0.033);
      const t = app.clock.elapsedTime;

      if (!app.paused) {
        updatePlayer(dt, t);
        updateRemotePlayers(dt, t);
        updateItems(dt);
        updateEffects(dt);
        updateCamera(dt);
      }

      world.renderer.render(world.scene, world.camera);
    }

    function setPaused(paused) {
      app.paused = paused;
      ui.pauseOverlay.classList.toggle("open", paused);
      if (paused) unlockMouse();
    }

    function eventStartedOnUI(event) {
      return Boolean(event.target.closest("#mobileControls, #pauseButton, #pauseOverlay, button, input"));
    }

    function rotateCamera(deltaX, deltaY, multiplier = 1) {
      const sensitivity = 0.0032 * multiplier;
      app.cameraYawTarget -= deltaX * sensitivity;
      app.cameraPitchTarget = clamp(app.cameraPitchTarget + deltaY * sensitivity, -0.07, 0.94);
    }

    function isPointerLocked() {
      return document.pointerLockElement === world.renderer.domElement;
    }

    function requestMouseLock() {
      if (!world.renderer || !world.renderer.domElement) return;
      if (app.paused) return;
      if (isPointerLocked()) return;
      app.pointerLockWanted = true;
      if (world.renderer.domElement.requestPointerLock) world.renderer.domElement.requestPointerLock();
    }

    function unlockMouse() {
      app.pointerLockWanted = false;
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    }

    function setupPointerLockEvents() {
      document.addEventListener("pointerlockchange", () => {
        const locked = isPointerLocked();
        if (!locked && app.pointerLockWanted && !app.paused) {
          app.pointerLockWanted = false;
          setPaused(true);
        }
      });
      document.addEventListener("pointerlockerror", () => {
        app.pointerLockWanted = false;
      });
    }

    function preventMobileZoomGestures() {
      ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
        window.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
      });

      let lastTouchEnd = 0;
      document.addEventListener("touchend", (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) event.preventDefault();
        lastTouchEnd = now;
      }, { passive: false });

      document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
    }


    function hydrateCustomizerUi() {
      const c = saveCustomization(app.customization);
      if (ui.gamePlayerName) ui.gamePlayerName.value = c.name;
      if (ui.gameGullColor) ui.gameGullColor.value = c.color;
      if (ui.gameGullStyle) ui.gameGullStyle.value = c.style;
    }

    function setupEvents() {
      window.addEventListener("resize", () => {
        world.camera.aspect = window.innerWidth / window.innerHeight;
        world.camera.updateProjectionMatrix();
        world.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      window.addEventListener("keydown", (event) => {
        if (event.repeat && event.code === "Space") return;

        if (event.code === "Escape") {
          setPaused(true);
          return;
        }

        if (event.code === "Space") {
          event.preventDefault();
          takeOffOrToggleVertical();
          return;
        }

        if (event.code === "KeyE") {
          interact();
          return;
        }

        if (event.code === "KeyP") {
          poop({ explosive: app.superPoop.charged });
          return;
        }

        app.keys.add(event.code);
      });

      window.addEventListener("keyup", (event) => app.keys.delete(event.code));

      world.renderer.domElement.addEventListener("pointerdown", (event) => {
        if (eventStartedOnUI(event)) return;
        event.preventDefault();

        if (event.pointerType === "mouse") {
          if (!isPointerLocked()) {
            requestMouseLock();
            return;
          }
          if (event.button === 0) eat();
          return;
        }

        app.cameraDrag.active = true;
        app.cameraDrag.pointerId = event.pointerId;
        app.cameraDrag.x = event.clientX;
        app.cameraDrag.y = event.clientY;
        app.cameraDrag.moved = false;

        try {
          world.renderer.domElement.setPointerCapture(event.pointerId);
        } catch (_) {}
      });

      document.addEventListener("mousemove", (event) => {
        if (app.paused) return;
        if (!isPointerLocked()) return;
        rotateCamera(event.movementX || 0, event.movementY || 0, 0.62);
      });

      document.addEventListener("pointermove", (event) => {
        if (!app.cameraDrag.active || event.pointerId !== app.cameraDrag.pointerId) return;
        event.preventDefault();

        const dx = event.clientX - app.cameraDrag.x;
        const dy = event.clientY - app.cameraDrag.y;

        if (Math.abs(dx) + Math.abs(dy) > 3) app.cameraDrag.moved = true;
        rotateCamera(dx, dy, 0.88);

        app.cameraDrag.x = event.clientX;
        app.cameraDrag.y = event.clientY;
      }, { passive: false });

      function endCameraDrag(event) {
        if (!app.cameraDrag.active || event.pointerId !== app.cameraDrag.pointerId) return;
        event.preventDefault();

        const wasDrag = app.cameraDrag.moved;
        app.cameraDrag.active = false;
        app.cameraDrag.pointerId = null;

        try {
          world.renderer.domElement.releasePointerCapture(event.pointerId);
        } catch (_) {}

        if (!wasDrag) eat();
      }

      document.addEventListener("pointerup", endCameraDrag, { passive: false });
      document.addEventListener("pointercancel", endCameraDrag, { passive: false });

      ui.pauseButton.addEventListener("click", () => setPaused(true));
      ui.resumeButton.addEventListener("click", () => {
        setPaused(false);
        if (matchMedia("(pointer: fine)").matches) requestMouseLock();
      });

      ui.multiplayerButton.addEventListener("click", () => {
        ui.controlsPanel.classList.remove("open");
        ui.customizePanel?.classList.remove("open");
        ui.multiplayerPanel.classList.toggle("open");
      });
      ui.controlsButton.addEventListener("click", () => {
        ui.multiplayerPanel.classList.remove("open");
        ui.customizePanel?.classList.remove("open");
        ui.controlsPanel.classList.toggle("open");
      });
      ui.customizeButton?.addEventListener("click", () => {
        ui.multiplayerPanel.classList.remove("open");
        ui.controlsPanel.classList.remove("open");
        ui.customizePanel?.classList.toggle("open");
      });
      ui.applyCustomizerButton?.addEventListener("click", () => {
        app.customization = {
          name: ui.gamePlayerName?.value || "",
          color: ui.gameGullColor?.value || "#ffd166",
          style: ui.gameGullStyle?.value || "classic"
        };
        saveCustomization(app.customization);
        rebuildLocalSeagullAppearance();
      });
      ui.restartButton.addEventListener("click", restartBirdOnly);
      ui.newMapButton.addEventListener("click", newMap);
      ui.createRoomButton.addEventListener("click", createRoom);
      ui.joinRoomButton.addEventListener("click", () => joinRoom(ui.roomCodeInput.value));
      ui.leaveRoomButton.addEventListener("click", leaveRoom);
      ui.copyRoomLinkButton?.addEventListener("click", copyRoomLink);

      setupMobileControls();
    }

    function setupMobileControls() {
      let joystickPointer = null;
      const maxDist = 54;

      function updateStick(clientX, clientY) {
        const rect = ui.joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }

        ui.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        input.mobileMoveX = dx / maxDist;
        input.mobileMoveY = -dy / maxDist;
      }

      ui.joystick.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        joystickPointer = event.pointerId;
        ui.joystick.setPointerCapture(event.pointerId);
        updateStick(event.clientX, event.clientY);
      });

      ui.joystick.addEventListener("pointermove", (event) => {
        if (event.pointerId !== joystickPointer) return;
        event.preventDefault();
        event.stopPropagation();
        updateStick(event.clientX, event.clientY);
      });

      function resetStick(event) {
        if (event && event.pointerId !== joystickPointer) return;
        joystickPointer = null;
        input.mobileMoveX = 0;
        input.mobileMoveY = 0;
        ui.stickKnob.style.transform = "translate(-50%, -50%)";
      }

      ui.joystick.addEventListener("pointerup", resetStick);
      ui.joystick.addEventListener("pointercancel", resetStick);

      function bindHoldButton(button, onDown, onUp) {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          button.setPointerCapture(event.pointerId);
          onDown();
        });
        button.addEventListener("pointerup", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onUp();
        });
        button.addEventListener("pointercancel", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onUp();
        });
      }

      bindHoldButton(ui.upButton, () => {
        if (!player.isFlying) {
          player.isFlying = true;
          player.group.position.y += 0.1;
        }
        input.mobileVertical = 1;
      }, () => {
        input.mobileVertical = 0;
      });

      bindHoldButton(ui.downButton, () => {
        if (player.isFlying) input.mobileVertical = -1;
      }, () => {
        input.mobileVertical = 0;
      });

      ui.eatButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        eat();
      });

      ui.interactButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        interact();
      });

      ui.poopButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        poop({ explosive: app.superPoop.charged });
      });
    }

    function wsUrl() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${location.host}/ws`;
    }

    function ensureSocket(onReady) {
      if (app.multiplayer.socket && app.multiplayer.socket.readyState === WebSocket.OPEN) {
        onReady();
        return;
      }

      if (app.multiplayer.connecting) return;
      app.multiplayer.connecting = true;
      setRoomStatus("Connecting...");

      const socket = new WebSocket(wsUrl());
      app.multiplayer.socket = socket;

      socket.addEventListener("open", () => {
        app.multiplayer.connecting = false;
        onReady();
      });

      socket.addEventListener("message", (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        handleSocketMessage(data);
      });

      socket.addEventListener("close", () => {
        app.multiplayer.connected = false;
        app.multiplayer.roomCode = null;
        app.multiplayer.playerCount = 1;
        clearRemotePlayers();
        updateRoomUi();
      });

      socket.addEventListener("error", () => {
        app.multiplayer.connecting = false;
        setRoomStatus("Connection error");
      });
    }

    function sendSocket(data) {
      const socket = app.multiplayer.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(data));
    }

    function createRoom() {
      ensureSocket(() => {
        const payload = customizationPayload();
        sendSocket({ type: "create", name: payload.name, customization: payload.customization });
      });
    }

    function joinRoom(code) {
      const clean = String(code || "").trim().toUpperCase();
      if (!clean) {
        setRoomStatus("Enter a code");
        return;
      }
      ensureSocket(() => {
        const payload = customizationPayload();
        sendSocket({ type: "join", code: clean, name: payload.name, customization: payload.customization });
      });
    }

    function leaveRoom() {
      sendSocket({ type: "leave" });
      app.multiplayer.connected = false;
      app.multiplayer.roomCode = null;
      app.multiplayer.playerCount = 1;
      clearRemotePlayers();
      updateRoomUi();
    }

    function handleSocketMessage(data) {
      if (data.type === "hello") {
        app.multiplayer.playerId = data.playerId;
        return;
      }

      if (data.type === "created" || data.type === "joined") {
        app.multiplayer.playerId = data.playerId || app.multiplayer.playerId;
        enterRoom(data.room);
        return;
      }

      if (data.type === "roomMissing") {
        setRoomStatus("Room not found");
        return;
      }

      if (data.type === "roomFull") {
        setRoomStatus("Room full");
        return;
      }

      if (data.type === "peerJoined") {
        if (data.player) ensureRemotePlayer(data.player);
        app.multiplayer.playerCount = data.playerCount || app.multiplayer.playerCount;
        updateRoomUi();
        return;
      }

      if (data.type === "peerLeft") {
        removeRemotePlayer(data.id);
        app.multiplayer.playerCount = data.playerCount || Math.max(1, app.multiplayer.playerCount - 1);
        updateRoomUi();
        return;
      }

      if (data.type === "peerCustomize") {
        removeRemotePlayer(data.id);
        ensureRemotePlayer({
          id: data.id,
          color: data.color,
          name: data.name,
          customization: data.customization
        });
        return;
      }

      if (data.type === "peerState") {
        updateRemoteState(data.id, data.state);
        return;
      }

      if (data.type === "itemUpdate") {
        applyItemState(data.item);
        return;
      }

      if (data.type === "newMap") {
        app.seed = data.seed;
        createWorld(app.seed);
        resetSuperPoopCharge();
        resetBird();
        return;
      }

      if (data.type === "left") {
        app.multiplayer.connected = false;
        app.multiplayer.roomCode = null;
        app.multiplayer.playerCount = 1;
        clearRemotePlayers();
        updateRoomUi();
      }
    }

    function enterRoom(room) {
      if (!room) return;

      app.multiplayer.connected = true;
      app.multiplayer.roomCode = room.code;
      app.multiplayer.playerCount = room.playerCount || 1;

      createWorld(room.seed);
      resetSuperPoopCharge();
      resetBird();
      clearRemotePlayers();

      for (const state of room.itemStates || []) {
        applyItemState(state);
      }

      for (const p of room.players || []) {
        if (p.id !== app.multiplayer.playerId) {
          ensureRemotePlayer(p);
          if (p.state) updateRemoteState(p.id, p.state);
        }
      }

      ui.roomCodeInput.value = room.code;
      updateRoomUi();
    }

    function setRoomStatus(text) {
      ui.roomStatus.textContent = text;
    }

    function updateRoomUi() {
      if (app.multiplayer.connected) {
        setRoomStatus("Multiplayer");
        ui.roomCodeDisplay.textContent = `Code: ${app.multiplayer.roomCode}`;
        ui.playerCountDisplay.textContent = `${app.multiplayer.playerCount}/${MAX_ROOM_PLAYERS} seagulls`;
      } else {
        setRoomStatus("Singleplayer");
        ui.roomCodeDisplay.textContent = "No code";
        ui.playerCountDisplay.textContent = "1 seagull";
      }
    }

    function autoConnectFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const room = String(params.get("room") || "").trim().toUpperCase();
      const autocreate = params.get("create") === "1" || params.get("autocreate") === "1";

      if (autocreate) {
        ui.customizePanel?.classList.remove("open");
        ui.multiplayerPanel.classList.add("open");
        setPaused(true);
        createRoom();
        return;
      }

      if (room) {
        ui.customizePanel?.classList.remove("open");
        ui.multiplayerPanel.classList.add("open");
        ui.roomCodeInput.value = room;
        setPaused(true);
        joinRoom(room);
      }
    }

    function copyRoomLink() {
      if (!app.multiplayer.roomCode) return;
      const url = new URL(window.location.href);
      url.pathname = "/play.html";
      url.search = `?room=${encodeURIComponent(app.multiplayer.roomCode)}`;
      navigator.clipboard?.writeText(url.toString()).catch(() => {});
    }

    function clearRemotePlayers() {
      for (const remote of app.multiplayer.remotePlayers.values()) {
        world.scene.remove(remote.group);
      }
      app.multiplayer.remotePlayers.clear();
    }

    function ensureRemotePlayer(info) {
      if (!info || !info.id || info.id === app.multiplayer.playerId) return null;

      let remote = app.multiplayer.remotePlayers.get(info.id);
      if (remote) return remote;

      remote = createSeagullObject({
        color: info.customization?.color || info.color || "#ffd166",
        style: info.customization?.style || "classic",
        name: info.name || "Gull",
        remote: true
      });
      remote.group.position.set(-10 + rand(-3, 3), 0, -32 + rand(-3, 3));
      remote.target.position.copy(remote.group.position);
      remote.name = info.name || "Gull";
      remote.id = info.id;
      world.scene.add(remote.group);
      app.multiplayer.remotePlayers.set(info.id, remote);
      return remote;
    }

    function removeRemotePlayer(id) {
      const remote = app.multiplayer.remotePlayers.get(id);
      if (!remote) return;
      world.scene.remove(remote.group);
      app.multiplayer.remotePlayers.delete(id);
    }

    function updateRemoteState(id, state) {
      const remote = ensureRemotePlayer({ id });
      if (!remote || !state) return;

      remote.target.position.set(state.x || 0, state.y || 0, state.z || 0);
      remote.target.yaw = state.yaw || 0;
      remote.target.isFlying = Boolean(state.flying);
      remote.target.moving = Boolean(state.moving);
      remote.target.carrying = state.carrying || null;
      remote.isFlying = remote.target.isFlying;
    }

    function sendPlayerStateMaybe(t) {
      if (!app.multiplayer.connected) return;
      if (t - app.multiplayer.lastSend < 1 / 18) return;
      app.multiplayer.lastSend = t;

      sendSocket({
        type: "state",
        state: {
          x: player.group.position.x,
          y: player.group.position.y,
          z: player.group.position.z,
          yaw: player.yaw,
          flying: player.isFlying,
          moving: input.moving,
          carrying: player.carrying ? player.carrying.id : null
        }
      });
    }

    function sendItemUpdate(item) {
      if (!app.multiplayer.connected) return;
      sendSocket({ type: "itemUpdate", item });
    }

    function init() {
      createRenderer();
      createCamera();
      createLights();
      createPlayer();
      createWorld(app.seed);
      resetSuperPoopCharge();
      resetBird();
      hydrateCustomizerUi();
      setupEvents();
      setupPointerLockEvents();
      preventMobileZoomGestures();
      updateRoomUi();
      autoConnectFromUrl();
      animate();
    }

    init();