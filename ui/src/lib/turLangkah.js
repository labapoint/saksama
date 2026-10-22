// Isi walkthrough jendela pantau. Setiap langkah menunjuk elemen lewat atribut
// data-tur="<target>"; `sisi` hanya preferensi, tooltip pindah sendiri kalau tidak muat.

export function langkahTur({ rekaman }) {
  return [
    {
      target: 'daftar-orang',
      sisi: 'right',
      judul: 'Percakapan per orang',
      deskripsi:
        'Setiap orang yang memberi perintah ke Saksama punya barisnya sendiri. Halaman ini hanya memantau, jadi yang tampil adalah nama mereka dan percakapannya.\n\nSaat dipasang di Labapoint nanti, kolom ini berisi riwayat chat kamu sendiri dengan tombol Chat Baru, dan kamu bisa mengobrol dengan Saksama langsung dari sini.',
    },
    {
      target: 'pesan',
      sisi: 'bottom',
      judul: 'Isi percakapan',
      deskripsi:
        'Pesan yang dikirim lewat WorkBuddy atau Slack, lengkap dengan peran dan cabang pengirimnya. Garis "Chat baru" memisahkan obrolan yang berbeda.',
    },
    {
      target: 'tombol-audit',
      sisi: 'bottom',
      judul: 'Jejak audit',
      deskripsi:
        'Membuka isi log.csv yang ditulis script pencatat. Klik satu baris log untuk melompat ke chat yang terkait, jadi setiap jawaban bisa ditelusuri asalnya.',
    },
    {
      target: 'kartu-pantau',
      sisi: 'right',
      judul: rekaman ? 'Ini rekaman, bukan live' : 'Hanya memantau',
      deskripsi: rekaman
        ? 'Yang kamu lihat adalah rekaman sesi uji. Versi live berjalan di komputer owner dan membaca folder kerja Saksama setiap 2 detik.'
        : 'Halaman ini tidak bisa mengirim perintah. Perintah dan persetujuan dikirim lewat WorkBuddy atau Slack, lalu muncul di sini setiap 2 detik.',
    },
  ]
}
