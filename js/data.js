// ============================================================
// Coral Quest — data.js
// Data materi. Semua teks (nama, fakta, peran) ada di i18n.js
// agar bisa tampil dalam bahasa Inggris dan Indonesia.
// ============================================================

export const ROLES = {
  pembangun: { color: "#ff8fb1", icon: "🪸" },
  produsen:  { color: "#7ee08a", icon: "🌿" },
  herbivora: { color: "#ffd166", icon: "🐟" },
  predator:  { color: "#6ec6ff", icon: "🦈" },
};

// id model → peran
export const ORGANISMS = {
  karang_bercabang: "pembangun",
  karang_otak: "pembangun",
  rumput_laut: "produsen",
  fitoplankton: "produsen",
  ikan_kakatua: "herbivora",
  ikan_baronang: "herbivora",
  bulu_babi: "herbivora",
  penyu_hijau: "herbivora",
  ikan_kerapu: "predator",
  hiu_sirip_hitam: "predator",
};

export const FOOD_CHAIN = [
  { id: "rumput_laut", tier: 0 },
  { id: "ikan_baronang", tier: 1 },
  { id: "ikan_kerapu", tier: 2 },
  { id: "hiu_sirip_hitam", tier: 3 },
];

export const TEAM = [
  { name: "ARIA DIMAS MASTUR", nim: "2201020107", leader: true },
  { name: "YOHANI NATALIA S", nim: "2201020091" },
  { name: "GRAYESI SILITONGA", nim: "2201020130" },
];
