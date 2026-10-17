// ============================================================
// Misi 2 — Jaring Makanan Terumbu
// Susun rantai makanan di tangga energi sebelum waktu habis,
// lalu jawab pertanyaan "Bagaimana jika...?"
// ============================================================
import * as THREE from "three";
import { ui } from "../ui.js";
import { T } from "../i18n.js";
import { audio } from "../audio.js";
import { FOOD_CHAIN } from "../data.js";
import { addHitbox, place, reefDecor, groundY, isPortrait } from "./common.js";

const TIME = 45;

export async function run(stage, { mode }) {
  stage.clear();
  audio.setMood("play");
  ui.hud(T("l2.title"), T("l2.obj"));
  const portrait = isPortrait();
  stage.lockCamera(true);
  stage.flyTo(portrait ? [0, 13, 12] : [0, 8, 13], [0, 1.2, 0.5], 0.01);

  await reefDecor(stage, 0, -11, { radius: 7, corals: 9, rocks: 4, weeds: 4 });

  // tangga energi: 4 tiang makin tinggi & makin kecil
  const steps = [];
  for (let i = 0; i < 4; i++) {
    const x = portrait ? -3.3 + i * 2.2 : -5.4 + i * 3.6;
    const z = -2;
    const h = 0.4 + i * 0.8;
    const r = (portrait ? 0.95 : 1.35) - i * (portrait ? 0.1 : 0.18);
    const col = new THREE.Color().setHSL(0.47 - i * 0.07, 0.7, 0.55);
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 32), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.5 }));
    pillar.position.y = h / 2;
    g.add(pillar);
    g.position.set(x, groundY(x, z), z);
    g.userData = { tier: i, top: h, radius: r };
    stage.world.add(g);
    stage.addLabel(g, `${i + 1}. ${T(portrait ? `tier.s${i}` : `tier.${i}`)}`, { offset: h + 0.35, className: "tier" });
    steps.push(g);
    if (i < 3) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), new THREE.MeshBasicMaterial({ color: "#ffd166" }));
      arrow.rotation.z = -Math.PI / 2;
      const ax = x + (portrait ? 1.1 : 1.8);
      arrow.position.set(ax, groundY(ax, z) + h + 0.5, z);
      stage.world.add(arrow);
    }
  }

  // makhluk diacak di depan
  const order = [...FOOD_CHAIN].sort(() => Math.random() - 0.5);
  const items = [];
  for (let i = 0; i < order.length; i++) {
    const x = (i - 1.5) * (portrait ? 2 : 2.8), z = portrait ? 2.6 : 3;
    const m = await place(stage, order[i].id, x, z, { rotY: (Math.random() - 0.5) * 0.4 });
    m.userData.tier = order[i].tier;
    m.userData.home = m.position.clone();
    addHitbox(m);
    stage.addLabel(m, T(`org.${order[i].id}.name`), { offset: 1.5, className: "small" });
    items.push(m);
  }

  let placed = 0, mistakes = 0, left = TIME, timeUp = false;
  ui.score(`✔ 0/4`);
  ui.timer(left);
  const tick = setInterval(() => {
    left--;
    ui.timer(Math.max(left, 0));
    if (left > 0 && left <= 10) audio.sfx(left <= 5 ? "tickUrgent" : "tick");
    if (left <= 0 && !timeUp) { timeUp = true; audio.sfx("timeup"); ui.toast(T("l2.timeup"), "bad", 3000); }
  }, 1000);

  const chainScore = await new Promise((resolve) => {
    stage.interact({
      getTargets: () => items.filter((m) => !m.userData.done),
      dragY: 1.6,
      dropY: 1.2,
      onTap: (m) => { audio.sfx("pop"); ui.factCard(m.userData.modelId, false); },
      onDragStart: () => { audio.sfx("pick"); ui.hideCard(); },
      onDrop: (m, p) => {
        const s = steps.find((st) => Math.hypot(st.position.x - p.x, st.position.z - p.z) < st.userData.radius + 0.5);
        if (!s) { audio.sfx("undo"); stage.moveTo(m, m.userData.home, 0.4); return; }
        if (s.userData.tier === m.userData.tier) {
          m.userData.done = true;
          placed++;
          stage.moveTo(m, new THREE.Vector3(s.position.x, s.position.y + s.userData.top, s.position.z), 0.35);
          m.scale.setScalar(0.85);
          audio.sfx("drop"); audio.sfx("correct");
          ui.toast(T("l2.ok", { name: `@org.${m.userData.modelId}.name`, n: s.userData.tier + 1 }), "good");
          ui.score(`✔ ${placed}/4`);
          if (placed === 4) {
            clearInterval(tick);
            const timeBonus = timeUp ? 0 : Math.round((left / TIME) * 30);
            resolve(Math.max(30, 70 + timeBonus - mistakes * 10));
          }
        } else {
          mistakes++;
          audio.sfx("wrong");
          ui.toast(T("l2.wrong"), "bad");
          stage.moveTo(m, m.userData.home, 0.45);
        }
      },
    });
  });
  ui.timer(null);
  ui.hideCard();

  // animasi energi: label persen muncul satu per satu di tiap tangga
  ui.objective(T("l2.watch"));
  for (let i = 0; i < 4; i++) {
    stage.addLabel(steps[i], `⚡ ${T(`energy.${i}`)}`, { offset: steps[i].userData.top + 2.1, className: "hint" });
    audio.sfx("coin");
    await stage.wait(0.7);
  }
  await ui.dialog({ title: T("l2.energy.title"), html: T("l2.energy.body") });

  // pertanyaan "Bagaimana jika...?"
  let quizOk = 0;
  const qs = ["l2.q1", "l2.q2"].map((k) => ({ q: k, options: [`${k}.a`, `${k}.b`, `${k}.c`, `${k}.d`], correct: 0, explain: `${k}.x` }));
  if (mode !== "quick") for (const q of qs) if (await ui.quiz(q)) quizOk++;
  const score = mode === "quick" ? chainScore : Math.round(chainScore * 0.6 + (quizOk / qs.length) * 40);
  audio.sfx("complete");
  await ui.dialog({
    title: T("done.title", { n: 2 }),
    sound: null,
    html: `${ui.stars(score)}<p class="note">${T("done.score", { s: score })} · ${T("l2.mistakes", { m: mistakes })}${mode !== "quick" ? ` · ${T("l2.quizline", { a: quizOk, b: qs.length })}` : ""}</p>`,
  });
  return score;
}
