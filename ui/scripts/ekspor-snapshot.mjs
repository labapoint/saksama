// Rekam satu snapshot folder kerja (dan sesi WorkBuddy) ke public/rekaman/snapshot.json
// untuk mode Replay: build statis yang bisa dibuka tanpa WorkBuddy.
// Pakai: SAKSAMA_DIR=~/Documents/hackathon/saksama node scripts/ekspor-snapshot.mjs
import fs from 'node:fs'
import { bacaSnapshot, folderKerja } from '../server/snapshot.js'

const dir = folderKerja()
const snap = bacaSnapshot(dir)
if (!snap.ada) {
  console.error(`Folder kerja ${dir} tidak ditemukan.`)
  process.exit(1)
}
const tujuan = new URL('../public/rekaman/snapshot.json', import.meta.url)
fs.writeFileSync(tujuan, JSON.stringify({ ...snap, rekaman: true }, null, 1))
console.log(
  `Rekaman disimpan: ${snap.log.length} baris log, ${snap.rencana.length} rencana, ${snap.outbox.length} outbox, ${snap.percakapan.length} pesan sesi.`,
)
