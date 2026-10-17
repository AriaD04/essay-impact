// ============================================================
// Coral Quest — creatures.js
// Model makhluk laut buatan kode versi "HD":
// tubuh halus (lathe), tekstur pola per spesies (canvas),
// sirip transparan, mata mengkilap, dan gerak tubuh meliuk
// (vertex shader) saat berenang.
// ============================================================
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- util tekstur ----------
function canvasTex(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- gerak meliuk (dibagikan ke tubuh & sirip) ----------
// Ikan menghadap +X, panjang L. Ekor (x negatif) bergoyang paling kuat.
function swimMaterial(mat, uni) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime;
    sh.uniforms.uAmp = uni.uAmp;
    sh.uniforms.uLen = uni.uLen;
    sh.vertexShader = "uniform float uTime; uniform float uAmp; uniform float uLen;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float sx = transformed.x / uLen;               // +0.5 kepala, -0.5 ekor
       float k = smoothstep(0.35, -0.55, sx);          // makin ke ekor makin kuat
       transformed.z += sin(sx * 6.0 - uTime * 7.0) * uAmp * uLen * k;`
    );
  };
  mat.customProgramCacheKey = () => "swim";
  return mat;
}

// ---------- profil tubuh ----------
function bodyGeometry(L, H, W, { taper = 0.8, nose = 0.6 } = {}) {
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 ekor → 1 kepala
    // pangkal ekor ramping, badan penuh, kepala membulat
    let r = Math.sin(Math.PI * Math.pow(t, taper));
    r = Math.pow(Math.max(r, 0), nose) * 0.5 * H;
    r = Math.max(r, t < 0.05 ? 0.06 * H : 0.001);
    pts.push(new THREE.Vector2(r, (t - 0.5) * L));
  }
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateZ(-Math.PI / 2); // panjang ke sumbu X, kepala +X
  g.scale(1, 1, W / H);    // pipihkan ke samping
  g.computeVertexNormals();
  return g;
}
// jari-jari tubuh pada posisi t (0 ekor → 1 kepala)
function radiusAt(t, H, taper = 0.8, nose = 0.6) {
  return Math.pow(Math.max(Math.sin(Math.PI * Math.pow(t, taper)), 0), nose) * 0.5 * H;
}

// tekstur tubuh: x = keliling (0.25 perut, 0.75 punggung), y = 0 kepala → bawah ekor
function bodyTexture(sp) {
  return canvasTex(512, 256, (g, w, h) => {
    // gradasi punggung gelap → perut terang
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, sp.side);
    grd.addColorStop(0.25, sp.belly);
    grd.addColorStop(0.5, sp.side);
    grd.addColorStop(0.75, sp.back);
    grd.addColorStop(1, sp.side);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    sp.paint?.(g, w, h);
    // kilau sisik halus
    g.globalAlpha = 0.07;
    g.strokeStyle = "#ffffff";
    for (let y = 4; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < w; x += 12) { g.beginPath(); g.arc(x, y, 5, 0.2, Math.PI - 0.2); g.stroke(); }
    g.globalAlpha = 1;
  });
}
// garis melintang tubuh (y canvas sesuai posisi tubuh)
const band = (g, w, h, v, thick, color, edge) => {
  const y = (1 - v) * h;
  if (edge) { g.fillStyle = edge; g.fillRect(0, y - thick / 2 - 6, w, thick + 12); }
  g.fillStyle = color; g.fillRect(0, y - thick / 2, w, thick);
};
const spots = (seed, n, color, rMin, rMax, yMin = 0, yMax = 1) => (g, w, h) => {
  const r = rand(seed);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(r() * w, (yMin + r() * (yMax - yMin)) * h, rMin + r() * (rMax - rMin), 0, Math.PI * 2); g.fill(); }
};

// tekstur sirip: jari-jari sirip + tepi
function finTexture(color, edge, tip) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (tip) { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.75, "rgba(0,0,0,0)"); gr.addColorStop(1, tip); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, (i / 13) * h); g.stroke(); }
    if (edge) { g.strokeStyle = edge; g.lineWidth = 10; g.strokeRect(0, 0, w, h); }
  });
}
function finMesh(shape, tex, opacity, uni) {
  const geo = new THREE.ShapeGeometry(shape, 12);
  // UV dari bounding box
  geo.computeBoundingBox();
  const bb = geo.boundingBox, uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  const mat = swimMaterial(new THREE.MeshPhysicalMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity, roughness: 0.5, depthWrite: opacity > 0.95 }), uni);
  return new THREE.Mesh(geo, mat);
}

// ---------- spesies ----------
const SPECIES = {
  ikan_badut: {
    L: 1, H: 0.5, W: 0.28, taper: 0.75, nose: 0.55, back: "#e8590c", side: "#ff7b1a", belly: "#ffa04d",
    paint: (g, w, h) => { band(g, w, h, 0.76, 34, "#ffffff", "#141414"); band(g, w, h, 0.46, 30, "#ffffff", "#141414"); band(g, w, h, 0.12, 16, "#ffffff", "#141414"); },
    fin: "#ff7b1a", finEdge: "#141414", tail: "round", dorsal: "round", eye: 0.06,
  },
  ikan_kakatua: {
    L: 1.2, H: 0.48, W: 0.3, taper: 0.8, nose: 0.5, back: "#11806f", side: "#2fbfa7", belly: "#a8ecd9",
    paint: (g, w, h) => {
      g.strokeStyle = "rgba(255,120,190,0.55)"; g.lineWidth = 3;
      for (let y = 0; y < h; y += 14) for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + ((y / 14) % 2) * 8, y, 7, 0.3, Math.PI - 0.3); g.stroke(); }
      g.fillStyle = "#ff8cc6"; g.fillRect(0, 0, w, 18); // moncong kemerahan
    },
    fin: "#ff8cc6", finEdge: "#2fbfa7", tail: "lunate", dorsal: "long", eye: 0.05, beak: true,
  },
  ikan_baronang: {
    L: 1, H: 0.6, W: 0.2, taper: 0.85, nose: 0.6, back: "#7d7a3a", side: "#b9a95a", belly: "#ece2b0",
    paint: spots(11, 220, "rgba(255,248,210,0.75)", 2, 5, 0.05, 0.95),
    fin: "#c2b25f", tail: "fork", dorsal: "spiny", eye: 0.055,
  },
  ikan_kerapu: {
    L: 1.5, H: 0.55, W: 0.4, taper: 0.9, nose: 0.7, back: "#5b3c22", side: "#8a6239", belly: "#d1b089",
    paint: (g, w, h) => { spots(23, 160, "rgba(45,25,12,0.75)", 4, 9, 0.08, 0.95)(g, w, h); g.fillStyle = "rgba(40,22,10,0.9)"; g.fillRect(0, 0, w * 0.18, 10); g.fillRect(w * 0.32, 0, w * 0.18, 10); },
    fin: "#6e4b2b", tail: "round", dorsal: "spiny", eye: 0.05, bigMouth: true,
  },
  hiu_sirip_hitam: {
    L: 2.4, H: 0.46, W: 0.4, taper: 1.1, nose: 0.75, back: "#6d7d8b", side: "#8d9cab", belly: "#f1f4f6",
    fin: "#7c8b99", finTip: "#0d0d0d", tail: "shark", dorsal: "shark", eye: 0.035,
  },
};

function tailShape(type, L, H) {
  const s = new THREE.Shape();
  const x0 = -L / 2 + 0.02;
  if (type === "fork" || type === "lunate" || type === "shark") {
    const len = type === "shark" ? 0.32 * L : 0.24 * L, up = type === "shark" ? H * 1.1 : H * 0.75, dn = type === "shark" ? H * 0.55 : up;
    s.moveTo(x0, 0.06 * H);
    s.quadraticCurveTo(x0 - len * 0.5, up * 0.5, x0 - len, up);
    s.quadraticCurveTo(x0 - len * (type === "lunate" ? 0.55 : 0.7), 0, x0 - len, -dn);
    s.quadraticCurveTo(x0 - len * 0.5, -dn * 0.5, x0, -0.06 * H);
  } else {
    const len = 0.22 * L;
    s.moveTo(x0, 0.05 * H);
    s.bezierCurveTo(x0 - len * 0.6, H * 0.55, x0 - len * 1.2, H * 0.35, x0 - len, 0);
    s.bezierCurveTo(x0 - len * 1.2, -H * 0.35, x0 - len * 0.6, -H * 0.55, x0, -0.05 * H);
  }
  return s;
}
function dorsalShape(type, L, sp) {
  const s = new THREE.Shape();
  const top = (t) => radiusAt(t, sp.H, sp.taper, sp.nose) * 0.98;
  const a = type === "shark" ? 0.5 : type === "long" ? 0.22 : 0.25, b = type === "shark" ? 0.68 : type === "round" ? 0.62 : 0.78;
  const xa = (a - 0.5) * L, xb = (b - 0.5) * L;
  s.moveTo(xb, top(b) - 0.02);
  if (type === "shark") {
    s.lineTo(xb - 0.05 * L, top(b) + sp.H * 0.85);
    s.quadraticCurveTo(xa + 0.02 * L, top(a) + sp.H * 0.4, xa - 0.04 * L, top(a) - 0.02);
  } else if (type === "spiny") {
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = b - (b - a) * (i / n), x = (t - 0.5) * L;
      s.lineTo(x + 0.01 * L, top(t) + sp.H * (0.32 + (i % 2 ? -0.08 : 0.04)) * (i < 2 ? 0.7 : 1));
    }
    s.lineTo(xa - 0.03 * L, top(a) - 0.02);
  } else {
    s.bezierCurveTo(xb - 0.1 * L, top(b) + sp.H * 0.45, xa + 0.1 * L, top(a) + sp.H * 0.45, xa - 0.04 * L, top(a) - 0.02);
  }
  s.lineTo(xb, top(b) - 0.02);
  return s;
}
function smallFin(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-len * 0.3, wid, -len, wid * 0.8, -len, 0);
  s.bezierCurveTo(-len, -wid * 0.4, -len * 0.3, -wid * 0.3, 0, 0);
  return s;
}

const eyeWhite = new THREE.MeshPhysicalMaterial({ color: "#f4f1e8", roughness: 0.2, clearcoat: 1 });
const eyeBlack = new THREE.MeshPhysicalMaterial({ color: "#050505", roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0 });

export function makeFish(id) {
  const sp = SPECIES[id];
  const g = new THREE.Group();
  const uni = { uTime: { value: Math.random() * 10 }, uAmp: { value: id === "hiu_sirip_hitam" ? 0.06 : 0.08 }, uLen: { value: sp.L } };

  // tubuh
  const bodyMat = swimMaterial(new THREE.MeshPhysicalMaterial({ map: bodyTexture(sp), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color("#ffffff") }), uni);
  const body = new THREE.Mesh(bodyGeometry(sp.L, sp.H, sp.W, sp), bodyMat);
  g.add(body);

  // sirip
  const finTex = finTexture(sp.fin, sp.finEdge, sp.finTip);
  const op = id === "hiu_sirip_hitam" ? 1 : 0.88;
  g.add(finMesh(tailShape(sp.tail, sp.L, sp.H), finTex, op, uni));
  g.add(finMesh(dorsalShape(sp.dorsal, sp.L, sp), finTex, op, uni));
  // sirip anal (bawah)
  const anal = finMesh(dorsalShape(sp.dorsal === "shark" ? "round" : sp.dorsal, sp.L * 0.8, sp), finTex, op, uni);
  anal.scale.set(0.7, -0.6, 1); anal.position.x = -0.12 * sp.L; g.add(anal);
  // sirip dada kiri-kanan
  for (const side of [-1, 1]) {
    const pf = finMesh(smallFin(sp.L * (id === "hiu_sirip_hitam" ? 0.22 : 0.16), sp.H * 0.22), finTex, op, uni);
    pf.position.set(sp.L * 0.2, -sp.H * 0.14, side * sp.W * 0.5);
    pf.rotation.set(side * 1.25, side * -0.35, -0.35);
    pf.userData.side = side;
    g.add(pf);
    g.userData.pf ||= []; g.userData.pf.push(pf);
  }

  // mata
  const tEye = 0.82, rE = radiusAt(tEye, sp.H, sp.taper, sp.nose);
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(sp.eye, 16, 12), eyeWhite);
    e.position.set((tEye - 0.5) * sp.L, rE * 0.25, side * rE * (sp.W / sp.H) * 0.92);
    const p = new THREE.Mesh(new THREE.SphereGeometry(sp.eye * 0.62, 14, 10), eyeBlack);
    p.position.set(sp.eye * 0.18, 0, side * sp.eye * 0.5);
    e.add(p);
    g.add(e);
  }
  if (sp.beak) {
    const bk = new THREE.Mesh(new THREE.SphereGeometry(sp.H * 0.16, 16, 12), new THREE.MeshPhysicalMaterial({ color: "#f1ede0", roughness: 0.3, clearcoat: 0.8 }));
    bk.scale.set(1.1, 0.8, 1.2); bk.position.set(sp.L * 0.49, -sp.H * 0.04, 0); g.add(bk);
  }

  const ph = Math.random() * 6;
  g.userData.tick = (dt, t) => {
    uni.uTime.value += dt;
    g.position.y = Math.sin(t * 1.3 + ph) * 0.04;
    g.userData.pf.forEach((f) => (f.rotation.y = f.userData.side * (-0.35 + Math.sin(t * 5 + ph) * 0.3)));
  };
  return g;
}

// ============================================================
// Penyu hijau
// ============================================================
function scuteTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#4c3a1c"; g.fillRect(0, 0, w, h);
    // sisik tempurung: poligon dengan gradasi radial (pola ala tempurung penyu)
    const r = rand(7);
    const cells = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) cells.push([(x + 0.5 + (y % 2) * 0.5) / 6 * w, (y + 0.5) / 5 * h]);
    for (const [cx, cy] of cells) {
      const rad = 54 + r() * 10;
      const grd = g.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, rad);
      grd.addColorStop(0, "#c59a52"); grd.addColorStop(0.45, "#8a6328"); grd.addColorStop(1, "#3b2a12");
      g.fillStyle = grd;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; const rr = rad * (0.85 + r() * 0.2); k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(240,215,160,0.55)"; g.lineWidth = 3; g.stroke();
      // garis-garis halus memancar
      g.strokeStyle = "rgba(30,18,6,0.35)"; g.lineWidth = 1.5;
      for (let k = 0; k < 9; k++) { const a = r() * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rad * 0.8, cy + Math.sin(a) * rad * 0.8); g.stroke(); }
    }
  });
}
function skinTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#6f7d43"; g.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let i = 0; i < 160; i++) {
      const x = r() * w, y = r() * h, s = 6 + r() * 12;
      g.fillStyle = `rgba(${150 + r() * 60},${150 + r() * 50},${90 + r() * 40},0.55)`;
      g.strokeStyle = "rgba(40,45,20,0.6)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill(); g.stroke();
    }
  });
}
export function makeTurtle() {
  const g = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ map: skinTexture(), roughness: 0.55, clearcoat: 0.3 });
  // tempurung atas
  const shellGeo = new THREE.SphereGeometry(0.6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({ map: scuteTexture(), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25 }));
  shell.scale.set(1.05, 0.42, 0.82); shell.position.y = 0.2;
  g.add(shell);
  // tepi tempurung & plastron
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 10, 64), new THREE.MeshPhysicalMaterial({ color: "#5a4420", roughness: 0.4, clearcoat: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.scale.set(1.05, 0.82, 1); rim.position.y = 0.2; g.add(rim);
  const plast = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#e3d6a6", roughness: 0.7 }));
  plast.scale.set(1.0, 0.14, 0.78); plast.position.y = 0.2; g.add(plast);
  // kepala & leher
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.25, 16), skin);
  neck.rotation.z = Math.PI / 2; neck.position.set(0.66, 0.2, 0); g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), skin);
  head.scale.set(1.35, 0.95, 0.95); head.position.set(0.86, 0.22, 0); g.add(head);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), eyeBlack);
    e.position.set(0.94, 0.27, s * 0.1); g.add(e);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 12), new THREE.MeshStandardMaterial({ color: "#3a3320", roughness: 0.5 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(1.05, 0.19, 0); g.add(beak);
  // sirip (dayung)
  const paddle = (len, wid) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(len * 0.3, wid, len * 0.9, wid * 0.6, len, 0); s.bezierCurveTo(len * 0.7, -wid * 0.4, len * 0.2, -wid * 0.5, 0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 16 });
    geo.translate(0, 0, -0.015);
    return new THREE.Mesh(geo, skin);
  };
  const flips = [];
  for (const [x, z, len, wid, sweep, front] of [[0.32, 0.4, 0.78, 0.26, 0.35, true], [0.32, -0.4, 0.78, 0.26, 0.35, true], [-0.4, 0.3, 0.34, 0.16, 1.0, false], [-0.4, -0.3, 0.34, 0.16, 1.0, false]]) {
    const side = Math.sign(z);
    const flap = new THREE.Group();          // berputar pada sumbu X tubuh → ujung sirip naik-turun
    const dir = new THREE.Group();           // mengarahkan sirip ke samping dan sedikit ke belakang
    const f = paddle(len, wid);
    f.rotation.x = Math.PI / 2;              // dayung berbaring datar
    dir.add(f);
    dir.rotation.y = side > 0 ? -Math.PI / 2 - sweep : Math.PI / 2 + sweep;
    flap.add(dir);
    flap.position.set(x, 0.17, z * 0.95);
    flap.userData = { side, front };
    g.add(flap); flips.push(flap);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12), skin);
  tail.rotation.z = Math.PI / 2; tail.position.set(-0.68, 0.18, 0); g.add(tail);
  const ph = Math.random() * 6;
  g.userData.tick = (dt, t) => {
    flips.forEach((f) => {
      const k = f.userData.front ? 0.38 : 0.18;
      f.rotation.x = (Math.sin(t * 1.8 + ph) * k - 0.1) * f.userData.side;
    });
    head.rotation.y = Math.sin(t * 0.7 + ph) * 0.15;
    g.position.y = Math.sin(t * 0.9 + ph) * 0.05;
  };
  return g;
}

// ============================================================
// Karang bercabang halus (tabung meruncing, digabung jadi 1 mesh)
// ============================================================
export function makeBranchCoral(color = "#ef6f8f", seed = Math.floor(Math.random() * 1e6) + 1) {
  const r = rand(seed);
  const geos = [], tips = [];
  function branch(start, dir, len, rad, depth) {
    const pts = [];
    const p = start.clone(), d = dir.clone();
    for (let i = 0; i <= 4; i++) {
      pts.push(p.clone());
      d.add(new THREE.Vector3((r() - 0.5) * 0.35, 0.12, (r() - 0.5) * 0.35)).normalize();
      p.addScaledVector(d, len / 4);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 10, rad, 10, false);
    // runcingkan sepanjang tabung
    const pos = tube.attributes.position, segs = 10, radial = 10;
    for (let i = 0; i <= segs; i++) {
      const k = 1 - (i / segs) * 0.45;
      const c = curve.getPointAt(i / segs);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * k, c.y + (pos.getY(idx) - c.y) * k, c.z + (pos.getZ(idx) - c.z) * k);
      }
    }
    tube.computeVertexNormals();
    geos.push(tube);
    const end = curve.getPointAt(1);
    if (depth <= 0) { tips.push([end, rad * 0.75]); return; }
    const kids = 2 + (r() < 0.45 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const nd = d.clone().add(new THREE.Vector3((r() - 0.5) * 1.6, 0.25, (r() - 0.5) * 1.6)).normalize();
      branch(end, nd, len * 0.8, rad * 0.7, depth - 1);
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    const tilt = 0.35 + r() * 0.5;
    branch(new THREE.Vector3(Math.cos(a) * 0.12 * r(), 0, Math.sin(a) * 0.12 * r()), new THREE.Vector3(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).normalize(), 0.3, 0.08, 3);
  }
  // pangkal karang
  geos.push(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.5, 1.2));
  const g = new THREE.Group();
  const base = new THREE.Color(color);
  g.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.55, clearcoat: 0.25, sheen: 0.6, sheenColor: base.clone().offsetHSL(0, 0, 0.3) })));
  const tipGeos = tips.map(([p, rad]) => new THREE.SphereGeometry(rad, 10, 8).translate(p.x, p.y, p.z));
  g.add(new THREE.Mesh(mergeGeometries(tipGeos), new THREE.MeshPhysicalMaterial({ color: base.clone().offsetHSL(0.02, 0.05, 0.22), roughness: 0.4, emissive: base, emissiveIntensity: 0.15 })));
  return g;
}
