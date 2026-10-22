# workspace

Folder kerja (sandbox) untuk agent Saksama di WorkBuddy. **Salin folder ini ke luar repo** (misalnya `~/Documents/hackathon/saksama`) lalu berikan akses WorkBuddy ke salinan itu saja, jangan ke folder induknya.

Semua data di sini fiktif. Tidak ada satu baris pun data tenant asli.

```
data/                 data mock (dibaca agent dan script)
  hari_ini.txt        tanggal patokan uji, hapus untuk pakai tanggal sistem
  panitia/            taruh dataset resmi panitia di sini
tools/cek_aturan.py   pengecek aturan deterministik (hanya membaca data/)
tools/catat.py        gerbang persetujuan: rencana, setujui, jalankan, periksa, log
rencana/              status tiap rencana (dibuat otomatis oleh catat.py)
outbox/               aksi yang sudah disetujui dan lolos cek ulang (simulasi)
log.csv               catatan semua permintaan dan keputusan
```

Butuh Python 3 (bawaan macOS cukup), tanpa library tambahan.

## Persiapan sekali (dilakukan manusia, bukan agent)

Buat kunci tanda tangan di luar folder sandbox:

```bash
python3 tools/catat.py init-kunci
```

Kunci disimpan di `~/.asisten-owner/kunci`. Jangan beri agent akses ke folder itu. Tanpa kunci, semuanya tetap jalan, tetapi pemalsuan file outbox tidak bisa dideteksi.

## Persiapan persona WorkBuddy (disarankan)

Persona bawaan WorkBuddy (`SOUL.md`) mendorong agent "mencari tahu sendiri sebelum bertanya", yang bertabrakan dengan Skill. Eksperimen kami (temuan T45, T46) menunjukkan tambahan berikut mengurangi pembacaan file mentah dan opsi karangan. Keamanan tetap ditegakkan oleh `catat.py`, bukan oleh persona.

```bash
S=$(ls ~/.workbuddy-ai/user-*-personal/SOUL.md) && cp "$S" ~/SOUL_asli_backup.md && cat setup/soul_tambahan.md >> "$S"
```

Pulihkan kapan saja dengan menyalin balik `~/SOUL_asli_backup.md`.

## Alur satu permintaan

```bash
# 1. daftarkan rencana (keluar layar konfirmasi)
python3 tools/catat.py rencana --peminta "Bu Sari" --permintaan "kirim 20 dus nugget ke Pasuruan" \
  --aksi '[{"jenis":"transfer_stok","dari":"Gresik","ke":"Pasuruan","sku":"NA1K","jumlah":20}]'

# 2. catat balasan owner
python3 tools/catat.py setujui --id R-20261021-091500 --penyetuju "Bu Sari" --balasan "setuju semua"

# 3. cek ulang lalu tulis ke outbox
python3 tools/catat.py jalankan --id R-20261021-091500

# audit kapan saja
python3 tools/catat.py periksa
```

Pengamanan yang ditegakkan oleh kode:
- **Persetujuan:** hanya peminta atau owner yang berwenang, dengan balasan baku. "Oke deh" ditolak.
- **Harga di bawah HPP:** hanya bisa disetujui dengan `setuju rugi <no>`.
- **Batas waktu:** rencana kedaluwarsa 30 menit setelah dibuat, dan persetujuan kedaluwarsa 30 menit sebelum dijalankan.
- **Cek ulang saat dijalankan:** kalau stok berubah setelah disetujui, aksi batal dan tercatat `gagal_cek_ulang`.
- **Tanda tangan:** rencana yang diubah atau file outbox yang ditulis di luar script akan ditolak atau terdeteksi oleh `periksa`.

## Arsip lalu reset sebelum tiap kasus uji

Arsip disimpan di luar folder kerja (agent tidak bisa membacanya). Ganti `L05` dengan kode kasus yang baru selesai.

```bash
A=~/Documents/hackathon/arsip_uji/$(date +%H%M)_L05 && mkdir -p "$A" && cp -R log.csv outbox rencana "$A"/ 2>/dev/null; cp -R .workbuddy-ai/memory "$A"/ 2>/dev/null; find outbox rencana -name '*.json' -delete 2>/dev/null; rm -rf .workbuddy-ai/memory; head -1 log.csv > log.tmp && mv log.tmp log.csv && ls "$A" && wc -l log.csv
```
