// ============================================================
// Misi 1 — Kenali Penghuni Karang
// Seret setiap makhluk ke platform perannya. Ketuk untuk membaca fakta.
// ============================================================
import { ui } from "../ui.js";
import { T } from "../i18n.js";
import { audio } from "../audio.js";
import { ROLES, ORGANISMS } from "../data.js";
import { addHitbox, place, platform, reefDecor, groundY, isPortrait } from "./common.js";

const CLASS_ITEMS = ["karang_bercabang", "karang_otak", "rumput_laut", "fitoplankton", "ikan_kakatua", "ikan_baronang", "bulu_babi", "penyu_hijau", "ikan_kerapu", "hiu_sirip_hitam"];
const QUICK_ITEMS = ["karang_bercabang", "rumput_laut", "ikan_kakatua", "hiu_sirip_hitam"];

export async function run(stage, { mode }) {
  stage.clear();
  audio.setMood("play");
  const quick = mode === "quick";
  const ids = quick ? QUICK_ITEMS : CLASS_ITEMS;
  ui.hud(T("l1.title"), T("l1.obj"));

  const portrait = isPortrait();
  stage.lockCamera(true);
  stage.flyTo(portrait ? [0, 17, 10] : [0, 9, 14], portrait ? [0, 0, 0.8] : [0, 0.5, 0.5], 0.01);
  stage.controls.maxDistance = 30;

  // latar terumbu di belakang
  await reefDecor(stage, 0, -11, { radius: 7, corals: 10, rocks: 4, weeds: 4 });

  // platform peran
  const roleKeys = Object.keys(ROLES);
  const zones = roleKeys.map((key, i) => {
    const p = platform(ROLES[key].color, portrait ? 1.4 : 1.7);
    const x = portrait ? (i % 2 ? 2.1 : -2.1) : -6.3 + i * 4.2;
    const z = portrait ? (i < 2 ? -5.2 : -1.8) : -3;
    p.position.set(x, groundY(x, z) + 0.05, z);
    p.userData.role = key;
    stage.world.add(p);
    stage.addLabel(p, `${ROLES[key].icon} ${T(`role.${key}.name`)}`, { offset: 0.9, className: "zone" }).style.borderColor = ROLES[key].color;
    return p;
  });

  // barisan makhluk di depan
  const items = [];
  const perRow = portrait ? 3 : quick ? 4 : 5;
  const spacing = portrait ? 1.9 : 2.4;
  for (let i = 0; i < ids.length; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, ids.length - row * perRow);
    const x = (col - (inRow - 1) / 2) * spacing;
    const z = (portrait ? 1.8 : 2.4) + row * (portrait ? 2.1 : 2.6);
    const m = await place(stage, ids[i], x, z, { rotY: (Math.random() - 0.5) * 0.5 });
    m.userData.home = m.position.clone();
    addHitbox(m);
    m.userData.done = false;
    stage.addLabel(m, T(`org.${ids[i]}.name`), { offset: 1.5, className: "small" });
    items.push(m);
  }

  let correct = 0, mistakes = 0;
  const total = items.length;
  ui.score(`✔ 0/${total}`);

  return new Promise((resolve) => {
    stage.interact({
      getTargets: () => items.filter((m) => !m.userData.done),
      dragY: 1.0,
      onTap: (m) => { audio.sfx("pop"); ui.factCard(m.userData.modelId, m.userData.done); },
      onDragStart: () => { audio.sfx("pick"); ui.hideCard(); },
      onDrop: (m, p) => {
        const id = m.userData.modelId, role = ORGANISMS[id];
        const zone = zones.find((z) => Math.hypot(z.position.x - p.x, z.position.z - p.z) < z.userData.radius + 0.4);
        if (!zone) { audio.sfx("undo"); stage.moveTo(m, m.userData.home, 0.4); return; }
        if (zone.userData.role === role) {
          m.userData.done = true;
          correct++;
          const n = items.filter((o) => o.userData.done && o.userData.zone === zone).length;
          m.userData.zone = zone;
          const a = n * 1.3 + 0.4, r = n === 0 ? 0 : 0.85;
          const target = zone.position.clone().add({ x: Math.cos(a) * r, y: 0.2, z: Math.sin(a) * r });
          stage.moveTo(m, target, 0.35);
          m.scale.setScalar(0.8);
          audio.sfx("drop"); audio.sfx("correct");
          ui.toast(T("l1.ok", { name: `@org.${id}.name`, role: `@role.${role}.name` }), "good");
          ui.factCard(id, true);
          ui.score(`✔ ${correct}/${total}`);
          if (correct === total) finish();
        } else {
          mistakes++;
          audio.sfx("wrong");
          ui.toast(T("l1.wrong", { name: `@org.${id}.name` }), "bad", 2600);
          stage.moveTo(m, m.userData.home, 0.45);
        }
      },
    });

    async function finish() {
      const score = Math.max(40, 100 - mistakes * 8);
      await stage.wait(0.8);
      ui.hideCard();
      audio.sfx("complete");
      await ui.dialog({
        title: T("done.title", { n: 1 }),
        sound: null,
        html: `${ui.stars(score)}${T("l1.end")}<p class="note">${T("done.score", { s: score })} · ${T("done.mistakes", { m: mistakes })}</p>`,
      });
      resolve(score);
    }
  });
}
