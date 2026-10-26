# Berkas 1–3: Judul, Blurb, Deskripsi Proyek

## 1. Judul proyek

**Saksama: Asisten Toko Multicabang** (final)

*Saksama* berarti teliti dan cermat: agent menghitung dengan kode, bertanya kalau ambigu, dan tidak bertindak tanpa persetujuan.

## 2. Blurb (maksimal 10 kata)

**Asisten yang menyusun rencana kerja dan menunggu persetujuan owner.** (final, 9 kata)

## 3. Deskripsi proyek

**Tantangan:** B, The Office Agent. **Pola:** *Meeting to action*, yaitu notulen dan chat owner diubah menjadi aksi toko yang menunggu persetujuan. **Pengguna:** pemilik UMKM multicabang dan staf cabangnya (kepala cabang, kasir).

### Masalah

Pemilik UMKM dengan beberapa cabang mengatur usahanya lewat chat dan voice note. Satu pesan bisa berisi tiga perintah sekaligus: kirim stok ke cabang lain, naikkan harga, tagih reseller yang belum bayar. Pesan seperti itu sering ambigu. "Nugget" bisa berarti kemasan 500 g atau 1 kg, "Bu Ani" bisa reseller di dua kota berbeda, dan "Jumat siang" bisa bentrok dengan waktu salat.

Kalau staf atau AI langsung menjalankannya, kesalahan langsung menjadi kerugian uang: stok terkirim ke cabang yang salah, harga turun di bawah modal, tagihan salah orang. Sebaliknya, AI yang terlalu bebas juga berbahaya. Ia bisa menuruti instruksi aneh yang terselip di pesan pelanggan, atau membuka data biaya ke kasir yang tidak berhak.

Mulai 16 Januari 2027, PP 33/2026 mewajibkan perusahaan menilai dampak perlindungan data setiap kali AI mengolah data pribadi. Agent yang tidak bisa dicek jejaknya tidak akan dipakai.

### Solusi

**Saksama** adalah agent di WorkBuddy yang mengubah pesan chat menjadi **rencana aksi**, lalu berhenti dan meminta persetujuan. Prinsipnya: **agent menyusun rencana, manusia memutuskan, kode menjalankan.**

Alurnya:
1. **Pahami dan pecah.** Satu pesan dipecah menjadi aksi: transfer stok, ubah harga, pesan tagihan, kirim pesan, atau jadwal.
2. **Tanya kalau ambigu.** Semua pertanyaan diajukan sekaligus dalam satu pesan bernomor.
3. **Cek aturan dengan kode.** Stok, harga terhadap HPP, piutang, jadwal, hari libur, zona waktu, dan izin per peran dihitung oleh script, bukan ditebak model.
4. **Tampilkan layar konfirmasi.** Setiap aksi lengkap dengan hasil cek dan sumber datanya, lalu agent berhenti.
5. **Persetujuan diputuskan kode.** Hanya peminta atau owner yang boleh menyetujui, dengan balasan baku seperti `setuju 1,3`. Harga di bawah HPP hanya bisa dijalankan dengan `setuju rugi 1`.
6. **Cek ulang, jalankan, catat.** Sebelum dijalankan aturan dicek lagi, karena stok bisa berubah. Hasilnya ditulis ke outbox (simulasi), dicatat di log, dan ditandatangani.

Lima syarat agent yang bisa dipercaya dipenuhi seperti ini:

| Syarat | Wujud di Saksama |
|---|---|
| Tunjuk sumber | Setiap baris konfirmasi menyebut file data yang dibaca script |
| Patuh batas akses | Izin per peran; pertanyaan terlarang dan data yang tidak ada dijawab dengan kalimat identik |
| Minta izin dulu | Gerbang persetujuan ditegakkan kode, bukan janji di prompt |
| Berani bilang tidak tahu | Data tidak ada atau penerima tidak dikenal: agent bertanya, tidak mengarang |
| Simpan catatan | Log diisi kode, tiap persetujuan ditandatangani, file palsu terdeteksi |

### Desain prompt: bagaimana instruksi membentuk perilaku agent

Perilaku Saksama dibentuk oleh tiga lapis instruksi, dan pengujian kami menunjukkan urutan kekuatannya penting:

