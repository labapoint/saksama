// Menyusun snapshot (log, rencana, outbox) menjadi linimasa kejadian untuk kolom percakapan.

const LOG_TANPA_RENCANA = new Set([
  'ditolak_izin',
  'ditolak_aturan',
  'tidak_ada',
  'pengirim_tidak_dikenal',
  'di_luar_kemampuan',
  'isi_mencurigakan',
  'ambigu',
  'dijawab',
])

export const KEPUTUSAN = {
  menunggu: { label: 'Menunggu', tone: 'warning' },
  disetujui: { label: 'Disetujui', tone: 'primary' },
  dijalankan: { label: 'Dijalankan', tone: 'success' },
  dibatalkan: { label: 'Dibatalkan', tone: 'muted' },
  ditolak: { label: 'Ditolak aturan', tone: 'danger' },
  ditolak_aturan: { label: 'Ditolak aturan', tone: 'danger' },
  ditolak_izin: { label: 'Ditolak izin', tone: 'danger' },
  persetujuan_tidak_sah: { label: 'Persetujuan tidak sah', tone: 'danger' },
  pengirim_tidak_dikenal: { label: 'Pengirim tak dikenal', tone: 'danger' },
  tidak_ada: { label: 'Tidak ada data', tone: 'muted' },
  ambigu: { label: 'Ambigu', tone: 'warning' },
  ditanya: { label: 'Ditanya', tone: 'warning' },
  dijawab: { label: 'Dijawab', tone: 'primary' },
  di_luar_kemampuan: { label: 'Di luar kemampuan', tone: 'muted' },
  isi_mencurigakan: { label: 'Isi mencurigakan', tone: 'danger' },
  kedaluwarsa: { label: 'Kedaluwarsa', tone: 'muted' },
  gagal_cek_ulang: { label: 'Gagal cek ulang', tone: 'danger' },
}

export function infoKeputusan(k) {
  return KEPUTUSAN[k] || { label: k || '-', tone: 'muted' }
}

