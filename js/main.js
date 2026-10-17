// ============================================================
// Coral Quest — main.js
// Alur layar: judul → peta misi → level → rapor & ikrar aksi.
// ============================================================
import { Stage } from "./engine.js";
import { ui, progress } from "./ui.js";
import { T, getLang, setLang, onLang, initI18n } from "./i18n.js";
import { audio } from "./audio.js";
import { MODELS, usingReal } from "./models.js";
import { TEAM } from "./data.js";
import { reefDecor, swimmer } from "./levels/common.js";
import * as L1 from "./levels/l1.js";
import * as L2 from "./levels/l2.js";
import * as L3 from "./levels/l3.js";
import * as L4 from "./levels/l4.js";

const $ = (s) => document.querySelector(s);
initI18n();
const stage = new Stage($("#stage"));
window.__stage = stage; // untuk debugging

const LEVELS = {
  l1: { mod: L1, icon: "🐠" },
  l2: { mod: L2, icon: "🔗" },
  l3: { mod: L3, icon: "🩺" },
  l4: { mod: L4, icon: "🛠️" },
};
const PATHS = { class: ["l1", "l2", "l3", "l4"], quick: ["l1", "l3", "l4"] };

let mode = "quick";
const scoreKey = (id) => `${mode}:${id}`;

function show(screen) {
  for (const s of ["title", "map", "result"]) $(`#screen-${s}`).hidden = s !== screen;
}

// ---------- latar menu: terumbu yang berputar pelan ----------
async function menuBackdrop() {
  stage.clear();
  ui.hideHud();
  ui.hideCard();
  audio.setMood("menu");
  stage.camera.position.set(0, 5, 13);
  stage.controls.target.set(0, 1.2, 0);
  stage.controls.autoRotate = true;
  stage.controls.autoRotateSpeed = 0.4;
  await reefDecor(stage, 0, 0, { radius: 5, corals: 12, rocks: 4, weeds: 5 });
  for (const id of ["ikan_kakatua", "ikan_baronang", "ikan_badut", "ikan_kerapu", "ikan_kakatua", "ikan_baronang"]) await swimmer(stage, id, { r: 4, y: 1.8, speed: 0.5 });
  await swimmer(stage, "penyu_hijau", { r: 6, y: 3, speed: 0.35 });
}

// ---------- peta misi ----------
function renderMap() {
  const scores = progress.load().scores || {};
  const path = PATHS[mode];
  const list = $("#level-list");
  list.innerHTML = "";
  path.forEach((id, i) => {
    const prevDone = i === 0 || scores[scoreKey(path[i - 1])] != null;
    const s = scores[scoreKey(id)];
    const b = document.createElement("button");
    b.className = "lvl";
    b.disabled = !prevDone;
    b.innerHTML = `<div class="lvl-num">${prevDone ? LEVELS[id].icon : "🔒"}</div>
      <div><div class="lvl-name">${T("map.mission", { n: i + 1 })} · ${T(`lvl.${id}.name`)}</div><div class="lvl-desc">${T(`lvl.${id}.desc`)}</div></div>
      <div class="lvl-score">${s != null ? s + " / 100" : prevDone ? T("map.play") : ""}</div>`;
    b.onclick = () => startLevel(id);
    list.appendChild(b);
  });
  $("#btn-finish").hidden = !path.every((id) => scores[scoreKey(id)] != null);
}

async function startLevel(id) {
  show(null);
  stage.controls.autoRotate = false;
  audio.sfx("whoosh");
  const score = await LEVELS[id].mod.run(stage, { mode });
  progress.setScore(scoreKey(id), score);
  await menuBackdrop();
  renderMap();
  show("map");
}

