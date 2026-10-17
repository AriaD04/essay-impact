// ============================================================
// Model simulasi sederhana untuk Misi Restorasi (5 tahun).
// Sengaja dibuat sederhana dan transparan agar bisa dijelaskan di kelas.
// Angka bersifat ilustratif, bukan prediksi ilmiah.
// ============================================================

export const ACTIONS = {
  sampah:  { icon: "🧹", cost: 1 },
  rak:     { icon: "🪸", cost: 3 },
  zona:    { icon: "🚫", cost: 3 },
  tambat:  { icon: "⚓", cost: 2 },
  edukasi: { icon: "📢", cost: 2 },
};
export const BUDGET = 12;
export const TRASH_COUNT = 5;
export const SPOTS = 4;

/**
 * state: { trash: jumlah sampah diangkat, racks: jumlah rak, zona, tambat, edukasi (boolean) }
 * return: array per tahun { year, cover, fish, algae, event }
 */
export function simulate(s) {
  const tr = s.trash / TRASH_COUNT;
  let cover = 8;
  let algae = 60;
  const years = [{ year: 0, cover, fish: 1, algae, event: null }];
  for (let y = 1; y <= 5; y++) {
    let event = null;
    // alga: ditekan oleh ikan herbivora yang dilindungi
    algae += s.zona ? -14 : 4;
    algae = Math.min(80, Math.max(10, algae));
    let growth = 2 + 3.2 * s.racks;
    growth *= 1 - (algae / 100) * 0.6;   // alga menutupi karang
    growth *= 1 - (1 - tr) * 0.35;       // sampah & polusi
    cover += growth;
    if (!s.tambat) { cover -= 1.5; if (y === 1) event = { k: "ev.anchor" }; }
    if (y === 2 && !s.edukasi) { cover *= 0.6; event = { k: "ev.bomb" }; }
    if (y === 3) {
      const resilience = 0.3 * (s.zona ? 1 : 0) + 0.25 * tr + 0.15 * (s.tambat ? 1 : 0) + 0.1 * (s.edukasi ? 1 : 0) + 0.2 * Math.min(s.racks / 2, 1);
      const loss = 0.4 * (1 - resilience);
      cover *= 1 - loss;
      event = { k: "ev.heat", p: { p: Math.round(loss * 100) } };
    }
    cover = Math.max(2, Math.min(60, cover));
    const fish = Math.round(1 + (s.zona ? 5 : 1) + cover / 6);
    years.push({ year: y, cover: Math.round(cover * 10) / 10, fish, algae: Math.round(algae), event });
  }
  return years;
}

export function scoreOf(years) {
  const end = years[years.length - 1];
  return Math.max(0, Math.min(100, Math.round((end.cover / 25) * 100)));
}

/** Umpan balik: daftar kunci terjemahan (dan parameternya) */
export function feedback(s) {
  const good = [], bad = [];
  (s.zona ? good : bad).push({ k: s.zona ? "fb.zona.g" : "fb.zona.b" });
  (s.racks > 0 ? good : bad).push({ k: s.racks > 0 ? "fb.rak.g" : "fb.rak.b", p: { n: s.racks } });
  (s.edukasi ? good : bad).push({ k: s.edukasi ? "fb.edu.g" : "fb.edu.b" });
  (s.tambat ? good : bad).push({ k: s.tambat ? "fb.tambat.g" : "fb.tambat.b" });
  if (s.trash >= TRASH_COUNT) good.push({ k: "fb.trash.all" });
  else if (s.trash > 0) good.push({ k: "fb.trash.some", p: { n: s.trash, r: TRASH_COUNT - s.trash } });
  else bad.push({ k: "fb.trash.none" });
  return { good, bad };
}
