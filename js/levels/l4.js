// ============================================================
// Misi 4 — Misi Restorasi
// Anggaran 12 poin aksi untuk memulihkan terumbu rusak,
// lalu simulasi 5 tahun memperlihatkan hasil keputusan pemain.
// ============================================================
import * as THREE from "three";
import { ui } from "../ui.js";
import { T } from "../i18n.js";
import { audio } from "../audio.js";
import { tint } from "../models.js";
import { place, reefDecor, swimmer, groundY, marker, shake, isPortrait } from "./common.js";
import { ACTIONS, BUDGET, TRASH_COUNT, SPOTS, simulate, scoreOf, feedback } from "./sim.js";

const $ = (s) => document.querySelector(s);

export async function run(stage, { mode }) {
  stage.clear();
  document.querySelector(".timeline")?.remove();
  audio.setMood("play");
  ui.hud(T("l4.title"), T("l4.obj", { b: BUDGET }));
  const portrait = isPortrait();
  stage.lockCamera(true);
  stage.flyTo(portrait ? [0, 16, 9] : [0, 8, 11], portrait ? [0, 0, -0.5] : [0, 0.5, 0], 0.01);
  stage.controls.maxDistance = 22;

  // ---------- terumbu rusak ----------
  const deco = await reefDecor(stage, 0, -1, { radius: 5, corals: 6, rocks: 4, weeds: 0 });
  deco.filter((o) => o.userData.coral).forEach((c) => tint(c, "#8d8a80", 0.85));

  // alga yang menutupi
  const algae = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = 2.2 + Math.random() * 2;
    algae.push(await place(stage, "rumput_laut", Math.cos(a) * r, -1 + Math.sin(a) * r, { size: 1.3 + Math.random() * 0.5 }));
  }

  // titik patahan karang (tempat rak transplantasi)
  const spotPos = [[-3, 1.6], [3.1, 1.4], [-1.2, -3.6], [2, -3.2]];
  const spots = [];
  for (const [x, z] of spotPos.slice(0, SPOTS)) {
    await place(stage, "patahan_karang", x, z, { size: 1.6 });
    const mk = marker("#ffd166", 0.9);
    mk.position.set(x, groundY(x, z) + 0.15, z);
    mk.visible = false;
    stage.world.add(mk);
    spots.push(mk);
  }

  // sampah
  const trashIds = ["sampah_botol", "sampah_kantong", "sampah_botol", "jaring_hantu", "sampah_kantong"];
  const trashPos = [[-1.5, 2.8], [1.2, 2.4], [4.2, -0.6], [-4.4, -1.2], [0.4, 0.2]];
  const trash = [];
  for (let i = 0; i < TRASH_COUNT; i++) trash.push(await place(stage, trashIds[i], trashPos[i][0], trashPos[i][1]));

  // perahu & jangkar
  const boat = await place(stage, "perahu", 3.5, -5.5, { y: 7.2, rotY: 0.3 });
  const anchor = await place(stage, "jangkar", 1.2, -2.2);

  // ---------- state & panel aksi ----------
  const s = { trash: 0, racks: 0, zona: false, tambat: false, edukasi: false };
  const spent = () => s.trash * ACTIONS.sampah.cost + s.racks * ACTIONS.rak.cost + (s.zona ? ACTIONS.zona.cost : 0) + (s.tambat ? ACTIONS.tambat.cost : 0) + (s.edukasi ? ACTIONS.edukasi.cost : 0);
  const left = () => BUDGET - spent();
  let tool = null;
  let zoneRing = null, buoy = null, eduLabel = null;
  const racks = [];

  const bar = document.createElement("div");
  bar.className = "actions-bar";
  $("#hud-actions").appendChild(bar);

  function render() {
    ui.score(T("l4.budget", { l: left(), b: BUDGET }));
    bar.innerHTML = Object.entries(ACTIONS).map(([k, a]) => {
      const on = (k === "zona" && s.zona) || (k === "tambat" && s.tambat) || (k === "edukasi" && s.edukasi) || tool === k;
      const count = k === "sampah" ? ` (${s.trash}/${TRASH_COUNT})` : k === "rak" ? ` (${s.racks}/${SPOTS})` : "";
      return `<button class="act ${on ? "on" : ""}" data-k="${k}"><span class="ico">${a.icon}</span><span>${T("act." + k)}${count}</span><span class="cost">${T("act.pts", { c: a.cost })}</span></button>`;
    }).join("") + `<button class="act" data-k="reset"><span class="ico">↺</span>${T("act.reset")}<span class="cost">&nbsp;</span></button><button class="act run" data-k="run"><span class="ico">▶</span>${T("act.run")}<span class="cost">${T("act.years")}</span></button>`;
    bar.querySelectorAll(".act").forEach((b) => (b.onclick = () => onAction(b.dataset.k)));
    spots.forEach((m) => (m.visible = tool === "rak" && !m.userData.used));
  }

  async function onAction(k) {
    if (k === "run") return startSim();
    if (k === "reset") {
      const ok = await ui.dialog({ title: T("l4.reset.t"), html: T("l4.reset.b"), buttons: [{ label: T("btn.cancel"), value: false, cls: "ghost" }, { label: T("act.reset"), value: true, cls: "coral" }] });
      if (ok) run(stage, { mode }).then(resolveLevel);
      return;
    }
    if (k === "sampah" || k === "rak") {
      tool = tool === k ? null : k;
      ui.objective(tool ? T(`act.${k}.d`) : T("l4.pick"));
    } else {
      if (s[k]) { s[k] = false; undoToggle(k); audio.sfx("undo"); }
      else {
        if (left() < ACTIONS[k].cost) { audio.sfx("wrong"); return ui.toast(T("l4.nopts"), "bad"); }
        s[k] = true; audio.sfx("coin"); await doToggle(k);
      }
    }
    render();
  }

  async function doToggle(k) {
    if (k === "zona") {
      zoneRing = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const b = await place(stage, "pelampung", Math.cos(a) * 6.5, -1 + Math.sin(a) * 6.5, { size: 0.9, parent: zoneRing, rotY: 0 });
        b.scale.multiplyScalar(0.6);
      }
      stage.world.add(zoneRing);
      audio.sfx("splash");
      ui.toast(T("l4.t.zona"), "good", 2600);
    }
    if (k === "tambat") {
      buoy = await place(stage, "pelampung", 4.5, -4.5, { rotY: 0 });
      anchor.visible = false;
      stage.moveTo(boat, new THREE.Vector3(4.6, 7.2, -4.6), 1);
      audio.sfx("splash");
      ui.toast(T("l4.t.tambat"), "good", 2600);
    }
    if (k === "edukasi") {
      eduLabel = stage.addLabel(boat, T("l4.edu.label"), { offset: 2, className: "done" });
      ui.toast(T("l4.t.edukasi"), "good", 2600);
    }
  }
  function undoToggle(k) {
    if (k === "zona" && zoneRing) { zoneRing.removeFromParent(); zoneRing = null; }
    if (k === "tambat") { buoy?.removeFromParent(); anchor.visible = true; boat.position.set(3.5, 7.2, -5.5); }
    if (k === "edukasi" && eduLabel) { eduLabel.remove(); }
  }

  stage.interact({
    getTargets: () => (tool === "sampah" ? trash.filter((t) => t.visible) : tool === "rak" ? spots.filter((m) => m.visible) : []),
    onTap: async (m) => {
      if (tool === "sampah") {
        if (left() < ACTIONS.sampah.cost) { audio.sfx("wrong"); return ui.toast(T("l4.nopts"), "bad"); }
        s.trash++;
        const p0 = m.position.clone();
        audio.sfx("whoosh");
        stage.tween(0.8, (e) => { m.position.y = p0.y + e * 4; m.scale.setScalar(1 - e * 0.9); }).then(() => (m.visible = false));
        ui.toast(T("l4.t.trash"), "good", 1200);
      } else if (tool === "rak") {
        if (left() < ACTIONS.rak.cost) { audio.sfx("wrong"); return ui.toast(T("l4.nopts"), "bad"); }
        s.racks++;
        m.userData.used = true;
        const r = await place(stage, "rak_transplantasi", m.position.x, m.position.z, { rotY: Math.random() });
        r.scale.multiplyScalar(0.01);
        audio.sfx("clunk");
        stage.tween(0.5, (e) => r.scale.setScalar(Math.max(0.01, e)));
        racks.push(r);
        ui.toast(T("l4.t.rack"), "good", 1200);
      }
      render();
    },
  });

  let resolveLevel;
  const done = new Promise((r) => (resolveLevel = r));

  await ui.dialog({
    title: T("l4.intro.t"),
    html: `${T("l4.intro.b", { b: BUDGET })}<ul>${Object.entries(ACTIONS).map(([k, a]) => `<li>${a.icon} <b>${T("act." + k)}</b> (${T("act.pts", { c: a.cost })}): ${T(`act.${k}.d`)}</li>`).join("")}</ul>${T("l4.intro.run")}`,
    buttons: [{ label: T("btn.start"), value: true, cls: "primary" }],
  });
  render();

  // ---------- simulasi ----------
  async function startSim() {
    if (spent() === 0) {
      const go = await ui.dialog({ title: T("l4.none.t"), html: T("l4.none.b"), buttons: [{ label: T("l4.none.back"), value: false, cls: "ghost" }, { label: T("l4.none.run"), value: true, cls: "coral" }] });
      if (!go) return;
    }
    tool = null;
    bar.remove();
    spots.forEach((m) => (m.visible = false));
    stage.locked = true;
    audio.setMood("sim");
    ui.objective(T("l4.sim.obj"));
    stage.controls.autoRotate = true;
    stage.controls.autoRotateSpeed = 0.6;

    const years = simulate(s);
    const tl = document.createElement("div");
    tl.className = "timeline";
    tl.innerHTML = `<div class="row"><span id="tl-year">${T("tl.year", { y: 0 })}</span><span id="tl-cover">${T("tl.cover", { c: 8 })}</span></div>
      <div class="bar"><div class="fill" id="tl-fill"></div></div>
      <div class="event" id="tl-event">${T("tl.start")}</div>
      <div class="meter"><span>${T("tl.fish")}</span><b id="tl-fish">1</b><span>${T("tl.algae")}</span><b id="tl-algae">60%</b></div>`;
    document.body.appendChild(tl);

    // karang baru yang tumbuh: dibuat sekarang, diskalakan sesuai tutupan
    const growPts = [];
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 4.2;
      growPts.push([Math.cos(a) * r, -1 + Math.sin(a) * r]);
    }
    const newCorals = [];
    const kinds = ["karang_bercabang", "karang_otak", "karang_meja"];
    for (let i = 0; i < growPts.length; i++) {
      const c = await place(stage, kinds[i % 3], growPts[i][0], growPts[i][1], { size: 0.9 + Math.random() * 0.6 });
      c.scale.setScalar(0.001);
      newCorals.push(c);
    }
    const fishGroup = new THREE.Group();
    stage.world.add(fishGroup);
    const fishIds = ["ikan_kakatua", "ikan_baronang", "ikan_badut", "ikan_kerapu"];
    let fishN = 0;

    const setCover = (cover) => {
      const k = Math.min(cover / 25, 1);
      const nShow = Math.round(k * newCorals.length);
      newCorals.forEach((c, i) => c.scale.setScalar(i < nShow ? Math.max(0.15, Math.min(1, k * 1.2)) : 0.001));
      racks.forEach((r) => r.getObjectByName("fragments")?.scale.setScalar(1 + k * 1.8));
    };

    for (let i = 1; i < years.length; i++) {
      const prev = years[i - 1], y = years[i], ev = y.event;
      $("#tl-year").innerHTML = T("tl.year", { y: y.year });
      $("#tl-event").innerHTML = ev ? T(ev.k, ev.p) : T("tl.going");
      audio.sfx("year");
      if (ev?.k === "ev.bomb") { audio.sfx("bomb"); await shake(stage, 0.6, 0.7); ui.toast(T(ev.k), "bad", 3000); }
      if (ev?.k === "ev.anchor") { audio.sfx("clunk"); ui.toast(T(ev.k), "bad", 2400); }
      if (ev?.k === "ev.heat") {
        audio.sfx("heat");
        stage.scene.fog.color.set("#1d6b7d");
        await stage.tween(1, (e) => [...newCorals, ...racks].forEach((c) => tint(c, "#f4f1ea", e * 0.9)));
      }
      await stage.tween(1.6, (e) => {
        const cov = prev.cover + (y.cover - prev.cover) * e;
        setCover(cov);
        $("#tl-cover").innerHTML = T("tl.cover", { c: cov.toFixed(1) });
        $("#tl-fill").style.width = `${Math.min(100, (cov / 25) * 100)}%`;
        algae.forEach((a) => a.scale.setScalar(Math.max(0.2, (prev.algae + (y.algae - prev.algae) * e) / 60)));
      }, (t) => t);
      if (ev?.k === "ev.heat") {
        stage.scene.fog.color.set("#0a4d6e");
        await stage.tween(1, (e) => [...newCorals, ...racks].forEach((c) => tint(c, "#f4f1ea", 0.9 * (1 - e))));
      }
      while (fishN < y.fish) { await swimmer(stage, fishIds[fishN % 4], { r: 4, cz: -1, y: 1.6, speed: 0.5, parent: fishGroup }); fishN++; }
      $("#tl-fish").textContent = y.fish;
      $("#tl-algae").textContent = y.algae + "%";
      await stage.wait(0.6);
    }

    const score = scoreOf(years);
    const fb = feedback(s);
    const end = years[years.length - 1];
    await stage.wait(0.8);
    tl.remove();
    stage.controls.autoRotate = false;
    audio.setMood("play");
    audio.sfx("complete");
    const li = (arr, mark) => arr.map((f) => `<li>${mark} ${T(f.k, f.p)}</li>`).join("");
    const v = await ui.dialog({
      title: T("l4.res.t", { c: end.cover }),
      sound: null,
      html: `${ui.stars(score, 85, 60)}
        ${fb.good.length ? `<p><b>${T("l4.res.good")}</b></p><ul>${li(fb.good, "✅")}</ul>` : ""}
        ${fb.bad.length ? `<p><b>${T("l4.res.bad")}</b></p><ul>${li(fb.bad, "⚠️")}</ul>` : ""}
        <p>${T("l4.res.lesson")}</p>
        <p class="note">${T("l4.res.note", { s: score })}</p>`,
      buttons: [{ label: T("l4.res.again"), value: "again", cls: "ghost" }, { label: T("l4.res.done"), value: "done", cls: "primary" }],
    });
    if (v === "again") run(stage, { mode }).then(resolveLevel);
    else resolveLevel(score);
  }

  return done;
}
