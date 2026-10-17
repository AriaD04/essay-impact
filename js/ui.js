// ============================================================
// Coral Quest — ui.js
// Elemen antarmuka HTML: HUD, kartu fakta, dialog, kuis, toast,
// dan penyimpanan progres. Semua teks memakai T() dari i18n.js
// supaya ikut berganti saat bahasa diubah.
// ============================================================
import { T } from "./i18n.js";
import { ROLES, ORGANISMS } from "./data.js";
import { audio } from "./audio.js";

const $ = (s) => document.querySelector(s);

export const ui = {
  /** title & objective berupa HTML dari T() */
  hud(title, objective) {
    $("#hud").hidden = false;
    $("#hud-actions").innerHTML = "";
    this.score(null); this.timer(null); this.hideCard();
    $("#hud-title").innerHTML = title;
    $("#hud-obj").innerHTML = objective || "";
  },
  objective(html) { $("#hud-obj").innerHTML = html; },
  score(html) { const el = $("#hud-score"); el.hidden = !html; el.innerHTML = html || ""; },
  timer(sec) {
    const el = $("#hud-timer");
    if (sec == null) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = T("hud.time", { s: sec });
    el.classList.toggle("urgent", sec <= 5);
  },
  hideHud() { $("#hud").hidden = true; this.score(null); this.timer(null); $("#hud-actions").innerHTML = ""; },

  toast(html, kind = "info", ms = 2200) {
    const el = document.createElement("div");
    el.className = "toast " + kind; el.innerHTML = html;
    $("#toasts").appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, ms);
  },

  /** Panel modal. buttons: [{label(html), value, cls}] → Promise<value> */
  dialog({ title, html, buttons, cls = "", sound = "pop" }) {
    buttons ||= [{ label: T("btn.next"), value: true, cls: "primary" }];
    if (sound) audio.sfx(sound);
    return new Promise((resolve) => {
      const wrap = $("#modal");
      wrap.innerHTML = `<div class="panel ${cls}">${title ? `<h2>${title}</h2>` : ""}<div class="panel-body">${html || ""}</div><div class="panel-actions"></div></div>`;
      const act = wrap.querySelector(".panel-actions");
      buttons.forEach((b) => {
        const el = document.createElement("button");
        el.className = "btn " + (b.cls || ""); el.innerHTML = b.label;
        el.onclick = () => { wrap.hidden = true; wrap.innerHTML = ""; resolve(b.value); };
        act.appendChild(el);
      });
      wrap.hidden = false;
      act.querySelector("button")?.focus();
    });
  },

  /**
   * Kuis pilihan ganda. Semua argumen berupa kunci terjemahan.
   * Mengembalikan true bila benar pada percobaan pertama.
   */
  quiz({ q, options, correct, explain }) {
    audio.sfx("pop");
    return new Promise((resolve) => {
      const wrap = $("#modal");
      const order = options.map((o, i) => i).sort(() => Math.random() - 0.5);
      wrap.innerHTML = `<div class="panel quiz"><h2>${T(q)}</h2><div class="choices">${order.map((i) => `<button class="choice" data-i="${i}">${T(options[i])}</button>`).join("")}</div><div class="explain" hidden></div><div class="panel-actions" hidden><button class="btn primary">${T("btn.next")}</button></div></div>`;
      wrap.hidden = false;
      let first = true, ok = false;
      wrap.querySelectorAll(".choice").forEach((b) => (b.onclick = () => {
        const i = +b.dataset.i;
        if (i === correct) {
          ok = first; b.classList.add("right");
          audio.sfx("correct");
          wrap.querySelectorAll(".choice").forEach((c) => (c.disabled = true));
          const ex = wrap.querySelector(".explain");
          ex.hidden = false; ex.innerHTML = `<b>${T(first ? "quiz.first" : "quiz.later")}</b> ${T(explain)}`;
          wrap.querySelector(".panel-actions").hidden = false;
        } else { first = false; b.classList.add("wrong"); b.disabled = true; audio.sfx("wrong"); }
      }));
      wrap.querySelector(".panel-actions button").onclick = () => { wrap.hidden = true; wrap.innerHTML = ""; resolve(ok); };
    });
  },

  /** Kartu fakta makhluk. showRole=false → peran disembunyikan (belum ditebak) */
  factCard(id, showRole) {
    const role = ORGANISMS[id];
    const R = ROLES[role];
    const el = $("#card");
    el.innerHTML = `<button class="close" aria-label="Close">✕</button>
      <div class="card-role" style="--c:${showRole ? R.color : "#9bd"}">${showRole ? R.icon + " " + T(`role.${role}.name`) : T("card.guess")}</div>
      <h3>${T(`org.${id}.name`)}</h3><div class="sci">${T(`org.${id}.sci`)}</div>
      <p>${T(`org.${id}.fact`)}</p><p class="tip">💡 ${T(`org.${id}.tip`)}</p>`;
    el.hidden = false;
    el.querySelector(".close").onclick = () => (el.hidden = true);
  },
  hideCard() { $("#card").hidden = true; },

  stars(score, hi = 90, mid = 70) {
    const n = score >= hi ? 3 : score >= mid ? 2 : 1;
    [0, 1, 2].slice(0, n).forEach((i) => setTimeout(() => audio.sfx("star"), 350 + i * 220));
    return `<div class="big">${"⭐".repeat(n)}</div>`;
  },
};

// ---------- progres (disimpan di browser) ----------
const KEY = "coral-quest-v1";
export const progress = {
  load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
  save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} },
  setScore(level, score) {
    const p = this.load();
    p.scores ||= {};
    p.scores[level] = Math.max(p.scores[level] || 0, score);
    this.save(p);
  },
};