export function jam(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

export function susunFeed(snap) {
  if (!snap) return []
  const ev = []

  for (const r of snap.rencana) {
    ev.push({ key: `p-${r.id}`, orang: [r.peminta], waktu: r.dibuat, urut: 0, jenis: 'pesan', dari: r.peminta, peran: r.peran, teks: r.permintaan })
    ev.push({ key: `r-${r.id}`, orang: [r.peminta], waktu: r.dibuat, urut: 1, jenis: 'rencana', rencana: r })

    // Balasan persetujuan, dikelompokkan per waktu dan teks balasan.
    const balasan = new Map()
    for (const a of r.aksi) {
      const p = a.persetujuan
      if (!p) continue
      const k = `${p.waktu}|${p.balasan}`
      if (!balasan.has(k)) balasan.set(k, { ...p, nomor: [] })
      balasan.get(k).nomor.push(a.no)
    }
    for (const [k, p] of balasan) {
      ev.push({ key: `b-${r.id}-${k}`, orang: [r.peminta, p.penyetuju], waktu: p.waktu, urut: 4, jenis: 'pesan', dari: p.penyetuju, peran: 'owner', teks: p.balasan })
      ev.push({ key: `s-${r.id}-${k}`, orang: [r.peminta, p.penyetuju], waktu: p.waktu, urut: 5, jenis: 'sistem', tone: 'primary', teks: `Persetujuan sah untuk aksi ${p.nomor.join(', ')} (tercatat dan ditandatangani).` })
    }
  }

  // Percobaan persetujuan yang ditolak gerbang.
  for (const row of snap.log) {
    if (row.keputusan !== 'persetujuan_tidak_sah') continue
    const balas = (row.catatan.match(/balasan '([^']*)'/) || [])[1] || ''
    ev.push({ key: `x-${row.waktu}-${row.no_aksi}`, orang: [row.disetujui_oleh], waktu: row.waktu, urut: 2, jenis: 'pesan', dari: row.disetujui_oleh, peran: '', teks: balas || '(persetujuan)' })
    ev.push({ key: `xs-${row.waktu}-${row.no_aksi}`, orang: [row.disetujui_oleh], waktu: row.waktu, urut: 3, jenis: 'tolak', keputusan: row.keputusan, teks: row.catatan.replace(/^balasan '[^']*': /, ''), id: row.id_rencana })
  }

  // Hasil eksekusi per rencana per waktu jalan.
  const hasil = new Map()
  for (const o of snap.outbox) {
    const k = `${o.id_rencana}|${o.dijalankan}`
    if (!hasil.has(k)) hasil.set(k, { id: o.id_rencana, waktu: o.dijalankan, peminta: o.diminta_oleh, item: [] })
    hasil.get(k).item.push(o)
  }
  for (const [k, h] of hasil) ev.push({ key: `h-${k}`, orang: [h.peminta, h.item[0]?.disetujui_oleh], waktu: h.waktu, urut: 6, jenis: 'hasil', hasil: h })

  // Kejadian yang tidak sampai menjadi rencana (penolakan, data tidak ada, injeksi, dsb.).
  const grup = []
  for (const row of snap.log) {
    if (row.id_rencana || !LOG_TANPA_RENCANA.has(row.keputusan)) continue
    const terakhir = grup[grup.length - 1]
    const dekat = terakhir && terakhir.detail === row.detail && Math.abs(new Date(row.waktu) - new Date(terakhir.waktu)) < 120000
    if (dekat) terakhir.baris.push(row)
    else grup.push({ waktu: row.waktu, detail: row.detail, peminta: row.peminta, peran: row.peran, baris: [row] })
  }
  for (const g of grup) {
    const injeksi = g.baris.every((b) => b.keputusan === 'isi_mencurigakan')
    if (!injeksi) ev.push({ key: `lp-${g.waktu}`, orang: [g.peminta], waktu: g.waktu, jenis: 'pesan', dari: g.peminta, peran: g.peran, teks: g.detail })
    ev.push({ key: `lc-${g.waktu}`, orang: [g.peminta], waktu: g.waktu, urut: 1, jenis: 'catatan', grup: g })
  }

  tambahPercakapan(ev, snap)

  // Waktu tercatat per detik; dalam detik yang sama urutkan menurut fase alur.
  ev.sort((a, b) => (Date.parse(a.waktu) || 0) - (Date.parse(b.waktu) || 0) || (a.urut || 0) - (b.urut || 0))
  return leburKeBalasan(ev)
}

// Teks asli dari sesi WorkBuddy/Slack. Pesan pengguna dari sesi menggantikan pesan yang
// direkonstruksi dari file gerbang (kata-kata asli, bukan ringkasan agent) bila keduanya
// dari orang yang sama dan pesan gerbang tercatat dalam 10 menit setelahnya.
function tambahPercakapan(ev, snap) {
  const kontak = new Map((snap.kontak || []).map((k) => [k.nama, k.peran]))
  const sesi = (snap.percakapan || []).filter((p) => p.peran === 'pengguna')
  const terpakai = new Set()
  const buang = new Set()
  for (const e of ev) {
    if (e.jenis !== 'pesan') continue
    const t = Date.parse(e.waktu)
    const cocok = sesi
      .filter((p) => !terpakai.has(p.id) && p.pengirim === e.dari && Date.parse(p.waktu) <= t + 1000 && t - Date.parse(p.waktu) <= 10 * 60e3)
      .sort((a, b) => Date.parse(b.waktu) - Date.parse(a.waktu))[0]
    if (cocok) {
      terpakai.add(cocok.id)
      buang.add(e)
    }
  }
  for (let i = ev.length - 1; i >= 0; i--) if (buang.has(ev[i])) ev.splice(i, 1)

  for (const p of snap.percakapan || []) {
    if (p.peran === 'pengguna') {
      ev.push({ key: `w-${p.id}`, orang: [p.pengirim], waktu: p.waktu, urut: -1, jenis: 'pesan', dari: p.pengirim, peran: kontak.get(p.pengirim) || '', teks: p.teks, kanal: p.kanal, sesi: p.sesi })
    } else {
      ev.push({ key: `w-${p.id}`, orang: [p.pengirim], waktu: p.waktu, urut: 7, jenis: 'balasan', teks: p.teks, kanal: p.kanal, sesi: p.sesi })
    }
  }
}

// Keputusan gerbang yang cukup ditandai di bawah balasan agent, bukan kartu sendiri.
// Injeksi, rencana, hasil, dan persetujuan tidak sah tetap tampil sebagai kartu penuh.
const KEPUTUSAN_KECIL = new Set(['ambigu', 'tidak_ada', 'ditolak_aturan', 'ditolak_izin', 'di_luar_kemampuan', 'dijawab'])

// Kartu catatan gerbang dilebur ke balasan agent berikutnya untuk orang yang sama (maks. 5 menit,
// sebelum orang itu mengirim pesan lagi). Tanpa balasan dari sesi, kartunya tetap tampil.
function leburKeBalasan(ev) {
  const lebur = new Set()
  for (let i = 0; i < ev.length; i++) {
    const c = ev[i]
    if (c.jenis !== 'catatan' || !c.grup.baris.every((b) => KEPUTUSAN_KECIL.has(b.keputusan))) continue
    const orang = c.grup.peminta
    for (let j = i + 1; j < ev.length; j++) {
      const e = ev[j]
      if (Date.parse(e.waktu) - Date.parse(c.waktu) > 5 * 60e3) break
      if (e.jenis === 'pesan' && e.dari === orang) break
      if (e.jenis === 'balasan' && e.orang.includes(orang)) {
        e.gerbang = [...(e.gerbang || []), ...c.grup.baris]
        lebur.add(c)
        break
      }
    }
  }
  return ev.filter((e) => !lebur.has(e))
}

// Daftar orang untuk panel kiri: semua kontak non-reseller yang pernah muncul, plus pengirim tak dikenal.
export function daftarOrang(snap, feed) {
  const kontak = new Map((snap?.kontak || []).map((k) => [k.nama, k]))
  const info = new Map()
  for (const ev of feed) {
    for (const nama of new Set(ev.orang || [])) {
      if (!nama) continue
      const i = info.get(nama) || { nama, peran: kontak.get(nama)?.peran || 'tidak dikenal', cabang: kontak.get(nama)?.cabang || '', jumlah: 0, terakhir: null }
      if (ev.jenis === 'pesan' && ev.dari === nama) {
        i.jumlah += 1
        i.terakhir = ev
      }
      info.set(nama, i)
    }
  }
  return [...info.values()]
    .filter((i) => i.jumlah > 0)
    .sort((a, b) => (b.terakhir?.waktu || '').localeCompare(a.terakhir?.waktu || ''))
}

// Identitas stabil satu baris log (objek baris berganti tiap polling).
export const kunciLog = (row) => `${row.waktu}|${row.id_rencana}|${row.no_aksi}|${row.keputusan}|${row.detail}`

// Kejadian di percakapan yang dirujuk satu baris log.csv (untuk klik di kolom jejak audit).
export function kejadianUntukLog(row, semua) {
  const selisih = (ev) => Math.abs(new Date(ev.waktu) - new Date(row.waktu))
  const terdekat = (daftar) => daftar.sort((a, b) => selisih(a) - selisih(b))[0]
  const id = row.id_rencana
  if (row.keputusan === 'persetujuan_tidak_sah') return semua.find((ev) => ev.key === `xs-${row.waktu}-${row.no_aksi}`)
  if (!id) return semua.find((ev) => (ev.jenis === 'catatan' && ev.grup.baris.includes(row)) || (ev.jenis === 'balasan' && ev.gerbang?.includes(row)))
  if (row.keputusan === 'dijalankan') {
    const hasil = terdekat(semua.filter((ev) => ev.jenis === 'hasil' && ev.hasil.id === id))
    if (hasil) return hasil
  }
  if (row.keputusan === 'disetujui') {
    const sah = terdekat(semua.filter((ev) => ev.jenis === 'sistem' && ev.key.startsWith(`s-${id}-`)))
    if (sah) return sah
  }
  return semua.find((ev) => ev.key === `r-${id}`)
}
