# Coral Quest

Game edukasi 3D interaktif berbasis web tentang terumbu karang untuk pelajar dan
masyarakat Kepulauan Riau. Prototipe untuk esai IMPACT 2026 (Subtema 2: Digital
Innovation in Maritime Education).

Dibuat oleh **Kelompok Coral Quest**:
ARIA DIMAS MASTUR (2201020107, Ketua), YOHANI NATALIA S (2201020091),
GRAYESI SILITONGA (2201020130).

## Isi game

| Misi | Mekanik | Mode Cepat | Mode Kelas |
|---|---|---|---|
| 1. Kenali Penghuni Karang | Seret makhluk ke platform perannya, ketuk untuk kartu fakta | 4 makhluk | 10 makhluk |
| 2. Jaring Makanan Terumbu | Susun rantai makanan dengan timer, lihat aliran energi, kuis "Bagaimana jika" | — | ✔ |
| 3. Cek Kesehatan Karang | Bandingkan terumbu sehat, memutih, rusak; cari penyebab kerusakan | 3 penyebab | 5 penyebab + kuis |
| 4. Misi Restorasi | 12 poin aksi untuk memulihkan terumbu, lalu simulasi 5 tahun | ✔ | ✔ |

Setelah semua misi selesai, pemain melihat rapor nilai dan memilih ikrar aksi nyata.
Nilai tersimpan di browser masing-masing.

## Bahasa

Bahasa default adalah **English**. Pemain bisa memilih Bahasa Indonesia di layar judul
(di bawah Mode Cepat dan Mode Kelas) atau menekan tombol 🌐 di kanan atas kapan saja,
termasuk di tengah misi. Semua teks ada di `js/i18n.js` (bagian `en` dan `id`).

## Musik & efek suara

Soundtrack (menu, misi, simulasi), suasana bawah laut, dan semua efek suara dibuat
langsung oleh kode (`js/audio.js`), jadi tidak butuh file dan tetap jalan offline.
Tombol 🎵 dan 🔊 di kanan atas untuk mematikan musik atau efek suara.

Ingin memakai lagu sendiri? Buat folder `audio/` lalu taruh `menu.mp3`, `play.mp3`,
dan/atau `sim.mp3`. Game otomatis memutarnya sebagai pengganti musik buatan kode.
Gunakan hanya lagu bebas royalti atau yang izinnya jelas.

## Menjalankan di komputer

Game memakai modul JavaScript, jadi **tidak bisa dibuka dengan klik dua kali** pada
`index.html`. Jalankan server lokal dari folder ini:

```bash
python -m http.server 8000
```

Lalu buka <http://localhost:8000>. Alternatif: ekstensi **Live Server** di VS Code.

Untuk demo, level bisa dibuka langsung:
`http://localhost:8000/?mode=class&level=l3` (pilihan level: `l1`–`l4`, mode: `class` atau `quick`).

## Online untuk HP (GitHub Pages, gratis)

1. Unggah seluruh isi folder ini ke repositori GitHub.
2. Buka **Settings → Pages**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
3. Setelah 1–2 menit, game bisa dibuka di `https://<username>.github.io/<nama-repo>/`.
4. Buat kode QR dari tautan itu untuk dipasang di kelas atau ruang publik.

Setelah dibuka sekali lewat HTTPS, game tersimpan di HP dan **bisa dimainkan offline**.
Di Android/Chrome, pilih "Tambahkan ke layar utama" agar tampil seperti aplikasi.
Setiap kali mengubah file game, naikkan `VERSION` di `sw.js` (mis. `tq-v2`) agar HP
mengambil versi terbaru.

## Menambahkan model 3D asli

Lihat `models/README.md`: daftar nama file, kata kunci pencarian Sketchfab/Meshy,
dan aturan lisensi. Cukup taruh file `.glb` dengan nama yang sesuai.

## Struktur

```
index.html            halaman utama
css/style.css         tampilan
js/main.js            alur layar dan mode
js/engine.js          panggung 3D bawah laut, kamera, seret & ketuk
js/models.js          daftar model + model sementara buatan kode
js/data.js            peran makhluk, rantai makanan, anggota tim
js/i18n.js            semua teks dalam English & Bahasa Indonesia
js/audio.js           musik dan efek suara
js/ui.js              HUD, kartu fakta, dialog, kuis, penyimpanan nilai
js/levels/            misi 1–4 dan model simulasi restorasi (sim.js)
js/vendor/            three.js r170 (disimpan lokal agar bisa offline)
models/               file .glb asli (isi sendiri)
sw.js, manifest       dukungan offline / pasang di layar utama
```

## Mengubah materi

Semua teks (fakta makhluk, kuis, dialog) ada di `js/i18n.js`. Ubah kedua bahasa
sekaligus agar tetap sama isinya. Angka simulasi restorasi ada di
`js/levels/sim.js` dan sengaja dibuat sederhana untuk pembelajaran, bukan prediksi ilmiah.

## Rencana berikutnya

- Modul mangrove dan padang lamun memakai mesin yang sama.
- Mengganti model sementara dengan model 3D asli (lihat `models/README.md`).
