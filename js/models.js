// ============================================================
// Coral Quest — models.js
// Daftar model 3D. Game mencoba memuat file .glb dari folder /models.
// Jika file belum ada, game memakai model sementara buatan kode,
// jadi game tetap bisa dimainkan sebelum model asli diunduh.
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { makeFish, makeTurtle, makeBranchCoral } from "./creatures.js";

// size = ukuran terbesar (meter di dunia game) setelah dinormalisasi.
// rotY = putaran tambahan (derajat) bila model menghadap arah yang salah.
// swim = true → model diberi gerak berenang ringan.
export const MODELS = {
  karang_bercabang: { file: "karang_bercabang.glb", size: 1.6, query: "branching coral acropora" },
  karang_otak:      { file: "karang_otak.glb",      size: 1.4, query: "brain coral" },
  karang_meja:      { file: "karang_meja.glb",      size: 1.8, query: "table coral" },
  rumput_laut:      { file: "rumput_laut.glb",      size: 1.6, query: "seaweed sargassum kelp low poly" },
  fitoplankton:     { file: "fitoplankton.glb",     size: 0.9, query: "phytoplankton diatom" },
  ikan_kakatua:     { file: "ikan_kakatua.glb",     size: 1.3, swim: true, query: "parrotfish" },
  ikan_baronang:    { file: "ikan_baronang.glb",    size: 1.1, swim: true, query: "rabbitfish siganus" },
  bulu_babi:        { file: "bulu_babi.glb",        size: 0.9, query: "sea urchin diadema" },
  penyu_hijau:      { file: "penyu_hijau.glb",      size: 1.8, swim: true, query: "green sea turtle" },
  ikan_kerapu:      { file: "ikan_kerapu.glb",      size: 1.6, swim: true, query: "grouper fish" },
  hiu_sirip_hitam:  { file: "hiu_sirip_hitam.glb",  size: 2.4, swim: true, query: "blacktip reef shark" },
  ikan_badut:       { file: "ikan_badut.glb",       size: 0.6, swim: true, query: "clownfish" },
  anemon:           { file: "anemon.glb",           size: 1.0, query: "sea anemone" },
  sampah_botol:     { file: "sampah_botol.glb",     size: 0.7, query: "plastic bottle trash" },
  sampah_kantong:   { file: "sampah_kantong.glb",   size: 0.8, query: "plastic bag" },
  jaring_hantu:     { file: "jaring_hantu.glb",     size: 1.6, query: "fishing net" },
  jangkar:          { file: "jangkar.glb",          size: 1.2, query: "boat anchor" },
  patahan_karang:   { file: "patahan_karang.glb",   size: 1.6, query: "coral rubble rocks" },
  batu_karang:      { file: "batu_karang.glb",      size: 2.2, query: "underwater rock reef low poly" },
  pelampung:        { file: "pelampung.glb",        size: 1.0, query: "mooring buoy" },
  rak_transplantasi:{ file: "rak_transplantasi.glb",size: 1.6, query: "coral frame restoration" },
  perahu:           { file: "perahu.glb",           size: 3.0, query: "fishing boat low poly" },
};

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("js/vendor/addons/libs/draco/");
loader.setDRACOLoader(draco);

const cache = new Map(); // id -> Promise<{scene, animations} | null>
export const usingReal = new Set();

function tryLoad(id) {
  if (!cache.has(id)) {
    const def = MODELS[id];
    const url = "models/" + def.file;
    cache.set(id, fetch(url, { method: "HEAD" })
      .then((r) => (r.ok ? loader.loadAsync(url) : null))
      .then((g) => { if (g) usingReal.add(id); return g; })
      .catch(() => null));
  }
  return cache.get(id);
}

// Normalisasi: pusatkan, dasar di y=0, skala ke ukuran target
function normalize(obj, size) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.x, dim.y, dim.z || 1e-6);
  obj.scale.multiplyScalar(s);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
}

