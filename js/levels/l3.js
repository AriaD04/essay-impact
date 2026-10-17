// ============================================================
// Misi 3 — Cek Kesehatan Karang
// Tiga terumbu: sehat, memutih (bleaching), dan rusak oleh manusia.
// Pemain mendiagnosis dan mencari penyebab kerusakan.
// ============================================================
import * as THREE from "three";
import { ui } from "../ui.js";
import { T } from "../i18n.js";
import { audio } from "../audio.js";
import { tint } from "../models.js";
import { place, reefDecor, swimmer, groundY } from "./common.js";

const REEFS = { sehat: -10, putih: 0, rusak: 10 };

const THREATS = [
  { id: "sampah_botol", x: -1.6, z: 1.2 },
  { id: "sampah_kantong", x: 1.8, z: 0.6 },
  { id: "jaring_hantu", x: 0.4, z: -1.8 },
  { id: "jangkar", x: -2.4, z: -1.2 },
  { id: "patahan_karang", x: 2.6, z: -1.6 },
];

async function buildHealthy(stage) {
  const cx = REEFS.sehat;
  await reefDecor(stage, cx, 0, { radius: 3.6, corals: 14, rocks: 3, weeds: 2 });
  await place(stage, "anemon", cx + 1, 1.5);
  for (const id of ["ikan_badut", "ikan_kakatua", "ikan_baronang", "ikan_kakatua", "ikan_kerapu", "ikan_baronang", "ikan_badut"]) await swimmer(stage, id, { cx, cz: 0, r: 3, y: 1.4, speed: 0.5 });
  await swimmer(stage, "hiu_sirip_hitam", { cx, cz: 0, r: 3.4, y: 2.6, speed: 0.45 });
}

async function buildBleaching(stage) {
  const cx = REEFS.putih;
  const items = await reefDecor(stage, cx, 0, { radius: 3.6, corals: 14, rocks: 3, weeds: 1 });
  for (const id of ["ikan_baronang", "ikan_kakatua"]) await swimmer(stage, id, { cx, cz: 0, r: 3, y: 1.4, speed: 0.4 });
  return items.filter((o) => o.userData.coral);
}

async function buildDamaged(stage) {
  const cx = REEFS.rusak;
  const corals = await reefDecor(stage, cx, 0, { radius: 3.8, corals: 5, rocks: 2, weeds: 5 });
  corals.filter((o) => o.userData.coral).forEach((c) => tint(c, "#8d8a80", 0.85));
  for (let i = 0; i < 3; i++) await place(stage, "patahan_karang", cx - 2 + i * 1.6, 1.8 - i * 0.5, { size: 1.4 });
  const found = [];
  for (const t of THREATS) {
    const m = await place(stage, t.id, cx + t.x, t.z, { size: t.id === "patahan_karang" ? 1.8 : undefined });
    m.userData.threat = t.id;
    found.push(m);
  }
  return found;
}

export async function run(stage, { mode }) {
  stage.clear();
  audio.setMood("play");
  const quick = mode === "quick";
  ui.hud(T("l3.title"), T("l3.obj"));
  stage.flyTo([0, 9, 17], [0, 0.5, 0], 0.01);

  await buildHealthy(stage);
  const bleachCorals = await buildBleaching(stage);
  const threats = await buildDamaged(stage);
  const signs = [
    [REEFS.sehat, "l3.signA"],
    [REEFS.putih, "l3.signB"],
    [REEFS.rusak, "l3.signC"],
  ].map(([x, key]) => {
    const m = new THREE.Object3D(); m.position.set(x, groundY(x, 4.2), 4.2); stage.world.add(m);
    return stage.addLabel(m, T(key), { offset: 0.2, className: "zone" });
  });

  let points = 0, max = 0;

  // ---- A: terumbu sehat ----
  if (!quick) {
    audio.sfx("whoosh");
    await stage.flyTo([REEFS.sehat, 4.5, 8], [REEFS.sehat, 1, 0], 1.4);
    ui.objective(T("l3.obsA"));
    await stage.wait(1.2);
    max++;
    if (await ui.quiz({ q: "l3.qa", options: ["l3.qa.a", "l3.qa.b", "l3.qa.c", "l3.qa.d"], correct: 0, explain: "l3.qa.x" })) points++;
  }

  // ---- B: pemutihan karang ----
  audio.sfx("whoosh");
  await stage.flyTo([REEFS.putih, 4.5, 8], [REEFS.putih, 1, 0], 1.4);
  ui.objective(T("l3.obsB"));
  signs[1].innerHTML = T("l3.heat");
  stage.scene.fog.color.set("#1d6b7d");
  await stage.wait(0.8);
  audio.sfx("heat");
  await stage.tween(3, (e) => bleachCorals.forEach((c) => tint(c, "#f4f1ea", e)));
  signs[1].innerHTML = T("l3.bleached");
  max++;
  if (await ui.quiz({ q: "l3.qb", options: ["l3.qb.a", "l3.qb.b", "l3.qb.c", "l3.qb.d"], correct: 0, explain: "l3.qb.x" })) points++;
  stage.scene.fog.color.set("#0a4d6e");

  // ---- C: kerusakan akibat manusia ----
  audio.sfx("whoosh");
  await stage.flyTo([REEFS.rusak, 5, 8.5], [REEFS.rusak, 0.6, 0], 1.4);
  signs[2].innerHTML = T("l3.damaged");
  const need = quick ? 3 : THREATS.length;
  ui.objective(T("l3.find", { n: need }));
  let foundN = 0;
  ui.score(`🔍 0/${need}`);
  await new Promise((resolve) => {
    stage.interact({
      getTargets: () => threats.filter((m) => !m.userData.found),
      onTap: async (m) => {
        const k = `l3.t.${m.userData.threat}`;
        m.userData.found = true;
        foundN++;
        audio.sfx("found");
        ui.score(`🔍 ${foundN}/${need}`);
        stage.addLabel(m, "✔ " + T(k), { offset: 1, className: "done" });
        ui.toast(T("l3.found", { t: "@" + k }), "good");
        await ui.dialog({ title: "🔍 " + T(k), html: `<p>${T(k + ".x")}</p>`, buttons: [{ label: T("btn.ok"), value: true, cls: "primary" }], sound: null });
        if (foundN >= need) resolve();
      },
    });
  });
  points += 2; max += 2;

  await ui.dialog({ title: T("l3.c.title"), html: T("l3.c.body") });
  await stage.flyTo([0, 9, 17], [0, 0.5, 0], 1.2);
  const score = Math.round((points / max) * 100);
  audio.sfx("complete");
  await ui.dialog({ title: T("done.title", { n: 3 }), sound: null, html: `${ui.stars(score)}${T("l3.end")}<p class="note">${T("done.score", { s: score })}</p>` });
  return score;
}
