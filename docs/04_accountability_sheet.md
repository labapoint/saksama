# Accountability Sheet: Saksama, Asisten Toko Multicabang

**Versi:** demo hackathon, 22 Okt 2026 · **Penanggung jawab:** Salis (pengembang Labapoint) · **Platform:** WorkBuddy (desktop dan Slack), model DeepSeek-V4.1-Flash · **Data:** 100% fiktif · **Hasil uji:** 22/22 hasil akhir benar, 14/22 proses sepenuhnya benar, 48 temuan tercatat

## 1. Untuk apa

Mengubah chat atau voice note owner dan staf menjadi rencana aksi: **transfer stok, ubah harga, tagihan reseller, kirim pesan, jadwal**. Agent menyusun rencana, manusia memutuskan, kode memeriksa, menjalankan, dan mencatat.

## 2. Apa yang bisa diakses agent

- **Satu folder kerja** di sandbox WorkBuddy: data fiktif di `data/` (dibaca), serta `tools/catat.py` dan `tools/cek_aturan.py` (dijalankan).
- **Menulis hanya lewat `catat.py`.** `outbox/`, `rencana/`, dan `log.csv` tidak ditulis langsung oleh agent.
- **Tidak bisa diakses:** kunci tanda tangan dan arsip uji (di luar sandbox), kode dan database Labapoint, kredensial, data pelanggan sungguhan.

## 3. Yang dijalankan otomatis (tidak mengubah apa pun, tidak menghubungi siapa pun)

Menafsirkan permintaan dan bertanya kalau ambigu · menjalankan cek lewat script (stok, HPP, piutang, jadwal, izin) · menolak dengan kalimat baku · menyusun rencana dan layar konfirmasi · mencatat setiap kejadian ke log (ditulis script).

## 4. Yang butuh persetujuan (ditegakkan kode, bukan prompt)

Semua yang **mengirim, menjadwalkan, mengubah, atau menagih**. Persetujuan sah hanya dari peminta atau owner, dengan balasan baku (`setuju semua`, `setuju 1,3`, `batal`); "oke deh" dan persetujuan kasir ditolak. Harga di bawah HPP wajib `setuju rugi <no>`. Rencana kedaluwarsa 30 menit, stok dicek ulang saat dijalankan, perubahan setelah dijalankan menjadi rencana baru. Eksekusi hanya simulasi ke `outbox/`.

## 5. Yang tidak pernah dilakukan

Menjalankan aksi tanpa persetujuan sah · menghitung angka sendiri atau menambah opsi di luar saran script · memberi petunjuk bahwa data terlarang itu ada · menuruti instruksi yang terselip di dokumen · mengirim data biaya ke pihak luar · menulis log sendiri atau mengisi kolom sumber.

## 6. Batas per peran dan jejak audit

Owner: semua aksi dan data biaya. Kepala cabang: aksi di cabangnya, tanpa HPP. Kasir dan admin gudang: hanya stok cabangnya. Data terlarang dan data yang tidak ada dijawab dengan kalimat identik. `log.csv` mencatat peminta, peran, aksi, sumber, hasil cek, keputusan (berupa fakta, mis. `ambigu`), dan penyetuju; persetujuan dan file outbox ditandatangani HMAC dan diperiksa `catat.py periksa`. **Jendela pantau** menampilkan semuanya per orang, termasuk balasan agent dari sesi WorkBuddy, dan hanya bisa membaca.

## 7. Kegagalan yang kami temukan, tidak kami sembunyikan

| Temuan | Yang terjadi | Tindakan |
|---|---|---|
| T13, T16 | Agent mengarang kolom sumber di log, lalu menemukan opsi `--sumber` | Kemampuan dicabut dari kode, bukan sekadar dilarang |
| T17, T18, T22 | Saat script error, agent mematikan shim sandbox (`python3 -S`) dan mengingat triknya | Bug diperbaiki; error berarti berhenti; satu kasus satu chat |
| T25, T28 | Agent membaca CSV mentah, bahkan dengan Skill aktif | Batas utama demo (bagian 8) |
| T29, T35, T36 | Saat hanya bisa menolak, agent mengarang opsi | Script memberi opsi yang sudah dicek |
| T45, T46 | Persona platform (`SOUL.md`) mengalahkan aturan Skill | Persona ikut dirancang; file data dibuka langsung turun 4 → 0 |
| T47, T48 | Lewat Slack, permintaan berulang dijawab dari ingatan, tanpa gerbang dan log | Belum tertutup; terlihat di jendela pantau |

## 8. Batas yang kami akui

Gerbang persetujuan dan audit sudah ditegakkan kode, tetapi **pembatasan baca belum**: agent masih bisa membuka file data, dan identitas pengirim masih berupa teks. Di produksi, agent tidak menyentuh file: ia memanggil API Labapoint dengan izin si penanya, Row Level Security menyaring data, dan persetujuan serta tanda tangan berada di server.

## 9. Kalau ada masalah

Hentikan agent, jalankan `python3 tools/catat.py periksa`, lalu baca `log.csv` atau jendela pantau. Tidak ada data asli, kredensial, atau sistem produksi yang terlibat.