/** Buat salinan model. Selalu mengembalikan Group (tidak pernah gagal). */
export async function create(id, opts = {}) {
  const def = MODELS[id];
  const root = new THREE.Group();
  root.name = id;
  root.userData.modelId = id;
  const g = await tryLoad(id);
  let inner;
  if (g) {
    inner = SkeletonUtils.clone(g.scene);
    inner.traverse((o) => { if (o.isMesh) { o.castShadow = false; if (o.material) o.material = o.material.clone(); } });
    if (def.rotY) inner.rotation.y = THREE.MathUtils.degToRad(def.rotY);
    const wrap = new THREE.Group(); wrap.add(inner);
    normalize(wrap, opts.size ?? def.size);
    root.add(wrap);
    if (g.animations?.length) {
      const mixer = new THREE.AnimationMixer(inner);
      mixer.clipAction(g.animations[0]).play();
      root.userData.tick = (dt) => mixer.update(dt);
    } else if (def.swim) addSwim(root, wrap);
  } else {
    inner = PROC[id] ? PROC[id]() : PROC._box();
    const wrap = new THREE.Group(); wrap.add(inner);
    normalize(wrap, opts.size ?? def.size);
    root.add(wrap);
    if (inner.userData.tick) root.userData.tick = inner.userData.tick;
    else if (def.swim) addSwim(root, wrap);
  }
  return root;
}

function addSwim(root, wrap) {
  const ph = Math.random() * 6;
  const y0 = wrap.position.y;
  root.userData.tick = (dt, t) => { wrap.position.y = y0 + Math.sin(t * 1.6 + ph) * 0.06; wrap.rotation.y = Math.sin(t * 2.2 + ph) * 0.08; };
}

// ---------- Recolor helpers (untuk terumbu memutih / rusak) ----------
export function tint(obj, color, amount = 1) {
  const c = new THREE.Color(color);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m.userData.baseColor) m.userData.baseColor = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
      if (m.color) m.color.copy(m.userData.baseColor).lerp(c, amount);
      if (m.map && amount > 0.5) { m.userData.baseMap ??= m.map; }
    });
  });
}

// ============================================================
// Model sementara (procedural low-poly)
// ============================================================
const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

function fish({ body = "#3fa7d6", belly = "#e8f3f5", fin = "#2b7fa3", len = 1, h = 0.45, w = 0.28, spots = null, beak = false, dorsal = 0.25 } = {}) {
  const g = new THREE.Group();
  const bodyG = new THREE.SphereGeometry(0.5, 14, 10);
  bodyG.scale(len, h, w);
  const b = new THREE.Mesh(bodyG, M(body));
  g.add(b);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), M(belly));
  bel.scale.set(len * 0.98, h * 0.98, w * 0.98);
  g.add(bel);
  const tail = new THREE.Group();
  const tg = new THREE.ConeGeometry(h * 0.55, len * 0.35, 4);
  tg.rotateZ(Math.PI / 2);
  const tm = new THREE.Mesh(tg, M(fin));
  tm.scale.set(1, 1, 0.25);
  tm.position.x = -len * 0.16;
  tail.add(tm);
  tail.position.x = -len * 0.45;
  g.add(tail);
  const dorsalM = new THREE.Mesh(new THREE.ConeGeometry(0.12, dorsal, 3), M(fin));
  dorsalM.scale.z = 0.3; dorsalM.position.set(-0.05, h * 0.5, 0); dorsalM.rotation.z = -0.4;
  g.add(dorsalM);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M("#ffffff"));
    eye.position.set(len * 0.33, h * 0.1, s * w * 0.46);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M("#111"));
    pupil.position.set(0.02, 0, s * 0.03);
    eye.add(pupil);
    g.add(eye);
    const pf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 3), M(fin));
    pf.rotation.set(s * 0.6, 0, Math.PI / 2 + 0.6); pf.scale.z = 0.3; pf.position.set(len * 0.1, -h * 0.15, s * w * 0.45);
    g.add(pf);
  }
  if (beak) {
    const bk = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M("#f2f0e6"));
    bk.position.set(len * 0.49, -h * 0.06, 0); bk.scale.set(1, 0.7, 1.3);
    g.add(bk);
  }
  if (spots) {
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), M(spots));
      const a = Math.random() * Math.PI * 2;
      sp.position.set((Math.random() - 0.5) * len * 0.7, Math.sin(a) * h * 0.35, Math.sign(Math.cos(a) || 1) * w * 0.5);
      g.add(sp);
    }
  }
  const ph = Math.random() * 6;
  g.userData.tick = (dt, t) => { tail.rotation.y = Math.sin(t * 7 + ph) * 0.45; g.position.y = Math.sin(t * 1.5 + ph) * 0.05; g.rotation.y = Math.sin(t * 0.9 + ph) * 0.06; };
  return g;
}

