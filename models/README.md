# Folder model 3D

Taruh file `.glb` di folder ini dengan **nama persis** seperti tabel di bawah.
Game akan otomatis memakai file itu. Kalau file belum ada, game memakai model
sementara buatan kode, jadi tidak ada yang rusak.

Game otomatis mengatur ukuran dan posisi model. Kamu tidak perlu mengubah skala di Blender.

## Daftar model

Kolom "Kata kunci" bisa langsung ditempel di kolom pencarian Sketchfab
(centang filter **Downloadable**) atau dipakai sebagai prompt di Meshy AI.

| Prioritas | Nama file | Isi | Kata kunci Sketchfab / prompt Meshy |
|---|---|---|---|
| ⭐ | `karang_bercabang.glb` | Karang bercabang (Acropora) | branching coral acropora |
| ⭐ | `karang_otak.glb` | Karang otak | brain coral |
| ⭐ | `rumput_laut.glb` | Rumput laut | seaweed sargassum kelp low poly |
| ⭐ | `ikan_kakatua.glb` | Ikan kakatua | parrotfish |
| ⭐ | `ikan_baronang.glb` | Ikan baronang / dingkis | rabbitfish siganus |
| ⭐ | `ikan_kerapu.glb` | Ikan kerapu | grouper fish |
| ⭐ | `hiu_sirip_hitam.glb` | Hiu sirip hitam | blacktip reef shark |
| ⭐ | `penyu_hijau.glb` | Penyu hijau | green sea turtle |
| ⭐ | `bulu_babi.glb` | Bulu babi | sea urchin diadema |
| | `karang_meja.glb` | Karang meja | table coral |
| | `fitoplankton.glb` | Fitoplankton | phytoplankton diatom |
| | `ikan_badut.glb` | Ikan badut | clownfish |
| | `anemon.glb` | Anemon laut | sea anemone |
| | `sampah_botol.glb` | Botol plastik | plastic bottle trash |
| | `sampah_kantong.glb` | Kantong plastik | plastic bag |
| | `jaring_hantu.glb` | Jaring ikan | fishing net |
| | `jangkar.glb` | Jangkar | boat anchor |
| | `patahan_karang.glb` | Patahan karang / rubble | coral rubble rocks |
| | `batu_karang.glb` | Batu dasar laut | underwater rock reef low poly |
| | `pelampung.glb` | Pelampung tambat | mooring buoy |
| | `rak_transplantasi.glb` | Rak transplantasi karang | coral frame restoration |
| | `perahu.glb` | Perahu nelayan | fishing boat low poly |

⭐ = paling terlihat di game, unduh ini dulu.

## Aturan agar aman dan ringan

1. **Lisensi.** Di Sketchfab, pakai hanya model yang bisa diunduh dengan lisensi
   Creative Commons (CC BY, CC BY-SA, CC0). Hindari lisensi *NonCommercial* kalau
   game akan dipakai lebih luas. Catat pembuatnya di `KREDIT.md`.
2. **Meshy AI.** Cek ketentuan lisensi paket yang kamu pakai, karena hak pakai hasil
   generate bisa berbeda antara paket gratis dan berbayar. Catat juga di `KREDIT.md`.
3. **Ukuran file.** Usahakan tiap file di bawah **2 MB** agar cepat dimuat di HP.
   Di Sketchfab pilih format **glTF/GLB**. Kalau file terlalu besar, kompres di
   <https://gltf.report> atau dengan perintah:
   `npx @gltf-transform/cli optimize input.glb output.glb --compress draco --texture-compress webp`
4. **Arah ikan.** Game menganggap kepala ikan menghadap sumbu +X. Kalau ikan terlihat
   berenang mundur atau menyamping, buka `js/models.js` lalu tambahkan `rotY: 180`
   (atau 90 / -90) pada baris model tersebut.
5. **Animasi.** Kalau model punya animasi (misalnya ekor bergerak), game otomatis
   memutar animasi pertama.

Setelah menaruh file, buka game lalu menu **Tentang game & sumber data** untuk melihat
model mana yang sudah terbaca.
