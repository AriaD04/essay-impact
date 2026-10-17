// ============================================================
// Coral Quest — audio.js
// Musik latar (soundtrack) dan efek suara dibuat langsung dengan
// Web Audio API, jadi tidak perlu file musik dan tetap jalan offline.
//
// Ingin memakai lagu sendiri? Taruh file di folder /audio:
//   audio/menu.mp3  (menu)   audio/play.mp3 (saat misi)   audio/sim.mp3 (simulasi)
// Jika file ada, game memutarnya sebagai pengganti musik buatan kode.
// Pastikan lagunya bebas royalti / berlisensi untuk dipakai.
// ============================================================

const STORE = "coral-quest-audio";
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Progresi akor (nada MIDI). D mayor pentatonik terasa cerah dan "tropis".
const MOODS = {
  menu: {
    bpm: 72,
    chords: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]], // Dmaj, Bm, G, A
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81],
    density: 0.35, shaker: false, bell: false, pad: 0.05,
  },
  play: {
    bpm: 100,
    chords: [[50, 57, 62, 66], [43, 55, 59, 62], [47, 54, 59, 62], [45, 57, 61, 64]], // D, G, Bm, A
    scale: [62, 64, 66, 69, 71, 74, 76, 78],
    density: 0.7, shaker: true, bell: false, pad: 0.035,
  },
  sim: {
    bpm: 84,
    chords: [[47, 54, 59, 62], [43, 50, 55, 59], [50, 57, 62, 66], [45, 52, 57, 61]], // Bm, G, D, A
    scale: [59, 62, 64, 66, 69, 71, 74],
    density: 0.45, shaker: false, bell: true, pad: 0.05,
  },
};

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