function branchCoral(color = "#e9708a") {
  const g = new THREE.Group();
  const mat = M(color);
  const tipMat = M(new THREE.Color(color).offsetHSL(0, 0, 0.18));
  function branch(parent, len, rad, depth) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad, len, 6), mat);
    m.position.y = len / 2;
    const holder = new THREE.Group(); holder.add(m); parent.add(holder);
    const tip = new THREE.Group(); tip.position.y = len; holder.add(tip);
    if (depth <= 0) { const t = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.8, 6, 4), tipMat); tip.add(t); return holder; }
    const k = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const c = branch(tip, len * 0.72, rad * 0.75, depth - 1);
      c.rotation.set((Math.random() - 0.5) * 1.1, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.1);
    }
    return holder;
  }
  for (let i = 0; i < 5; i++) {
    const b = branch(g, 0.55, 0.09, 2);
    b.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    b.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
  }
  return g;
}

function brainCoral(color = "#d9b25a") {
  const geo = new THREE.SphereGeometry(0.6, 96, 48, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 1 + 0.07 * Math.sin(v.x * 26 + Math.sin(v.z * 11) * 3 + Math.sin(v.y * 9) * 2) * (0.6 + 0.4 * Math.sin(v.z * 17 + v.x * 5));
    v.multiplyScalar(r); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.25) }));
  m.scale.y = 0.75;
  const g = new THREE.Group(); g.add(m);
  return g;
}

function tableCoral(color = "#8fbf6a") {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6), M(color));
  stem.position.y = 0.25; g.add(stem);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.1, 10), M(color));
  top.position.y = 0.55; g.add(top);
  return g;
}

function seaweed(colors = ["#6a8f2a", "#8a6a2a", "#4f7d2b"]) {
  const g = new THREE.Group();
  const blades = [];
  for (let i = 0; i < 9; i++) {
    const h = 1 + Math.random() * 0.8;
    const geo = new THREE.PlaneGeometry(0.16, h, 1, 8);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, M(colors[i % colors.length], { side: THREE.DoubleSide }));
    m.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    m.rotation.y = Math.random() * Math.PI;
    m.userData.base = geo.attributes.position.array.slice();
    m.userData.ph = Math.random() * 6;
    blades.push(m); g.add(m);
  }
  g.userData.tick = (dt, t) => {
    for (const b of blades) {
      const a = b.geometry.attributes.position, base = b.userData.base;
      for (let i = 0; i < a.count; i++) {
        const y = base[i * 3 + 1];
        a.array[i * 3] = base[i * 3] + Math.sin(t * 1.6 + y * 2.2 + b.userData.ph) * 0.08 * y;
      }
      a.needsUpdate = true;
    }
  };
  return g;
}

function phyto() {
  const g = new THREE.Group();
  const mat = M("#7dff9a", { emissive: "#2fbf5a", emissiveIntensity: 0.8 });
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03 + Math.random() * 0.05, 0), mat);
    s.position.set((Math.random() - 0.5) * 0.8, Math.random() * 0.8, (Math.random() - 0.5) * 0.8);
    g.add(s);
  }
  g.userData.tick = (dt, t) => { g.rotation.y = t * 0.3; };
  return g;
}

function urchin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M("#1b1530"));
  body.position.y = 0.2; g.add(body);
  const spineG = new THREE.ConeGeometry(0.02, 0.55, 4); spineG.translate(0, 0.27, 0);
  const sm = M("#2a1f45");
  for (let i = 0; i < 46; i++) {
    const s = new THREE.Mesh(spineG, sm);
    const d = new THREE.Vector3().randomDirection(); if (d.y < -0.3) d.y *= -1;
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    s.position.copy(body.position).addScaledVector(d, 0.15);
    g.add(s);
  }
  return g;
}

