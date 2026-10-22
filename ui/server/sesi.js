// Membaca file sesi WorkBuddy (hanya baca) dan mengambil teks percakapan saja:
// pesan pengguna dan balasan akhir agent per giliran. System-reminder, persona,
// reasoning, dan pemanggilan tool tidak pernah keluar dari fungsi ini.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function folderSesi() {
  const env = process.env.WORKBUDDY_SESI_DIR
  return env ? path.resolve(env.replace(/^~/, os.homedir())) : path.join(os.homedir(), '.workbuddy-ai/projects')
}

// WorkBuddy menamai folder sesi dari path workspace: /Users/a/b -> Users-a-b.
const namaFolderProyek = (dir) => dir.replace(/^\//, '').replaceAll('/', '-')

// Asisten Lokal (jalur Slack) bekerja dari folder Claw, bukan dari workspace.
const FOLDER_SLACK = /-Claw$/

// Waktu sesi (epoch ms) ke format log.csv: ISO dengan offset WIB.
function isoWib(ms) {
  return new Date(ms + 7 * 3600e3).toISOString().replace(/\.\d+Z$/, '+07:00')
}

// pengirimSesi: pengirim terakhir di sesi ini. Pesan lanjutan tanpa baris "Pengirim:"
// mewarisinya; sesi yang belum pernah punya baris itu (obrolan di luar demo) diabaikan.
function bersihkanPengguna(teks, pengirimSesi) {
  const isi = teks.replace(/<system-reminder[^>]*>[\s\S]*?<\/system-reminder>/g, '').trim()
  const query = (isi.match(/<user_query>([\s\S]*?)<\/user_query>/) || [])[1]
  if (!query) return null
  // Baris "Pengirim:" adalah penanda pesan demo; baris pengantar sebelumnya (mis. "Gunakan skill ...") dibuang.
  const m = query.match(/^Pengirim:\s*(.+)$/m)
  if (!m) return pengirimSesi ? { pengirim: pengirimSesi, teks: query.trim() } : null
  const sisa = query.slice(query.indexOf(m[0]) + m[0].length).trim()
  return { pengirim: m[1].trim(), teks: sisa }
}

function bacaSatuSesi(file, kanal) {
  const giliran = []
  let kini = null
  let baris = []
  try {
    baris = fs.readFileSync(file, 'utf8').split('\n')
  } catch {
    return []
  }
  for (const l of baris) {
    if (!l.trim()) continue
    let o
    try {
      o = JSON.parse(l)
    } catch {
      continue
    }
    if (o.type !== 'message') continue
    const teks = (o.content || []).map((c) => c.text || '').join('\n')
    if (o.role === 'user') {
      const p = bersihkanPengguna(teks, kini?.pengirim || giliran[giliran.length - 1]?.pengirim)
      kini = p ? { ...p, waktu: o.timestamp, balasan: null } : null
      if (kini) giliran.push(kini)
    } else if (o.role === 'assistant' && kini && teks.trim()) {
      // Teks antara ("Sekarang saya cek ...") ditimpa; yang tersisa balasan akhir giliran itu.
      kini.balasan = { teks: teks.trim(), waktu: o.timestamp }
    }
  }
  const sesi = path.basename(file, '.jsonl').slice(0, 8)
  return giliran.flatMap((g, i) => [
    { id: `${sesi}-${i}-u`, sesi, kanal, peran: 'pengguna', pengirim: g.pengirim, waktu: isoWib(g.waktu), teks: g.teks },
    ...(g.balasan ? [{ id: `${sesi}-${i}-a`, sesi, kanal, peran: 'agent', pengirim: g.pengirim, waktu: isoWib(g.balasan.waktu), teks: g.balasan.teks }] : []),
  ])
}

// sejak: ISO string; giliran sebelum itu (run lama yang sudah di-reset) diabaikan.
export function bacaPercakapan(dirKerja, sejak) {
  const akar = folderSesi()
  let folder = []
  try {
    folder = fs.readdirSync(akar)
  } catch {
    return []
  }
  const proyek = namaFolderProyek(dirKerja)
  const sumber = folder.filter((f) => f === proyek || FOLDER_SLACK.test(f))
  const batas = sejak ? Date.parse(sejak) : Infinity
  return sumber
    .flatMap((f) => {
      const kanal = f === proyek ? 'workbuddy' : 'slack'
      let file = []
      try {
        file = fs.readdirSync(path.join(akar, f)).filter((n) => n.endsWith('.jsonl'))
      } catch {
        return []
      }
      return file.flatMap((n) => bacaSatuSesi(path.join(akar, f, n), kanal))
    })
    .filter((p) => Date.parse(p.waktu) >= batas)
    .sort((a, b) => Date.parse(a.waktu) - Date.parse(b.waktu))
}
