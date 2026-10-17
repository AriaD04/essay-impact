// ============================================================
// Coral Quest — engine.js
// Panggung 3D bawah laut: renderer, kamera, cahaya, lantai pasir,
// partikel, sistem drag & tap, label HTML, dan tween.
// ============================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// simple deterministic noise for terrain
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function terrainHeight(x, z) {
  return (noise(x * 0.15, z * 0.15) - 0.5) * 1.2 + (noise(x * 0.5, z * 0.5) - 0.5) * 0.25;
}

export class Stage {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.updaters = new Set();
    this.labels = [];
    this.tweens = new Set();

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.water = new THREE.Color("#0a4d6e");
    this.scene.background = this._gradientTexture();
    this.scene.fog = new THREE.FogExp2(this.water, 0.028);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 7, 14);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = 6;
    c.maxDistance = 26;
    c.minPolarAngle = 0.35;
    c.maxPolarAngle = 1.35;
    c.target.set(0, 1, 0);

    this._envMap();
    this._lights();
    this._floor();
    this._particles();
    this._shafts();

    this.world = new THREE.Group(); // level content goes here
    this.scene.add(this.world);

    this.labelLayer = document.getElementById("labels");
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    window.addEventListener("resize", () => this.resize());
    this.resize();
    r.setAnimationLoop(() => this._tick());
  }

  _gradientTexture() {
    const cv = document.createElement("canvas");
    cv.width = 4; cv.height = 256;
    const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#3fb7d6");
    grd.addColorStop(0.45, "#0f6a8f");
    grd.addColorStop(1, "#04283f");
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _envMap() {
    // peta lingkungan sederhana (gradasi laut) agar permukaan basah memantulkan cahaya
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const cols = [], p = geo.attributes.position, top = new THREE.Color("#d9fbff"), mid = new THREE.Color("#2f8fb3"), bot = new THREE.Color("#06263a");
    for (let i = 0; i < p.count; i++) { const k = p.getY(i) / 10; const c = k > 0 ? mid.clone().lerp(top, k) : mid.clone().lerp(bot, -k); cols.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    this.scene.environment = pm.fromScene(env, 0.02).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight("#bdf3ff", "#2a4a3a", 1.6));
    const sun = (this.sun = new THREE.DirectionalLight("#fff5d6", 2.2));
    sun.position.set(6, 18, 8);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#5fd0ff", 0.6);
    fill.position.set(-8, 4, -6);
    this.scene.add(fill);
  }

  _floor() {
    const geo = new THREE.PlaneGeometry(90, 90, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = [];
    const a = new THREE.Color("#bba77a"), b = new THREE.Color("#8f7b52");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const m = a.clone().lerp(b, noise(x * 0.8, z * 0.8));
      col.push(m.r, m.g, m.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    // animated caustics through a canvas texture
    this.caustic = this._causticTexture();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissiveMap: this.caustic, emissive: new THREE.Color("#7fdcff"), emissiveIntensity: 0.18 });
    this.caustic.wrapS = this.caustic.wrapT = THREE.RepeatWrapping;
    this.caustic.repeat.set(10, 10);
    const floor = (this.floor = new THREE.Mesh(geo, mat));
    floor.name = "floor";
    this.scene.add(floor);
  }

  _causticTexture() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      g.beginPath();
      const x = Math.random() * 128, y = Math.random() * 128, r = 8 + Math.random() * 18;
      for (let k = 0; k <= 7; k++) {
        const ang = (k / 7) * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.5);
        const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    return t;
  }

  _particles() {
    const n = 700, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = Math.random() * 16;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: "#d8f6ff", size: 0.06, transparent: true, opacity: 0.6, depthWrite: false });
    this.snow = new THREE.Points(geo, mat);
    this.scene.add(this.snow);
  }

  _shafts() {
    this.shafts = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: "#bff3ff", transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.2, 22, 12, 1, true), mat);
      m.position.set((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 20 - 4);
      m.rotation.z = 0.25 + Math.random() * 0.1;
      m.userData.phase = Math.random() * 6;
      this.shafts.add(m);
    }
    this.scene.add(this.shafts);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // on portrait phones pull the camera back a little so the scene still fits
    this.camera.fov = w < h ? 65 : 50;
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  _tick() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    // kualitas adaptif: bila HP terasa berat (< ~30 fps), turunkan resolusi render
    if (!this.qualityChecked) {
      (this._frames ||= []).push(raw);
      if (this._frames.length === 90) {
        this.qualityChecked = true;
        const avg = this._frames.slice(30).reduce((a, b) => a + b, 0) / 60;
        if (avg > 1 / 30 && this.renderer.getPixelRatio() > 1) { this.renderer.setPixelRatio(1); this.resize(); }
      }
    }
    const t = this.clock.elapsedTime;
    this.caustic.offset.set(t * 0.02, t * 0.013);
    this.floor.material.emissiveIntensity = 0.16 + Math.sin(t * 1.3) * 0.05;
    this.snow.position.y = -((t * 0.15) % 2);
    this.snow.rotation.y = t * 0.01;
    this.shafts.children.forEach((s) => (s.material.opacity = 0.022 + Math.sin(t * 0.6 + s.userData.phase) * 0.012));
    for (const tw of [...this.tweens]) tw(dt);
    for (const fn of [...this.updaters]) fn(dt, t);
    this.world.traverse((o) => o.userData.tick && o.userData.tick(dt, t));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  // ---------- tween ----------
  tween(duration, onStep, easing = ease.outCubic) {
    return new Promise((resolve) => {
      let el = 0;
      const step = (dt) => {
        el += dt;
        const k = Math.min(el / duration, 1);
        onStep(easing(k), k);
        if (k >= 1) { this.tweens.delete(step); resolve(); }
      };
      this.tweens.add(step);
    });
  }
  moveTo(obj, to, duration = 0.5, easing) {
    const from = obj.position.clone();
    return this.tween(duration, (e) => obj.position.lerpVectors(from, to, e), easing);
  }
  flyTo(pos, target, duration = 1.2) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3(...pos), t1 = new THREE.Vector3(...target);
    return this.tween(duration, (e) => { this.camera.position.lerpVectors(p0, p1, e); this.controls.target.lerpVectors(t0, t1, e); }, ease.inOutCubic);
  }
  wait(s) { return this.tween(s, () => {}, ease.linear); }

  // ---------- labels ----------
  addLabel(obj, html, { offset = 1.2, className = "" } = {}) {
    const el = document.createElement("div");
    el.className = "label3d " + className;
    el.innerHTML = html;
    this.labelLayer.appendChild(el);
    const rec = { obj, el, offset };
    this.labels.push(rec);
    return el;
  }
  _updateLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const L of this.labels) {
      if (!L.obj.parent) { L.el.style.display = "none"; continue; }
      L.obj.getWorldPosition(v);
      v.y += L.offset;
      v.project(this.camera);
      const visible = v.z < 1 && L.obj.visible;
      L.el.style.display = visible ? "" : "none";
      L.el.style.transform = `translate(-50%,-100%) translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  // ---------- picking ----------
  _setPointer(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  pick(ev, roots) {
    this._setPointer(ev);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !roots.includes(o)) o = o.parent;
      if (o && o.visible) return { root: o, point: h.point };
    }
    return null;
  }
  rayToPlane(ev, y) {
    this._setPointer(ev);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  /**
   * Interaksi seret & ketuk.
   * opts: { getTargets(): Object3D[], dragY, onTap(root), onDragStart(root), onDragMove(root,p), onDrop(root,p) }
   * Jika onDrop tidak diberikan, objek hanya bisa diketuk.
   */
  interact(opts) {
    const dom = this.renderer.domElement;
    let active = null, start = null, dragging = false, lift = 0;
    const down = (ev) => {
      if (this.locked) return;
      const hit = this.pick(ev, opts.getTargets());
      if (!hit) return;
      active = hit.root; start = { x: ev.clientX, y: ev.clientY }; dragging = false;
      this.controls.enabled = false;
      dom.setPointerCapture?.(ev.pointerId);
    };
    const move = (ev) => {
      if (!active) {
        const hit = this.pick(ev, opts.getTargets());
        dom.style.cursor = hit ? (opts.onDrop ? "grab" : "pointer") : "";
        return;
      }
      const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!dragging && d > 8 && opts.onDrop) {
        dragging = true; lift = opts.dragY ?? 1.2;
        dom.style.cursor = "grabbing";
        opts.onDragStart?.(active);
      }
      if (dragging) {
        const p = this.rayToPlane(ev, lift);
        if (p) { active.position.set(p.x, lift, p.z); opts.onDragMove?.(active, p); }
      }
    };
    const up = (ev) => {
      if (!active) return;
      const a = active; active = null;
      this.controls.enabled = !this.cameraLocked;
      dom.style.cursor = "";
      if (dragging) opts.onDrop(a, this.rayToPlane(ev, opts.dropY ?? 0) || a.position.clone());
      else opts.onTap?.(a);
      dragging = false;
    };
    const off = () => {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    (this.disposers ||= []).push(off);
    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return off;
  }

  lockCamera(on) { this.cameraLocked = on; this.controls.enabled = !on; }

  // ---------- level lifecycle ----------
  clear() {
    (this.disposers || []).forEach((f) => f());
    this.disposers = [];
    for (const L of this.labels) L.el.remove();
    this.labels = [];
    this.updaters.clear();
    this.tweens.clear();
    this.world.clear();
    this.locked = false;
    this.lockCamera(false);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 26;
    this.controls.autoRotate = false;
  }
}