class AudioSys {
  constructor() {
    this.ctx = null;
    this.mood = "menu";
    this.settings = { music: true, sfx: true };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(STORE)) || {}); } catch {}
    this.step = 0;
    this.files = {};
    this.listeners = new Set();
    const unlock = () => this.unlock();
    ["pointerdown", "keydown", "touchstart"].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      document.hidden ? this.ctx.suspend() : this.ctx.resume();
    });
    // bunyi klik untuk semua tombol
    document.addEventListener("click", (e) => { if (e.target.closest("button")) this.sfx("click"); }, true);
  }

  onChange(fn) { this.listeners.add(fn); }
  _save() { try { localStorage.setItem(STORE, JSON.stringify(this.settings)); } catch {} this.listeners.forEach((f) => f(this.settings)); }

  unlock() {
    if (this.ctx) { if (this.ctx.state !== "running") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.settings.music ? 0.5 : 0; this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.settings.sfx ? 0.7 : 0; this.sfxBus.connect(this.master);
    // gema ringan agar terasa "di bawah air"
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(2.4);
    const vg = c.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
    this.noise = this._noiseBuffer();
    this._ambience();
    this._checkFiles();
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 50);
  }

  // ---------- pengaturan ----------
  toggle(kind) {
    this.settings[kind] = !this.settings[kind];
    if (this.ctx) {
      const bus = kind === "music" ? this.musicBus : this.sfxBus;
      bus.gain.setTargetAtTime(this.settings[kind] ? (kind === "music" ? 0.5 : 0.7) : 0, this.ctx.currentTime, 0.1);
      if (kind === "music") this._syncFile();
    }
    this._save();
    return this.settings[kind];
  }

  setMood(m) {
    if (!MOODS[m] || m === this.mood) return;
    this.mood = m;
    this.phrase = null;
    this._syncFile();
  }

  // ---------- file musik pengganti (opsional) ----------
  async _checkFiles() {
    for (const m of Object.keys(MOODS)) {
      try {
        const r = await fetch(`audio/${m}.mp3`, { method: "HEAD" });
        if (r.ok) {
          const el = new Audio(`audio/${m}.mp3`);
          el.loop = true; el.crossOrigin = "anonymous";
          const src = this.ctx.createMediaElementSource(el);
          const g = this.ctx.createGain(); g.gain.value = 0;
          src.connect(g); g.connect(this.musicBus);
          this.files[m] = { el, g };
        }
      } catch {}
    }
    this._syncFile();
  }
  _syncFile() {
    if (!this.ctx) return;
    for (const [m, f] of Object.entries(this.files)) {
      const on = m === this.mood && this.settings.music;
      f.g.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.6);
      if (on) f.el.play().catch(() => {});
      else setTimeout(() => { if (this.mood !== m || !this.settings.music) f.el.pause(); }, 2500);
    }
  }

  // ---------- pembuat bunyi dasar ----------
  _noiseBuffer() {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _impulse(sec) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }
  _env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  _tone({ type = "sine", f, f2, t, a = 0.005, dec = 0.3, vol = 0.3, bus, verb = 0, detune = 0 }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    this._env(g, t, a, vol, dec);
    o.connect(g); g.connect(bus);
    if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    o.start(t); o.stop(t + a + dec + 0.05);
  }
  _noise({ t, dur = 0.3, vol = 0.2, type = "bandpass", f = 1000, f2, q = 1, bus, a = 0.01 }) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this._env(g, t, a, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + a + 0.05);
  }

  // ---------- suasana bawah laut ----------
  _ambience() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
    const g = c.createGain(); g.gain.value = 0.12;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(lp); lp.connect(g); g.connect(this.musicBus); s.start();
    const bubbles = () => {
      if (this.settings.music && this.ctx.state === "running") {
        const t = c.currentTime, n = 1 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this._tone({ f: 300 + Math.random() * 400, f2: 900 + Math.random() * 900, t: t + i * 0.07, a: 0.004, dec: 0.06, vol: 0.03, bus: this.musicBus, verb: 0.4 });
      }
      setTimeout(bubbles, 1500 + Math.random() * 4000);
    };
    setTimeout(bubbles, 2000);
  }

  // ---------- soundtrack generatif ----------
  _makePhrase(M) {
    const r = rng(this.mood.length * 7919 + 13);
    const notes = [];
    let idx = Math.floor(M.scale.length / 2);
    for (let i = 0; i < 64; i++) {
      if (r() < M.density) {
        idx = Math.max(0, Math.min(M.scale.length - 1, idx + Math.round((r() - 0.5) * 4)));
        notes.push(M.scale[idx]);
      } else notes.push(null);
    }
    return notes;
  }
  _schedule() {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    if (this.files[this.mood]) { this.nextTime = c.currentTime + 0.1; return; }
    const M = MOODS[this.mood];
    if (!this.phrase) this.phrase = this._makePhrase(M);
    const stepDur = 60 / M.bpm / 2; // satu langkah = not 1/8
    while (this.nextTime < c.currentTime + 0.25) {
      const t = this.nextTime, s = this.step % 64, bar = Math.floor(s / 8) % 4, beat = s % 8;
      const ch = M.chords[bar];
      if (this.settings.music) {
        if (beat === 0) {
          // pad akor lembut
          ch.slice(1).forEach((n) => {
            [-6, 6].forEach((d) => this._tone({ type: "sawtooth", f: midi(n), t, a: 0.8, dec: stepDur * 8, vol: M.pad, bus: this._padFilter(), detune: d }));
          });
          this._tone({ type: "triangle", f: midi(ch[0] - 12), t, a: 0.01, dec: 0.9, vol: 0.22, bus: this.musicBus });
        }
        if (this.mood === "play" && beat === 4) this._tone({ type: "triangle", f: midi(ch[0] - 12), t, a: 0.01, dec: 0.5, vol: 0.16, bus: this.musicBus });
        if (this.mood === "sim" && beat % 2 === 0) this._tone({ type: "sine", f: midi(ch[0] - 12), t, a: 0.01, dec: 0.25, vol: beat === 0 ? 0.2 : 0.09, bus: this.musicBus });
        const n = this.phrase[s];
        if (n) {
          // marimba: nada dasar + harmonik
          this._tone({ f: midi(n), t, a: 0.004, dec: M.bell ? 1.2 : 0.45, vol: 0.13, bus: this.musicBus, verb: 0.5 });
          this._tone({ f: midi(n) * (M.bell ? 2.76 : 4), t, a: 0.002, dec: M.bell ? 0.6 : 0.12, vol: 0.025, bus: this.musicBus });
        }
        if (M.shaker && beat % 2 === 1) this._noise({ t, dur: 0.05, vol: 0.035, type: "highpass", f: 7000, bus: this.musicBus, a: 0.003 });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
  _padFilter() {
    if (!this.pf) {
      this.pf = this.ctx.createBiquadFilter(); this.pf.type = "lowpass"; this.pf.frequency.value = 900; this.pf.Q.value = 0.5;
      this.pf.connect(this.musicBus);
      const s = this.ctx.createGain(); s.gain.value = 0.6; this.pf.connect(s); s.connect(this.verb);
    }
    return this.pf;
  }

  // ---------- efek suara ----------
  sfx(name) {
    const c = this.ctx;
    if (!c || !this.settings.sfx || c.state !== "running") return;
    const t = c.currentTime + 0.01, B = this.sfxBus;
    const seq = (notes, gap, opt = {}) => notes.forEach((n, i) => this._tone({ f: midi(n), t: t + i * gap, a: 0.005, dec: 0.35, vol: 0.22, bus: B, verb: 0.3, ...opt }));
    switch (name) {
      case "click": this._tone({ f: 900, f2: 600, t, a: 0.002, dec: 0.05, vol: 0.12, bus: B }); break;
      case "pick": this._tone({ f: 420, f2: 900, t, a: 0.005, dec: 0.1, vol: 0.18, bus: B }); break;
      case "drop": this._tone({ type: "triangle", f: 320, f2: 120, t, a: 0.003, dec: 0.16, vol: 0.25, bus: B }); this._noise({ t, dur: 0.08, vol: 0.06, f: 800, bus: B }); break;
      case "pop": this._tone({ f: 300, f2: 1300, t, a: 0.003, dec: 0.07, vol: 0.18, bus: B, verb: 0.3 }); break;
      case "correct": seq([74, 81, 86], 0.09, { type: "sine" }); this._tone({ f: midi(98), t: t + 0.2, dec: 0.5, vol: 0.05, bus: B, verb: 0.5 }); break;
      case "wrong": [0, 0.14].forEach((d) => this._tone({ type: "square", f: 220, f2: 150, t: t + d, a: 0.005, dec: 0.12, vol: 0.07, bus: B })); break;
      case "found": seq([74, 78, 81, 86, 90], 0.06, { dec: 0.4, vol: 0.16 }); break;
      case "complete": seq([62, 66, 69, 74], 0.12, { type: "triangle", dec: 0.5, vol: 0.2 }); [74, 78, 81].forEach((n) => this._tone({ type: "triangle", f: midi(n), t: t + 0.55, a: 0.01, dec: 1.4, vol: 0.12, bus: B, verb: 0.5 })); break;
      case "star": this._tone({ f: midi(93), t, a: 0.003, dec: 0.8, vol: 0.12, bus: B, verb: 0.6 }); this._tone({ f: midi(93) * 2.76, t, a: 0.002, dec: 0.3, vol: 0.03, bus: B }); break;
      case "tick": this._tone({ f: 1200, t, a: 0.001, dec: 0.03, vol: 0.08, bus: B }); break;
      case "tickUrgent": this._tone({ f: 1600, t, a: 0.001, dec: 0.05, vol: 0.14, bus: B }); break;
      case "timeup": seq([69, 65, 62], 0.16, { type: "triangle", vol: 0.18 }); break;
      case "bomb":
        this._noise({ t, dur: 1.4, vol: 0.6, type: "lowpass", f: 2500, f2: 80, q: 0.7, bus: B, a: 0.005 });
        this._tone({ f: 90, f2: 30, t, a: 0.005, dec: 1, vol: 0.6, bus: B });
        break;
      case "heat":
        this._noise({ t, dur: 2.2, vol: 0.18, type: "bandpass", f: 200, f2: 1800, q: 2, bus: B, a: 0.6 });
        this._tone({ type: "sawtooth", f: 55, f2: 70, t, a: 0.6, dec: 2, vol: 0.06, bus: B });
        break;
      case "coin": this._tone({ type: "square", f: 988, t, a: 0.002, dec: 0.06, vol: 0.06, bus: B }); this._tone({ type: "square", f: 1319, t: t + 0.06, a: 0.002, dec: 0.18, vol: 0.06, bus: B }); break;
      case "undo": this._tone({ f: 700, f2: 300, t, a: 0.004, dec: 0.12, vol: 0.14, bus: B }); break;
      case "whoosh": this._noise({ t, dur: 0.5, vol: 0.2, f: 300, f2: 2500, q: 1.5, bus: B, a: 0.05 }); break;
      case "clunk": this._tone({ type: "triangle", f: 160, f2: 90, t, a: 0.002, dec: 0.2, vol: 0.3, bus: B }); this._noise({ t, dur: 0.1, vol: 0.1, f: 2000, bus: B }); break;
      case "year": this._tone({ f: midi(86), t, a: 0.004, dec: 0.6, vol: 0.09, bus: B, verb: 0.5 }); break;
      case "lang": this._noise({ t, dur: 0.45, vol: 0.12, f: 600, f2: 4000, q: 1, bus: B, a: 0.08 }); seq([81, 86], 0.1, { vol: 0.1, dec: 0.4 }); break;
      case "splash": this._noise({ t, dur: 0.6, vol: 0.25, type: "lowpass", f: 3000, f2: 300, bus: B }); break;
    }
  }
}

export const audio = new AudioSys();