function turtle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), M("#6b5a2e"));
  shell.scale.set(1, 0.35, 0.8); shell.position.y = 0.25; g.add(shell);
  const pl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), M("#c9b98a"));
  pl.scale.set(0.95, 0.18, 0.75); pl.position.y = 0.17; g.add(pl);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M("#7f8f4a"));
  head.position.set(0.7, 0.25, 0); head.scale.set(1.3, 0.9, 0.9); g.add(head);
  const flips = [];
  for (const [x, z, s] of [[0.3, 0.45, 1], [0.3, -0.45, -1], [-0.35, 0.35, 1], [-0.35, -0.35, -1]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.5), M("#7f8f4a"));
    f.position.set(x, 0.2, z); f.rotation.y = s * 0.5; f.userData.s = s; g.add(f); flips.push(f);
  }
  g.userData.tick = (dt, t) => flips.forEach((f, i) => (f.rotation.x = Math.sin(t * 2 + i) * 0.35 * f.userData.s));
  return g;
}

function shark() {
  const g = fish({ body: "#7d8a96", belly: "#e6eaee", fin: "#6b7782", len: 2.2, h: 0.5, w: 0.42, dorsal: 0.6 });
  // black tips
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 3), M("#111"));
  tip.position.set(-0.13, 0.25 + 0.22, 0); g.add(tip);
  return g;
}

function anemone() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.2, 10), M("#b34a6a")); base.position.y = 0.1; g.add(base);
  const tents = [];
  for (let i = 0; i < 40; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.45, 5), M("#ffb3c8"));
    t.geometry.translate(0, 0.22, 0);
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.25;
    t.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
    t.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
    t.userData.r0 = t.rotation.x; t.userData.ph = Math.random() * 6;
    tents.push(t); g.add(t);
  }
  g.userData.tick = (dt, tt) => tents.forEach((t) => (t.rotation.x = t.userData.r0 + Math.sin(tt * 1.5 + t.userData.ph) * 0.2));
  return g;
}

function bottle() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 10), M("#a8e0f0", { transparent: true, opacity: 0.75, roughness: 0.2 }));
  b.rotation.z = Math.PI / 2; b.position.y = 0.12; g.add(b);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), M("#2b6fd6"));
  cap.rotation.z = Math.PI / 2; cap.position.set(0.33, 0.12, 0); g.add(cap);
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.18, 10), M("#e8463c"));
  lbl.rotation.z = Math.PI / 2; lbl.position.y = 0.12; g.add(lbl);
  return g;
}

function bag() {
  const geo = new THREE.IcosahedronGeometry(0.35, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + Math.random() * 0.5), p.getY(i) * (0.5 + Math.random() * 0.6), p.getZ(i) * (0.8 + Math.random() * 0.5));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M("#f4f4f0", { transparent: true, opacity: 0.85 }));
  m.position.y = 0.2;
  const g = new THREE.Group(); g.add(m);
  g.userData.tick = (dt, t) => (m.rotation.y = Math.sin(t * 0.8) * 0.3);
  return g;
}

function net() {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: "#d8d27a" });
  const pts = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j < 5; j++) {
    const y = (x, z) => 0.15 + Math.sin(x * 2) * 0.1 + Math.cos(z * 3) * 0.08;
    pts.push(new THREE.Vector3(i * 0.15, y(i * 0.15, j * 0.15), j * 0.15), new THREE.Vector3(i * 0.15, y(i * 0.15, (j + 1) * 0.15), (j + 1) * 0.15));
    pts.push(new THREE.Vector3(j * 0.15, y(j * 0.15, i * 0.15), i * 0.15), new THREE.Vector3((j + 1) * 0.15, y((j + 1) * 0.15, i * 0.15), i * 0.15));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  // invisible hit box so it can be tapped
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.15; g.add(hit);
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), M("#ff7a1a"));
  float.position.set(0.7, 0.3, 0.6); g.add(float);
  return g;
}