1. **Persona platform (`SOUL.md`).** WorkBuddy menyuntikkan persona "cari tahu sendiri sebelum bertanya, baca file". Persona ini bertabrakan dengan agent yang harus patuh aturan. Kami menambahkan satu bagian yang sejalan dengan Skill. Hasilnya terukur: di kasus jadwal, file data yang dibuka langsung turun dari 4 ke 0, pemanggilan script naik dari 2 ke 5, dan langkah total turun dari 16 ke 9. Opsi karangan juga hilang.
2. **Skill `asisten-owner`.** Berisi alur wajib (kenali pengirim, pecah permintaan, tanya kalau ambigu, cek lewat script, tampilkan konfirmasi, berhenti), kalimat baku untuk penolakan, dan larangan eksplisit. Setiap aturan ditulis dari kegagalan nyata saat uji, misalnya "kalau script error, berhenti" setelah agent mematikan sandbox, dan "opsi hanya dari script" setelah agent mengarang solusi.
3. **Kode sebagai lapisan terakhir.** Karena prompt tidak pernah 100% dipatuhi, semua yang menyangkut uang, izin, dan audit tidak diserahkan ke prompt. Kalimat penolakan disalin persis dari script, persetujuan diputuskan script, dan opsi yang dilarang (misalnya mengisi kolom sumber di log) dicabut dari alatnya. Prinsipnya: **prompt membentuk perilaku, kode menegakkan batas.**

### Yang membedakan

- **Izin ditegakkan kode, bukan dipercayakan ke model.** Saat uji, model terbukti bisa salah merangkum instruksinya sendiri, mengarang isi log, dan bahkan mematikan sandbox platform untuk menyelesaikan tugas. Karena itu setiap aturan penting kami pindahkan ke kode, dan kemampuan yang disalahgunakan kami cabut, bukan sekadar dilarang.
- **Kegagalan kami catat terbuka.** Ada 48 temuan uji, termasuk yang memalukan, lengkap dengan bukti dan perbaikannya.
- **Batas yang diakui.** Di demo ini agent masih bisa membaca file data secara langsung. Kami menulisnya di diagram arsitektur dan menunjukkan cara menutupnya di produksi.

### Nilai bisnis

**Kesalahan yang dicegah dalam 22 kasus uji:**

| Jenis kesalahan | Kasus | Hasil |
|---|---|---|
| Kirim stok melebihi yang ada | L02, L08 | Ditolak, opsi sesuai stok ditawarkan |
| Harga di bawah modal | L03 | Ditahan sampai owner menulis "setuju rugi" |
| Salah orang (dua nama mirip) | L01, P01 | Agent bertanya, tidak menebak |
| Kirim ganda setelah perubahan | L13 | 20 dus + 25 dus = 45 dus dicegah; agent bertanya maksudnya |
| Instruksi tersembunyi di pesan atau dokumen | L05, P06 | Diabaikan dan dilaporkan |
| Persetujuan oleh orang yang tidak berhak | L11, L04, P08 | Ditolak |
| Jadwal di hari libur, cabang tutup, atau saat salat Jumat | L10, P01, P03 | Ditolak dengan usulan waktu lain |
| Data biaya bocor ke kasir atau pihak luar | L06, L07, P05 | Tidak ada data yang bocor |

**Waktu.** Satu pesan owner berisi tiga perintah (L01) diselesaikan dalam sekitar 4 giliran chat, termasuk klarifikasi dan persetujuan, tanpa berpindah halaman aplikasi. Waktu yang dihemat dibanding mengerjakannya manual belum kami ukur dengan pengguna sungguhan; ini rencana uji berikutnya bersama owner Labapoint.

- **Mencegah kerugian sebelum terjadi.** Transfer melebihi stok ditolak, harga di bawah modal ditahan, tagihan ke reseller yang tidak punya utang tidak dibuat.
- **Owner tetap memegang kendali.** Satu layar konfirmasi menggantikan berpindah ke beberapa halaman aplikasi, tetapi tidak ada yang terjadi tanpa persetujuannya.
- **Siap jadi fitur produk nyata.** Proyek ini lahir dari Labapoint, aplikasi POS multi-cabang untuk UMKM Indonesia yang sudah berjalan. Labapoint sudah punya izin per peran, Row Level Security, dan audit log. Agent cukup memanggil API dengan izin si penanya, dan layar konfirmasinya adalah form yang sudah ada (Pengiriman Stok, Ubah Harga Massal).
- **Siap untuk aturan baru.** Jejak audit lengkap dan pembatasan per peran sejalan dengan kewajiban penilaian dampak perlindungan data.
- **Langkah berikutnya.** Pindahkan data dan gerbang ke server supaya agent hanya bisa memanggil alat, tidak membaca file (menutup batas baca T25/T28). Tambah aksi baru yang lahir dari uji: harga promo dengan tanggal berakhir yang kembali otomatis (T21), serta pembatalan atau koreksi transfer yang juga lewat persetujuan (T30).

### Data dan keamanan

Semua data fiktif dan dibuat sendiri: 4 cabang, 3 produk, 9 kontak, piutang reseller. Agent hanya diberi akses ke satu folder kerja. Tidak ada akses ke kode sumber, kredensial, database produksi, atau data pelanggan sungguhan. Tidak ada pesan, stok, atau harga yang benar-benar berubah.
