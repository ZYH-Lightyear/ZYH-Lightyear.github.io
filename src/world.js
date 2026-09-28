import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** A procedural miniature: no model downloads, textures, or tracking requests. */
export function createWorld({
  host,
  labels,
  compass,
  districts,
  onSelect,
  onBook,
  onPhoto,
  reducedMotion,
}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.setAttribute("data-world-renderer", "three");
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 150);
  const initial = new THREE.Vector3(17, 21, 24);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  // OrbitControls owns wheel and pinch zoom; keep buttons within the same limits.
  controls.enableZoom = true;
  controls.minZoom = 0.8;
  controls.maxZoom = 1.7;
  controls.minPolarAngle = 0.38;
  controls.maxPolarAngle = 1.18;
  controls.update();

  const hemi = new THREE.HemisphereLight("#f7f8ed", "#a5ae96", 2.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff5db", 3.4);
  sun.position.set(-9, 17, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -14,
    right: 14,
    top: 14,
    bottom: -14,
    near: 1,
    far: 60,
  });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#cadade", 1.2);
  fill.position.set(10, 8, -8);
  scene.add(fill);

  const colors = {
    cream: "#f0eee1",
    white: "#fffaf0",
    sage: "#9caf91",
    green: "#627f67",
    leaf: "#7e976a",
    leafLight: "#acbb91",
    dark: "#3d5149",
    glass: "#a6c6c0",
    clay: "#cb9673",
    coral: "#cf8c70",
    blue: "#8fa9b6",
    wood: "#c6ae82",
    gold: "#cfad69",
    road: "#d9ddcd",
    charcoal: "#4c5b56",
    pink: "#d5aca0",
  };
  const materials = new Map();
  const material = (color, extras = {}) => {
    const key = color + JSON.stringify(extras);
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extras }),
      );
    return materials.get(key);
  };
  const geometries = new Map();
  const pickables = [];
  const animated = [];
  const selectRings = new Map();
  const groups = new Map();
  const pointLights = [];
  const emissives = [];
  const board = new THREE.Group();
  scene.add(board);

  function box(parent, x, y, z, w, h, d, color, round = 0.03, extras) {
    const key = [w, h, d, round].join(":");
    if (!geometries.has(key))
      geometries.set(
        key,
        round
          ? new RoundedBoxGeometry(
              w,
              h,
              d,
              1,
              Math.min(round, w / 3, h / 3, d / 3),
            )
          : new THREE.BoxGeometry(w, h, d),
      );
    const mesh = new THREE.Mesh(geometries.get(key), material(color, extras));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    parent,
    x,
    y,
    z,
    top,
    bottom,
    h,
    color,
    segments = 16,
    extras,
  ) {
    const key = ["c", top, bottom, h, segments].join(":");
    if (!geometries.has(key))
      geometries.set(key, new THREE.CylinderGeometry(top, bottom, h, segments));
    const mesh = new THREE.Mesh(geometries.get(key), material(color, extras));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(parent, x, y, z, radius, color, scale = [1, 1, 1]) {
    if (!geometries.has("sphere"))
      geometries.set("sphere", new THREE.IcosahedronGeometry(1, 1));
    const mesh = new THREE.Mesh(geometries.get("sphere"), material(color));
    mesh.scale.set(radius * scale[0], radius * scale[1], radius * scale[2]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function beam(parent, a, b, radius, color) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const mesh = cylinder(
      parent,
      ...start.clone().add(end).multiplyScalar(0.5).toArray(),
      radius,
      radius,
      direction.length(),
      color,
      8,
    );
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return mesh;
  }
  function textSign(
    parent,
    text,
    x,
    y,
    z,
    width,
    color = "#52674c",
    bg = "#f5f3e7",
    flat = false,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 100);
    ctx.fillStyle = color;
    let fontSize = 34;
    ctx.font = `500 ${fontSize}px monospace`;
    while (ctx.measureText(text).width > canvas.width - 48 && fontSize > 12) {
      fontSize--;
      ctx.font = `500 ${fontSize}px monospace`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 51);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 5.12),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    if (flat) mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    return mesh;
  }
  function tree(parent, x, z, size = 1) {
    cylinder(parent, x, 0.22, z, 0.43 * size, 0.44 * size, 0.22, colors.cream);
    cylinder(
      parent,
      x,
      0.7 * size,
      z,
      0.07 * size,
      0.09 * size,
      1.15 * size,
      colors.wood,
      7,
    );
    sphere(
      parent,
      x,
      1.45 * size,
      z,
      0.57 * size,
      colors.leaf,
      [0.9, 1.25, 0.9],
    );
    sphere(
      parent,
      x + 0.22 * size,
      1.18 * size,
      z + 0.14 * size,
      0.32 * size,
      colors.leafLight,
    );
  }
  function planter(parent, x, y, z, size = 0.25) {
    cylinder(
      parent,
      x,
      y + size * 0.4,
      z,
      size * 0.6,
      size * 0.42,
      size * 0.8,
      colors.cream,
      10,
    );
    sphere(parent, x, y + size * 1.2, z, size * 0.8, colors.leaf, [1, 1.2, 1]);
  }
  function robot(parent, x, z, color = colors.white, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0.17, z);
    g.scale.setScalar(scale);
    parent.add(g);
    for (const dx of [-0.15, 0.15]) {
      box(g, dx, 0.12, 0.03, 0.19, 0.24, 0.3, colors.charcoal, 0.05);
      box(g, dx * 2, 0.54, 0, 0.13, 0.34, 0.19, color, 0.05);
    }
    box(g, 0, 0.44, 0, 0.45, 0.47, 0.34, color, 0.08);
    const head = box(g, 0, 0.85, 0.025, 0.6, 0.4, 0.43, color, 0.09);
    box(g, 0, 0.87, 0.248, 0.42, 0.18, 0.024, colors.dark, 0.04);
    for (const dx of [-0.1, 0.1]) sphere(g, dx, 0.88, 0.264, 0.036, "#b5d9c1");
    cylinder(g, 0, 1.13, 0, 0.02, 0.02, 0.18, colors.charcoal, 8);
    sphere(g, 0, 1.24, 0, 0.055, colors.gold);
    animated.push({
      kind: "robot",
      obj: g,
      head,
      phase: x + z,
      baseY: g.position.y,
    });
    return g;
  }
  function district(id, x, z, w, d, color) {
    const group = new THREE.Group();
    group.position.set(x, 0.12, z);
    board.add(group);
    box(group, 0, 0, 0, w, 0.15, d, color, 0.12);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.64, 0.7, 48),
      new THREE.MeshBasicMaterial({
        color: districts.find((v) => v.id === id).color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.11, d / 2 - 0.45);
    group.add(ring);
    selectRings.set(id, ring);
    groups.set(id, group);
    group.userData.district = id;
    return group;
  }

  // Desk-size model plinth and its fine tile grid.
  box(board, 0, -0.45, 0, 16.8, 0.7, 11.6, "#d9d9c8", 0.25);
  box(board, 0, -0.04, 0, 16.9, 0.18, 11.7, "#eeeee1", 0.18);
  box(board, 0, -0.79, 0, 15.8, 0.08, 10.6, "#b5bdab", 0.08);
  for (let i = -8; i <= 8; i++)
    box(board, i, 0.057, 0, 0.015, 0.008, 11.25, "#d8ddcc", 0);
  for (let i = -5; i <= 5; i++)
    box(board, 0, 0.057, i, 16.5, 0.008, 0.015, "#d8ddcc", 0);
  box(board, 0, 0.082, 0.65, 16.5, 0.03, 1.07, colors.road, 0.02);
  box(board, 0.1, 0.081, -1.5, 1.2, 0.025, 7.55, colors.road, 0.02);
  for (let x = -7.6; x < 8; x += 0.78)
    box(board, x, 0.107, 0.65, 0.36, 0.012, 0.035, colors.white, 0);
  for (let z = -4.5; z < 5; z += 0.7)
    box(board, 0.1, 0.11, z, 0.035, 0.012, 0.28, colors.white, 0);
  for (let j = 0; j < 5; j++)
    box(board, 1.05 + j * 0.16, 0.12, 0.65, 0.07, 0.012, 0.75, colors.white, 0);

  const agents = district("agents", -4.05, -2.3, 6.3, 4.55, "#dce4d1");
  // An open courtyard between two little architecture studios.
  box(agents, -0.95, 0.95, -0.66, 2.05, 1.8, 2.25, colors.sage, 0.1);
  box(agents, -0.95, 1.94, -0.66, 2.24, 0.22, 2.45, colors.cream, 0.04);
  box(agents, -0.95, 2.08, -0.66, 1.92, 0.1, 2.05, "#b6c2a6", 0.03);
  box(agents, 1.16, 0.69, -0.24, 1.6, 1.28, 2.45, "#c7d2b9", 0.08);
  box(agents, 1.16, 1.42, -0.24, 1.79, 0.2, 2.62, colors.cream);
  // Windows with recessed frames.
  for (const x of [-1.6, -0.96, -0.32]) {
    box(agents, x, 1.15, 0.48, 0.44, 0.72, 0.07, colors.cream);
    box(agents, x, 1.15, 0.527, 0.34, 0.62, 0.015, colors.glass, 0.015, {
      metalness: 0.15,
      roughness: 0.35,
    });
    box(agents, x, 1.15, 0.54, 0.025, 0.64, 0.014, colors.green, 0);
  }
  for (const z of [-0.95, -0.25, 0.45]) {
    box(agents, 1.982, 0.83, z, 0.04, 0.64, 0.4, colors.cream);
    box(agents, 2.01, 0.83, z, 0.012, 0.54, 0.3, colors.glass, 0);
  }
  box(agents, -0.95, 0.15, 1.02, 2.4, 0.16, 0.7, colors.cream);
  box(agents, -0.95, 0.24, 0.8, 2.17, 0.16, 0.45, colors.white);
  textSign(agents, "AGENTS", -0.95, 1.72, 0.53, 1.62);
  box(agents, -0.93, 2.34, -0.67, 1.22, 0.35, 1.3, colors.green);
  for (let i = 0; i < 4; i++)
    box(
      agents,
      -1.35 + i * 0.28,
      2.53,
      -0.67,
      0.21,
      0.03,
      1.05,
      colors.glass,
      0.01,
    );
  cylinder(agents, 1.1, 1.6, -0.6, 0.46, 0.46, 0.18, colors.green);
  const antenna = new THREE.Group();
  antenna.position.set(1.1, 1.8, -0.6);
  agents.add(antenna);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.47, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    material(colors.white, { side: THREE.DoubleSide }),
  );
  dish.rotation.x = -0.8;
  antenna.add(dish);
  beam(antenna, [0, 0, 0], [0.12, 0.65, 0.4], 0.025, colors.green);
  sphere(antenna, 0.12, 0.65, 0.4, 0.07, colors.gold);
  animated.push({ kind: "dish", obj: antenna });
  robot(agents, -2.25, 1.18, colors.white, 0.7).rotation.y = -0.35;
  robot(agents, 0.28, 1.43, colors.gold, 0.63).rotation.y = 0.35;
  planter(agents, -2.55, 0.15, -0.85, 0.38);
  tree(agents, 2.5, -1.4, 0.69);

  const embodied = district("embodied", 3.82, -2.17, 5.7, 4.75, "#eadfcd");
  box(embodied, -0.7, 0.44, -0.55, 2.9, 0.68, 2.1, colors.cream, 0.06);
  box(embodied, -0.7, 0.84, -0.55, 3.12, 0.17, 2.3, colors.wood, 0.04);
  for (const x of [-1.77, 0.45])
    for (const z of [-1.34, 0.24])
      box(embodied, x, 0.23, z, 0.1, 0.5, 0.1, colors.charcoal, 0.02);
  // Articulated research arm, with a stationary base and moving shoulder.
  cylinder(embodied, -0.82, 0.98, -0.55, 0.35, 0.43, 0.2, colors.dark);
  const arm = new THREE.Group();
  arm.position.set(-0.82, 1.07, -0.55);
  embodied.add(arm);
  cylinder(arm, 0, 0.12, 0, 0.24, 0.24, 0.26, colors.clay);
  beam(arm, [0, 0.2, 0], [0.55, 1.15, 0], 0.14, colors.coral);
  sphere(arm, 0.55, 1.15, 0, 0.21, colors.cream);
  beam(arm, [0.55, 1.15, 0], [1.35, 0.75, 0.05], 0.12, colors.coral);
  sphere(arm, 1.35, 0.75, 0.05, 0.17, colors.cream);
  beam(arm, [1.35, 0.75, 0.05], [1.35, 0.38, 0.05], 0.08, colors.charcoal);
  for (const dz of [-0.12, 0.12])
    box(arm, 1.35, 0.3, dz + 0.05, 0.12, 0.22, 0.045, colors.charcoal);
  animated.push({ kind: "arm", obj: arm });
  box(embodied, 0.45, 0.99, -0.24, 0.34, 0.26, 0.32, colors.blue);
  box(embodied, -0.28, 0.96, 0.02, 0.21, 0.18, 0.24, colors.gold);
  textSign(embodied, "WORLDLINES", -0.65, 0.49, 0.52, 2.24, "#9c6948");
  // Memory rack; the neighboring lab connects persistence and video.
  box(embodied, 1.82, 1.19, -0.7, 1, 2.25, 1.65, "#9cb0b5", 0.08);
  box(embodied, 1.82, 2.36, -0.7, 1.12, 0.13, 1.75, colors.cream);
  for (let i = 0; i < 5; i++) {
    box(
      embodied,
      1.82,
      0.37 + i * 0.37,
      0.14,
      0.78,
      0.25,
      0.055,
      "#e6ece6",
      0.02,
    );
    const m = material("#a6cdb7", {
      emissive: "#a6cdb7",
      emissiveIntensity: 0.1,
    });
    emissives.push(m);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), m);
    light.position.set(1.53, 0.39 + i * 0.37, 0.18);
    embodied.add(light);
  }
  textSign(embodied, "MEMORY", 1.82, 2.07, 0.16, 0.78, "#586f75");
  robot(embodied, -0.3, 1.45, colors.white, 1.12).rotation.y = -0.45;
  for (let i = 0; i < 3; i++)
    box(
      embodied,
      -2.1 + i * 0.48,
      0.17,
      1.45,
      0.32,
      0.17,
      0.32,
      [colors.coral, colors.cream, colors.blue][i],
    );
  tree(embodied, 2.05, -1.95, 0.65);

  const workshop = district("workshop", 5.45, 3.08, 4.5, 3.65, "#e7e2d0");
  box(workshop, 0.2, 0.19, -0.13, 2.1, 0.25, 1.77, "#cdcdbd", 0.04);
  for (const x of [-0.68, 1.08])
    for (const z of [-0.85, 0.65])
      box(workshop, x, 0.82, z, 0.09, 1.27, 0.09, colors.wood, 0.01);
  for (const z of [-0.85, 0.65])
    box(workshop, 0.2, 1.43, z, 1.85, 0.09, 0.09, colors.wood);
  for (const x of [-0.68, 1.08])
    box(workshop, x, 1.43, -0.1, 0.09, 0.09, 1.6, colors.wood);
  // Miniature lattice tower crane.
  const crane = new THREE.Group();
  crane.position.set(-1.44, 0.13, -0.84);
  workshop.add(crane);
  box(crane, 0, 0.1, 0, 0.62, 0.2, 0.6, colors.cream);
  for (const x of [-0.18, 0.18])
    box(crane, x, 1.6, 0, 0.065, 3.1, 0.08, colors.gold, 0.01);
  for (let i = 0; i < 6; i++)
    beam(
      crane,
      [-0.18, 0.3 + i * 0.46, 0],
      [0.18, 0.75 + i * 0.46, 0],
      0.023,
      colors.gold,
    );
  const craneTop = new THREE.Group();
  craneTop.position.y = 3.17;
  crane.add(craneTop);
  box(craneTop, 0.55, 0, 0, 2.65, 0.12, 0.2, colors.gold);
  box(craneTop, -0.57, -0.14, 0, 0.48, 0.33, 0.4, "#b0b9a2");
  box(craneTop, 0.1, -0.25, 0.05, 0.42, 0.43, 0.46, colors.cream);
  box(craneTop, 0.1, -0.24, 0.29, 0.31, 0.23, 0.02, colors.glass);
  beam(craneTop, [0, 0.55, 0], [1.84, 0.02, 0], 0.018, colors.charcoal);
  beam(craneTop, [0, 0.55, 0], [-0.75, 0.02, 0], 0.018, colors.charcoal);
  cylinder(craneTop, 1.5, -0.61, 0, 0.013, 0.013, 1.2, colors.charcoal, 6);
  box(craneTop, 1.5, -1.26, 0, 0.29, 0.15, 0.26, colors.gold);
  animated.push({ kind: "crane", obj: craneTop });
  for (let j = 0; j < 3; j++) {
    const x = -0.85 + j * 0.75;
    box(workshop, x, 0.21, 1.3, 0.65, 0.29, 0.08, colors.white);
    for (let k = 0; k < 3; k++)
      box(
        workshop,
        x - 0.22 + k * 0.21,
        0.22,
        1.35,
        0.08,
        0.24,
        0.012,
        colors.gold,
        0,
      ).rotation.z = -0.3;
    box(workshop, x, 0.11, 1.3, 0.1, 0.18, 0.3, colors.charcoal);
  }
  for (const x of [1.3, 1.7]) {
    box(workshop, x, 0.16, 1.18, 0.29, 0.05, 0.29, colors.white);
    cylinder(workshop, x, 0.33, 1.18, 0.025, 0.12, 0.31, colors.coral, 8);
  }

  const notes = district("notes", -4.18, 3.18, 5.5, 3.75, "#e1ded0");
  box(notes, 0, 0.97, 0, 3.85, 0.21, 1.75, colors.wood, 0.08);
  for (const x of [-1.54, 1.54])
    for (const z of [-0.57, 0.57])
      box(notes, x, 0.5, z, 0.13, 0.84, 0.13, colors.green);
  // Upright reading lamp.
  cylinder(notes, -1.32, 1.14, -0.45, 0.22, 0.25, 0.08, colors.dark);
  beam(notes, [-1.32, 1.17, -0.45], [-1.32, 2, -0.45], 0.036, colors.green);
  beam(notes, [-1.32, 2, -0.45], [-0.8, 2.18, -0.38], 0.036, colors.green);
  cylinder(notes, -0.77, 2.05, -0.38, 0.13, 0.29, 0.29, colors.green);
  const lamp = new THREE.PointLight("#ffd296", 0, 3);
  lamp.position.set(-0.77, 1.82, -0.38);
  notes.add(lamp);
  pointLights.push(lamp);
  // Three actual pickable books on the tabletop.
  const books = [
    { id: "memory", x: -0.55, z: 0.16, color: colors.sage },
    { id: "embodied", x: 0.16, z: 0.08, color: colors.clay },
    { id: "making", x: 0.83, z: -0.02, color: colors.blue },
  ];
  for (const b of books) {
    const g = new THREE.Group();
    g.position.set(b.x, 1.15, b.z);
    g.rotation.y = b.x * 0.23;
    g.userData.notebook = b.id;
    notes.add(g);
    box(g, 0, 0, 0, 0.49, 0.12, 0.71, colors.white, 0.025);
    box(g, 0, 0.077, 0, 0.54, 0.05, 0.76, b.color, 0.025);
    box(g, 0, -0.077, 0, 0.54, 0.035, 0.76, b.color, 0.025);
    box(g, -0.245, 0.01, 0, 0.035, 0.17, 0.74, b.color);
    textSign(
      g,
      b.id.toUpperCase(),
      0,
      0.11,
      -0.09,
      0.4,
      "#475b4a",
      b.color,
      true,
    );
  }
  cylinder(notes, 1.45, 1.26, 0.23, 0.12, 0.1, 0.3, colors.cream);
  cylinder(notes, 1.45, 1.415, 0.23, 0.092, 0.092, 0.014, "#766044");
  box(notes, 0.33, 0.49, 1.1, 1.2, 0.13, 0.66, colors.sage);
  box(notes, 0.33, 0.93, 1.4, 1.2, 0.8, 0.13, colors.sage);
  for (const x of [-0.12, 0.78])
    box(notes, x, 0.27, 1.1, 0.075, 0.45, 0.55, colors.green);
  planter(notes, 1.57, 1.085, -0.57, 0.23);
  tree(notes, -2.07, -0.95, 0.85);
  textSign(
    notes,
    "THE READING ROOM",
    -0.1,
    0.16,
    1.57,
    2.8,
    "#6e745b",
    "#e1ded0",
    true,
  );

  const gallery = district("gallery", 0.97, 3.58, 3.65, 2.9, "#e9e1d6");
  box(gallery, 0, 1.1, -0.5, 3.1, 2.07, 0.13, colors.cream);
  for (const x of [-1.36, 1.36])
    box(gallery, x, 0.3, -0.5, 0.08, 0.5, 1.1, colors.wood);
  // Tiny colored landscape pictures; clicking them opens the real photo archive.
  for (const [index, x, y, w, h] of [
    [0, -0.85, 1.38, 0.75, 0.86],
    [1, 0.04, 1.45, 0.65, 0.68],
    [2, 0.87, 1.15, 0.66, 1.06],
  ]) {
    const picture = new THREE.Group();
    picture.position.set(x, y, -0.405);
    picture.userData.photo = index === 1 ? "aircraft" : "riverside";
    gallery.add(picture);
    box(picture, 0, 0, 0, w + 0.09, h + 0.09, 0.06, colors.wood, 0.01);
    box(
      picture,
      0,
      0,
      0.036,
      w,
      h,
      0.016,
      [colors.blue, colors.pink, colors.sage][index],
      0.001,
    );
    sphere(picture, w * 0.22, h * 0.18, 0.06, 0.09, colors.cream, [1, 1, 0.1]);
    const hill = box(
      picture,
      0,
      -h * 0.26,
      0.06,
      w * 0.86,
      h * 0.32,
      0.015,
      ["#79948a", "#ba8876", "#8da078"][index],
      0.07,
    );
    hill.rotation.z = -0.1;
  }
  textSign(
    gallery,
    "LIFE, IN FRAGMENTS",
    0,
    0.18,
    0.91,
    2.5,
    "#977665",
    "#e9e1d6",
    true,
  );
  planter(gallery, 1.3, 0.11, 0.7, 0.42);
  box(gallery, -0.6, 0.38, 0.52, 1.28, 0.12, 0.42, colors.wood);
  for (const x of [-1.05, -0.15])
    box(gallery, x, 0.23, 0.52, 0.1, 0.27, 0.34, colors.green);

  // Green edges, lamps, wayfinding, and a tiny delivery rover.
  [
    [-7.5, -4.35, 0.85],
    [-7.52, -0.15, 0.8],
    [7.55, -4.4, 0.82],
    [7.6, 0.17, 0.72],
    [-7.55, 4.35, 0.8],
  ].forEach(([x, z, s]) => tree(board, x, z, s));
  for (const [x, z] of [
    [-0.65, -4.45],
    [-6.6, 1.03],
    [2.6, 1.14],
    [7.8, 1.1],
  ]) {
    cylinder(board, x, 0.82, z, 0.025, 0.035, 1.55, colors.charcoal, 8);
    const bulb = sphere(board, x, 1.62, z, 0.115, colors.white);
    bulb.material = material("#fff5d4", {
      emissive: "#ffcb80",
      emissiveIntensity: 0.1,
    });
    emissives.push(bulb.material);
  }
  const rover = new THREE.Group();
  board.add(rover);
  box(rover, 0, 0.32, 0, 0.7, 0.39, 0.43, colors.white, 0.1);
  box(rover, 0.14, 0.53, 0, 0.3, 0.12, 0.35, colors.sage);
  for (const x of [-0.2, 0.2])
    for (const z of [-0.23, 0.23]) {
      const wheel = cylinder(
        rover,
        x,
        0.17,
        z,
        0.105,
        0.105,
        0.06,
        colors.charcoal,
        10,
      );
      wheel.rotation.x = Math.PI / 2;
    }
  animated.push({ kind: "rover", obj: rover });

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.ShadowMaterial({ opacity: 0.13 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.88;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Pick only meshes with an actionable district ancestor.
  board.traverse((obj) => {
    if (!obj.isMesh) return;
    let node = obj;
    while (node && !node.userData.district) node = node.parent;
    if (node) pickables.push(obj);
  });
  const anchors = {
    agents: new THREE.Vector3(-4.1, 2.9, -1.9),
    embodied: new THREE.Vector3(3.5, 2.7, -1.75),
    workshop: new THREE.Vector3(5.45, 1.8, 3.75),
    notes: new THREE.Vector3(-4.25, 1.4, 4.75),
    gallery: new THREE.Vector3(0.6, 2.6, 3.05),
  };
  const labelNodes = districts.map((d) => {
    const button = document.createElement("button");
    button.className = "world-hotspot";
    button.dataset.district = d.id;
    button.style.setProperty("--district-color", d.color);
    button.setAttribute("aria-label", `Explore ${d.name}`);
    button.setAttribute("aria-controls", "workspace-popover");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span>${d.number}</span> ${d.short}`;
    button.addEventListener("click", () => onSelect(d.id));
    labels.append(button);
    return { button, anchor: anchors[d.id], id: d.id };
  });

  let width = 1,
    height = 1,
    visible = true,
    paused = reducedMotion,
    evening = false;
  let selected = "agents",
    frame = 0,
    animationTime = 0,
    lastTime = 0,
    needsRender = true;
  let cameraTransition = null;
  let disposed = false,
    inRender = false;
  const project = new THREE.Vector3();
  const north = new THREE.Vector3();
  const inverseCameraRotation = new THREE.Quaternion();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let down = null;
  const activePointers = new Map();
  const dom = renderer.domElement;
  const viewportResize = new ResizeObserver(() => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const vertical = Math.max(13.8, 22.8 / aspect);
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestRender();
  });
  viewportResize.observe(host);
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestRender();
    },
    { threshold: 0 },
  );
  intersection.observe(host);
  function updateLabels() {
    for (const { button, anchor } of labelNodes) {
      project.copy(anchor).project(camera);
      const x = (project.x * 0.5 + 0.5) * width;
      const y = (-project.y * 0.5 + 0.5) * height;
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      button.hidden =
        project.z > 1 || x < 15 || x > width - 15 || y < 10 || y > height - 10;
    }
  }
  function updateCompass() {
    // World north is -Z. Project its direction into the camera's screen plane,
    // so the needle agrees with the board at every azimuth and elevation.
    inverseCameraRotation.copy(camera.quaternion).invert();
    north.set(0, 0, -1).applyQuaternion(inverseCameraRotation);
    const angle = Math.atan2(north.x, north.y);
    compass.style.setProperty("--north-angle", `${angle}rad`);
  }
  function render(time) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    inRender = true;
    const dt = Math.min((time - lastTime) / 1000 || 0, 0.05);
    lastTime = time;
    if (!paused) animationTime += dt;
    if (cameraTransition) {
      const t = reducedMotion
        ? 1
        : Math.min((time - cameraTransition.start) / 700, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(
        cameraTransition.from,
        cameraTransition.to,
        ease,
      );
      camera.position.lerpVectors(
        cameraTransition.posFrom,
        cameraTransition.posTo,
        ease,
      );
      if (t === 1) cameraTransition = null;
    }
    const changed = controls.update();
    if (needsRender || changed || !paused || cameraTransition) {
      for (const item of animated) {
        const t = animationTime;
        if (item.kind === "robot") {
          item.obj.position.y =
            item.baseY + Math.sin(t * 1.3 + item.phase) * 0.025;
          item.head.rotation.y = Math.sin(t * 0.65 + item.phase) * 0.13;
        }
        if (item.kind === "arm")
          item.obj.rotation.y = -0.2 + Math.sin(t * 0.45) * 0.22;
        if (item.kind === "crane")
          item.obj.rotation.y = Math.sin(t * 0.16) * 0.2;
        if (item.kind === "dish")
          item.obj.rotation.y = Math.sin(t * 0.22) * 0.27;
        if (item.kind === "rover") {
          item.obj.position.set(Math.sin(t * 0.12) * 6.2, 0, 0.65);
          item.obj.rotation.y = Math.cos(t * 0.12) > 0 ? 0 : Math.PI;
        }
      }
      const ring = selectRings.get(selected);
      if (ring)
        ring.material.opacity = paused
          ? 0.32
          : 0.3 + Math.sin(animationTime * 1.7) * 0.1;
      updateLabels();
      updateCompass();
      renderer.render(scene, camera);
      needsRender = false;
    }
    inRender = false;
    if (!paused || changed || cameraTransition)
      frame = requestAnimationFrame(render);
  }
  function requestRender() {
    needsRender = true;
    if (!frame && !disposed && !inRender) frame = requestAnimationFrame(render);
  }
  controls.addEventListener("change", requestRender);
  controls.addEventListener("start", () => {
    cameraTransition = null;
  });
  function hit(e) {
    const rect = dom.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickables, false)[0]?.object;
  }
  function pointerDown(e) {
    activePointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
    down = { x: e.clientX, y: e.clientY, multi: activePointers.size > 1 };
  }
  function pointerMove(e) {
    if (activePointers.has(e.pointerId))
      activePointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
    if (activePointers.size === 2) {
      if (down) down.multi = true;
    } else if (e.pointerType === "mouse" && !activePointers.size) {
      dom.style.cursor = hit(e) ? "pointer" : "grab";
    }
  }
  function pointerUp(e) {
    activePointers.delete(e.pointerId);
    if (
      !down ||
      down.multi ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6
    ) {
      down = null;
      return;
    }
    let node = hit(e);
    down = null;
    let id, notebook, photo;
    while (node) {
      id ||= node.userData.district;
      notebook ||= node.userData.notebook;
      photo ||= node.userData.photo;
      node = node.parent;
    }
    if (id) onSelect(id);
    if (notebook) onBook(notebook);
    if (photo) onPhoto(photo);
  }
  function pointerCancel(e) {
    activePointers.delete(e.pointerId);
    down = null;
  }
  dom.addEventListener("pointerdown", pointerDown);
  dom.addEventListener("pointermove", pointerMove);
  dom.addEventListener("pointerup", pointerUp);
  dom.addEventListener("pointercancel", pointerCancel);
  function visibilityChange() {
    lastTime = performance.now();
    if (!document.hidden) requestRender();
  }
  document.addEventListener("visibilitychange", visibilityChange);
  dom.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    paused = true;
    host.dispatchEvent(new CustomEvent("world-unavailable"));
  });
  dom.addEventListener("webglcontextrestored", () => {
    paused = reducedMotion;
    requestRender();
  });

  function select(id, focus = true) {
    selected = id;
    for (const [key, ring] of selectRings) ring.visible = key === id;
    for (const { button, id: key } of labelNodes) {
      button.classList.toggle("active", key === id);
      button.setAttribute("aria-pressed", String(key === id));
    }
    if (focus && groups.has(id)) {
      // A gentle shift retains the neighborhood context instead of jumping into buildings.
      const group = groups.get(id);
      const target = new THREE.Vector3(
        group.position.x * 0.12,
        0.35,
        group.position.z * 0.12,
      );
      const shift = target.clone().sub(controls.target);
      cameraTransition = {
        start: performance.now(),
        from: controls.target.clone(),
        to: target,
        posFrom: camera.position.clone(),
        posTo: camera.position.clone().add(shift),
      };
    }
    requestRender();
  }
  select(selected, false);
  requestRender();

  return {
    select,
    pause(value) {
      paused = value;
      requestRender();
    },
    evening(value) {
      evening = value;
      hemi.color.set(value ? "#a9c4d7" : "#f7f8ed");
      hemi.intensity = value ? 1.1 : 2.7;
      sun.color.set(value ? "#f3bc93" : "#fff5db");
      sun.intensity = value ? 1.1 : 3.4;
      fill.intensity = value ? 0.7 : 1.2;
      renderer.toneMappingExposure = value ? 1.0 : 1.03;
      emissives.forEach((m) => (m.emissiveIntensity = value ? 1.8 : 0.1));
      pointLights.forEach((light) => (light.intensity = value ? 3.5 : 0));
      requestRender();
    },
    reset() {
      cameraTransition = null;
      controls.target.set(0, 0.35, 0);
      camera.position.copy(initial);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
      requestRender();
    },
    zoom(delta) {
      camera.zoom = THREE.MathUtils.clamp(
        camera.zoom + delta,
        controls.minZoom,
        controls.maxZoom,
      );
      camera.updateProjectionMatrix();
      requestRender();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      viewportResize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibilityChange);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          for (const m of Array.isArray(obj.material)
            ? obj.material
            : [obj.material]) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      dom.remove();
      labels.replaceChildren();
    },
  };
}