// ---------- rapor & ikrar ----------
function renderResult() {
  const scores = progress.load().scores || {};
  const path = PATHS[mode];
  const vals = path.map((id) => scores[scoreKey(id)] || 0);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const title = avg >= 85 ? "res.t.expert" : avg >= 65 ? "res.t.mid" : "res.t.new";
  audio.sfx("complete");
  $("#result-body").innerHTML = `
    <div class="badge">${T(mode === "class" ? "res.badge.class" : "res.badge.quick")}</div>
    <h2>${T(title)}</h2>
    <p class="sub">${T("res.avg", { s: avg })}</p>
    <div class="score-grid">${path.map((id, i) => `<div class="score-row"><span>${LEVELS[id].icon} ${T("map.mission", { n: i + 1 })} · ${T(`lvl.${id}.name`)}</span><span>${scores[scoreKey(id)]}</span></div>`).join("")}</div>
    <h3>${T("res.pledge.t")}</h3>
    <p class="sub">${T("res.pledge.sub")}</p>
    <div class="pledge">
      ${[1, 2, 3, 4, 5].map((n) => `<label><input type="checkbox" id="pledge-${n}" /> <span>${T("pledge." + n)}</span></label>`).join("")}
    </div>
    <div class="panel-actions" style="justify-content:flex-start">
      <button class="btn primary" id="btn-pledge">${T("res.save")}</button>
      <button class="btn ghost" id="btn-again">${T("res.again")}</button>
    </div>`;
  document.querySelectorAll(".pledge input").forEach((c) => (c.onchange = () => audio.sfx(c.checked ? "pop" : "undo")));
  $("#btn-pledge").onclick = () => {
    const n = [...document.querySelectorAll(".pledge input")].filter((c) => c.checked).length;
    if (!n) { audio.sfx("wrong"); return ui.toast(T("res.none"), "bad"); }
    const p = progress.load(); p.pledges = (p.pledges || 0) + n; progress.save(p);
    audio.sfx("found");
    ui.toast(T("res.thanks", { n }), "good", 3000);
  };
  $("#btn-again").onclick = () => show("title");
}

// ---------- tentang ----------
function about() {
  ui.dialog({
    title: T("about.title"),
    cls: "about",
    html: `<p>${T("about.intro")}</p>
      <h3>${T("about.reef.t")}</h3>${T("about.reef")}
      <h3>${T("about.team.t")}</h3>
      <div class="team">${TEAM.map((m) => `<div class="member"><div class="avatar">${m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div><div><div class="m-name">${m.name}</div><div class="m-meta">${m.nim} · ${T(m.leader ? "about.leader" : "about.member")}</div></div></div>`).join("")}</div>
      <p class="note">${T("about.models", { n: usingReal.size, t: Object.keys(MODELS).length })}</p>`,
    buttons: [{ label: T("btn.close"), value: true, cls: "primary" }],
  });
}

// ---------- bahasa & suara ----------
function syncLangUI() {
  const l = getLang();
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === l)));
  $("#sys-lang .code").textContent = l === "en" ? "EN" : "ID";
}
function syncAudioUI() {
  $("#sys-music").classList.toggle("off", !audio.settings.music);
  $("#sys-sfx").classList.toggle("off", !audio.settings.sfx);
}
function changeLang(l) {
  if (l === getLang()) return;
  audio.sfx("lang");
  setLang(l);
}
onLang(syncLangUI);
audio.onChange(syncAudioUI);
document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => changeLang(b.dataset.lang)));
$("#sys-lang").onclick = () => changeLang(getLang() === "en" ? "id" : "en");
$("#sys-music").onclick = () => { audio.unlock(); audio.toggle("music"); };
$("#sys-sfx").onclick = () => { audio.unlock(); audio.toggle("sfx"); };
syncLangUI();
syncAudioUI();

// ---------- event ----------
document.querySelectorAll(".mode").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; renderMap(); show("map"); }));
document.querySelectorAll("[data-go=title]").forEach((b) => (b.onclick = () => show("title")));
$("#btn-about").onclick = about;
$("#btn-finish").onclick = () => { renderResult(); show("result"); };
$("#btn-home").onclick = async () => {
  const ok = await ui.dialog({ title: T("exit.title"), html: `<p>${T("exit.body")}</p>`, buttons: [{ label: T("exit.stay"), value: false, cls: "ghost" }, { label: T("exit.leave"), value: true, cls: "coral" }] });
  if (ok) location.reload();
};

// ---------- mulai ----------
(async () => {
  await menuBackdrop();
  $("#loading").classList.add("hide");
  show("title");
  // izinkan membuka level langsung lewat URL, mis. ?level=l3&mode=class (untuk demo)
  const q = new URLSearchParams(location.search);
  if (q.get("mode")) mode = q.get("mode");
  if (q.get("lang")) setLang(q.get("lang"), { animate: false });
  if (q.get("level") && LEVELS[q.get("level")]) startLevel(q.get("level"));
})();

// offline (PWA)
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