function anchor() {
  const g = new THREE.Group();
  const mat = M("#4a4f55", { metalness: 0.6, roughness: 0.5 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), mat); shaft.position.y = 0.5; g.add(shaft);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), mat); ring.position.y = 1.05; g.add(ring);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 16, Math.PI), mat); arm.rotation.z = Math.PI; arm.position.y = 0.38; g.add(arm);
  g.rotation.z = 0.5;
  return g;
}

function rubble() {
  const g = new THREE.Group();
  const mat = M("#9a968c");
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25 + Math.random() * 0.3, 5), mat);
    m.position.set((Math.random() - 0.5) * 1.4, 0.05, (Math.random() - 0.5) * 1.4);
    m.rotation.set(Math.PI / 2 + (Math.random() - 0.5), Math.random() * 3, 0);
    g.add(m);
  }
  return g;
}

const noise3 = (x, y, z) => Math.sin(x * 3.1 + Math.cos(z * 2.3)) * Math.cos(y * 2.7 + x) * 0.5 + 0.5;
function rock() {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.88 + noise3(p.getX(i), p.getY(i), p.getZ(i)) * 0.2; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.6, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M("#7d7566", { flatShading: false, roughness: 1 }));
  m.position.y = 0.3;
  const g = new THREE.Group(); g.add(m);
  return g;
}

function buoy() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), M("#ff7a1a", { emissive: "#7a2a00", emissiveIntensity: 0.3 }));
  ball.position.y = 1.4; g.add(ball);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4), M("#e8e0c0"));
  rope.position.y = 0.7; g.add(rope);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), M("#8a8a86"));
  block.position.y = 0.1; g.add(block);
  g.userData.tick = (dt, t) => { ball.position.y = 1.4 + Math.sin(t * 1.2) * 0.05; };
  return g;
}

function frame() {
  const g = new THREE.Group();
  const mat = M("#3d3f44", { metalness: 0.5 });
  const legs = [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]];
  for (const [x, z] of legs) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat); l.position.set(x, 0.25, z); g.add(l); }
  for (const z of [-0.4, 0, 0.4]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), mat); b.rotation.z = Math.PI / 2; b.position.set(0, 0.5, z); g.add(b); }
  const frags = new THREE.Group(); frags.name = "fragments"; g.add(frags);
  for (let i = 0; i < 6; i++) {
    const c = branchCoral(["#f07aa0", "#f2a35a", "#b67ff0"][i % 3]);
    c.scale.setScalar(0.28);
    c.position.set(-0.45 + (i % 3) * 0.45, 0.5, i < 3 ? -0.2 : 0.2);
    frags.add(c);
  }
  return g;
}

function boat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), M("#2f6db5"));
  hull.position.y = 0.25; g.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.7), M("#f2efe6"));
  cab.position.set(-0.4, 0.75, 0); g.add(cab);
  return g;
}

export const PROC = {
  karang_bercabang: () => makeBranchCoral(["#e8547a", "#f0803c", "#a65fe0", "#e26ab8", "#f2a93b"][Math.floor(Math.random() * 5)]),
  karang_otak: () => brainCoral("#d8b45c"),
  karang_meja: () => tableCoral("#8fc36a"),
  rumput_laut: () => seaweed(),
  fitoplankton: phyto,
  ikan_kakatua: () => makeFish("ikan_kakatua"),
  ikan_baronang: () => makeFish("ikan_baronang"),
  bulu_babi: urchin,
  penyu_hijau: makeTurtle,
  ikan_kerapu: () => makeFish("ikan_kerapu"),
  hiu_sirip_hitam: () => makeFish("hiu_sirip_hitam"),
  ikan_badut: () => makeFish("ikan_badut"),
  anemon: anemone,
  sampah_botol: bottle,
  sampah_kantong: bag,
  jaring_hantu: net,
  jangkar: anchor,
  patahan_karang: rubble,
  batu_karang: rock,
  pelampung: buoy,
  rak_transplantasi: frame,
  perahu: boat,
  _box: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M("#ccc"))); return g; },
};
