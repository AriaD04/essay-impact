// ============================================================
// Coral Quest — levels/common.js
// Bahan bangunan yang dipakai beberapa level.
// ============================================================
import * as THREE from "three";
import { create, MODELS } from "../models.js";
import { terrainHeight } from "../engine.js";

export const groundY = (x, z) => terrainHeight(x, z);

export async function place(stage, id, x, z, { rotY = Math.random() * Math.PI * 2, size, y, parent } = {}) {
  const m = await create(id, size ? { size } : {});
  m.position.set(x, y ?? groundY(x, z) + (MODELS[id]?.swim ? 0.5 : 0), z);
  m.rotation.y = rotY;
  (parent || stage.world).add(m);
  return m;
}

/** Platform bundar berwarna untuk zona/peran */
export function platform(color, radius = 1.6, height = 0.18) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 40),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.4 })
  );
  disc.position.y = height / 2;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: c }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = height + 0.01;
  g.add(ring);
  g.userData.disc = disc;
  g.userData.radius = radius;
  return g;
}

/** Cincin penanda yang berdenyut (untuk titik yang bisa diketuk) */
export function marker(color = "#ffd166", radius = 0.8) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  ring.rotation.x = Math.PI / 2;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.3, 24), new THREE.MeshBasicMaterial({ visible: false }));
  const g = new THREE.Group();
  g.add(ring, hit);
  const ph = Math.random() * 6;
  g.userData.tick = (dt, t) => { const s = 1 + Math.sin(t * 3 + ph) * 0.08; ring.scale.set(s, s, s); ring.material.opacity = 0.6 + Math.sin(t * 3 + ph) * 0.3; };
  return g;
}

/** Ikan yang berenang mengelilingi titik pusat */
export async function swimmer(stage, id, { cx = 0, cz = 0, r = 3, y = 1.5, speed = 0.4, parent, size } = {}) {
  const m = await create(id, size ? { size } : {});
  const holder = new THREE.Group();
  holder.add(m);
  (parent || stage.world).add(holder);
  let a = Math.random() * Math.PI * 2;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const yy = y + (Math.random() - 0.5) * 0.8;
  const rr = r * (0.75 + Math.random() * 0.5);
  holder.userData.tick = (dt) => {
    a += dt * speed * dir / Math.max(rr, 0.5) * 2;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    holder.position.set(x, yy + Math.sin(a * 3) * 0.2, z);
    // arah renang = garis singgung lingkaran (model menghadap +X)
    const tx = -Math.sin(a) * dir, tz = Math.cos(a) * dir;
    holder.rotation.y = -Math.atan2(tz, tx);
  };
  return holder;
}

/** Dekorasi terumbu: batu, karang, rumput laut */
export async function reefDecor(stage, cx, cz, { radius = 4, corals = 8, rocks = 3, weeds = 3, parent, palette } = {}) {
  const items = [];
  const ids = ["karang_bercabang", "karang_otak", "karang_meja"];
  for (let i = 0; i < rocks; i++) {
    const a = (i / rocks) * Math.PI * 2 + Math.random(), r = radius * (0.45 + Math.random() * 0.45);
    items.push(await place(stage, "batu_karang", cx + Math.cos(a) * r, cz + Math.sin(a) * r, { parent, size: 1.0 + Math.random() * 0.8 }));
  }
  for (let i = 0; i < corals; i++) {
    const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
    const c = await place(stage, ids[i % ids.length], cx + Math.cos(a) * r, cz + Math.sin(a) * r, { parent, size: 0.9 + Math.random() * 0.9 });
    c.userData.coral = true;
    items.push(c);
  }
  for (let i = 0; i < weeds; i++) {
    const a = Math.random() * Math.PI * 2, r = radius * (0.5 + Math.random() * 0.5);
    items.push(await place(stage, "rumput_laut", cx + Math.cos(a) * r, cz + Math.sin(a) * r, { parent, size: 1 + Math.random() * 0.6 }));
  }
  return items;
}

export function shake(stage, strength = 0.3, dur = 0.5) {
  const base = stage.camera.position.clone();
  return stage.tween(dur, (e) => {
    const k = (1 - e) * strength;
    stage.camera.position.set(base.x + (Math.random() - 0.5) * k, base.y + (Math.random() - 0.5) * k, base.z + (Math.random() - 0.5) * k);
  }).then(() => stage.camera.position.copy(base));
}

export const isPortrait = () => window.innerWidth < window.innerHeight;

/** Area sentuh tak terlihat yang lebih besar, agar benda kecil mudah diseret di HP */
export function addHitbox(obj, radius = 0.85) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.worldToLocal(center);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(center);
  obj.add(hit);
  return hit;
}
