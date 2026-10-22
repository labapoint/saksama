// Membaca folder kerja Saksama (hanya baca) dan menyusun satu snapshot untuk UI.
// Dipakai plugin Vite (mode live) dan nanti script ekspor (mode replay).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { bacaPercakapan } from './sesi.js'

// Default: folder workspace/ di repo ini. Arahkan SAKSAMA_DIR ke folder kerja WorkBuddy yang sebenarnya.
export function folderKerja() {
  const env = process.env.SAKSAMA_DIR
  return env ? path.resolve(env.replace(/^~/, os.homedir())) : fileURLToPath(new URL('../../workspace', import.meta.url))
}

// CSV sederhana dengan dukungan tanda kutip (format yang ditulis csv.DictWriter Python).
export function parseCsv(teks) {
  const baris = []
  let row = [], sel = '', kutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++ }
      else if (c === '"') kutip = false
      else sel += c
    } else if (c === '"') kutip = true
    else if (c === ',') { row.push(sel); sel = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && teks[i + 1] === '\n') i++
      row.push(sel); sel = ''
      if (row.length > 1 || row[0] !== '') baris.push(row)
      row = []
    } else sel += c
  }
  if (sel !== '' || row.length) { row.push(sel); baris.push(row) }
  if (!baris.length) return []
  const [kepala, ...isi] = baris
  return isi.map((r) => Object.fromEntries(kepala.map((k, j) => [k, r[j] ?? ''])))
}

function bacaCsv(file) {
  try { return parseCsv(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

function bacaJsonFolder(dir) {
  let nama = []
  try { nama = fs.readdirSync(dir).filter((f) => f.endsWith('.json')) } catch { return [] }
  return nama.flatMap((f) => {
    try { return [{ _file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }] } catch { return [] }
  })
}

// Stok sebelum/sesudah tiap transfer yang sudah dijalankan, diurutkan menurut waktu eksekusi.
function hitungStok(stokAwal, outbox) {
  const saldo = new Map(stokAwal.map((r) => [`${r.cabang}|${r.sku}`, Number(r.stok)]))
  const hasil = {}
  const transfer = outbox.filter((o) => o.jenis === 'transfer_stok').sort((a, b) => (a.dijalankan || '').localeCompare(b.dijalankan || ''))
  for (const o of transfer) {
    const { dari, ke, sku, jumlah } = o.input || {}
    const kDari = `${dari}|${sku}`, kKe = `${ke}|${sku}`
    const sebelum = { dari: saldo.get(kDari) ?? 0, ke: saldo.get(kKe) ?? 0 }
    saldo.set(kDari, sebelum.dari - Number(jumlah))
    saldo.set(kKe, sebelum.ke + Number(jumlah))
    hasil[o._file] = { dari, ke, sku, jumlah: Number(jumlah), sebelum, sesudah: { dari: saldo.get(kDari), ke: saldo.get(kKe) } }
  }
  return hasil
}

export function bacaSnapshot(dir = folderKerja()) {
  const ada = fs.existsSync(dir)
  const log = bacaCsv(path.join(dir, 'log.csv'))
  const rencana = bacaJsonFolder(path.join(dir, 'rencana'))
  const outbox = bacaJsonFolder(path.join(dir, 'outbox'))
  const stokAwal = bacaCsv(path.join(dir, 'data/stok_per_cabang.csv'))
  const produk = Object.fromEntries(stokAwal.map((r) => [r.sku, r.produk]))
  // Kontak tanpa nomor/ID kanal: cukup nama, peran, dan cabang untuk daftar orang.
  const kontak = bacaCsv(path.join(dir, 'data/kontak.csv')).map(({ nama, peran, cabang }) => ({ nama, peran, cabang }))
  // Sesi WorkBuddy hanya sejak run ini: 10 menit sebelum baris log pertama. Log kosong = belum ada run.
  const awal = log.length ? Math.min(...log.map((b) => Date.parse(b.waktu)).filter(Number.isFinite)) : null
  const percakapan = awal ? bacaPercakapan(dir, new Date(awal - 10 * 60e3).toISOString()) : []
  return {
    folder: path.basename(dir),
    ada,
    dibaca: new Date().toISOString(),
    log,
    rencana: rencana.map(({ _file, ...r }) => r),
    outbox: outbox.map(({ _file, ...o }) => ({ ...o, file: _file })),
    stok: hitungStok(stokAwal, outbox),
    produk,
    kontak,
    percakapan,
  }
}
