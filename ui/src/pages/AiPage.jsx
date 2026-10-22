import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ShieldCheck, WifiOff } from 'lucide-react'
import AuditColumn from '../components/AuditColumn.jsx'
import { KartuBalasan, KartuCatatan, KartuHasil, KartuRencana, KartuSistem, KartuTolak, Pesan } from '../components/Cards.jsx'
import { daftarOrang, jam, kejadianUntukLog, kunciLog, susunFeed } from '../lib/feed.js'
import Avatar from '../components/Avatar.jsx'
import PeopleList from '../components/PeopleList.jsx'
import { useSnapshot } from '../lib/useSnapshot.js'

export default function AiPage({ mode = 'live' }) {
  const { snap, galat } = useSnapshot()
  const semua = useMemo(() => susunFeed(snap), [snap])
  const orang = useMemo(() => daftarOrang(snap, semua), [snap, semua])
  const [pilihan, setPilihan] = useState(null)
  // Tidak ada tampilan gabungan: selalu satu orang, default yang paling baru mengirim pesan.
  const terpilih = orang.find((o) => o.nama === pilihan) || orang[0]
  const feed = useMemo(() => (terpilih ? semua.filter((ev) => ev.orang?.includes(terpilih.nama)) : []), [semua, terpilih])
  const bawah = useRef(null)
  const area = useRef(null)
  // Rujukan dari kolom audit: kunci kejadian yang disorot dan baris log asalnya.
  const [sorot, setSorot] = useState(null)
  const tujuan = useRef(null)

  // Gulir ke kejadian terbaru saat ada yang baru, kecuali sedang menuju rujukan audit.
  useEffect(() => {
    if (tujuan.current) return
    bawah.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [feed.length])

  useEffect(() => {
    const key = tujuan.current
    if (!key) return
    const el = area.current?.querySelector(`[data-ev="${CSS.escape(key)}"]`)
    if (!el) return
    tujuan.current = null
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [feed, sorot])

  useEffect(() => {
    if (!sorot) return
    const t = setTimeout(() => setSorot((s) => (s?.ev === sorot.ev ? { ...s, ev: null } : s)), 2000)
    return () => clearTimeout(t)
  }, [sorot])

  function bukaLog(row) {
    const ev = kejadianUntukLog(row, semua)
    if (!ev) return
    const orangnya = ev.orang?.includes(terpilih?.nama) ? terpilih.nama : ev.orang?.find(Boolean)
    if (orangnya) setPilihan(orangnya)
    tujuan.current = ev.key
    setSorot({ ev: ev.key, log: kunciLog(row) })
  }

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <PeopleList orang={orang} pilihan={terpilih?.nama} onPilih={setPilihan} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="flex h-20 shrink-0 items-center justify-between border-b px-6"
          style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {terpilih && <Avatar nama={terpilih.nama} size={40} />}
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight">{terpilih ? terpilih.nama : 'Asisten Saksama'}</h1>
              <p className="text-sm" style={{ color: 'var(--color-app-muted)' }}>
                {terpilih
                  ? `Percakapan ${terpilih.nama} dengan Asisten Saksama, termasuk persetujuan atas permintaannya.`
                  : `Agent berjalan di WorkBuddy. Halaman ini hanya memantau${snap?.folder ? ` folder ${snap.folder}` : ''}.`}
              </p>
            </div>
          </div>
          <ModeBadge mode={mode} />
        </header>

        <div ref={area} className="flex-1 overflow-y-auto px-6 py-6" style={{ background: 'var(--card)' }}>
          {galat && <Galat pesan={galat} />}
          {!galat && snap && !snap.ada && <Galat pesan={`Folder kerja ${snap.folder} tidak ditemukan.`} />}
          {!galat && snap?.ada && feed.length === 0 && <EmptyState />}
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {feed.map((ev, i) => (
              <Fragment key={ev.key}>
                {awalSesi(feed, i) && <PemisahSesi ev={ev} />}
                <div
                  data-ev={ev.key}
                  className="rounded-2xl transition-[outline-color] duration-500"
                  style={{ outline: '2px solid', outlineOffset: 6, outlineColor: sorot?.ev === ev.key ? 'var(--color-primary-text)' : 'transparent' }}
                >
                  <Kejadian ev={ev} snap={snap} />
                </div>
              </Fragment>
            ))}
            <div ref={bawah} />
          </div>
        </div>

      </section>

      <AuditColumn log={snap?.log} orang={terpilih?.nama} aktif={sorot?.log} onPilih={bukaLog} />
    </div>
  )
}

// Pemisah muncul saat pesan dari sesi WorkBuddy/Slack berikutnya berasal dari chat lain,
// supaya tidak terkesan agent mengingat obrolan dari sesi sebelumnya.
function awalSesi(feed, i) {
  if (!feed[i].sesi) return false
  for (let j = i - 1; j >= 0; j--) if (feed[j].sesi) return feed[j].sesi !== feed[i].sesi
  return false
}

const LABEL_KANAL = { workbuddy: 'WorkBuddy', slack: 'Slack' }

function PemisahSesi({ ev }) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs" style={{ color: 'var(--color-app-muted)' }}>
      <span className="h-px flex-1" style={{ background: 'var(--color-app-line)' }} />
      <span className="tabular-nums">
        Chat baru · {jam(ev.waktu)} · {LABEL_KANAL[ev.kanal]}
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--color-app-line)' }} />
    </div>
  )
}

function Kejadian({ ev, snap }) {
  switch (ev.jenis) {
    case 'pesan':
      return <Pesan ev={ev} />
    case 'rencana':
      return <KartuRencana r={ev.rencana} />
    case 'hasil':
      return <KartuHasil h={ev.hasil} stok={snap.stok} produk={snap.produk} />
    case 'sistem':
      return <KartuSistem ev={ev} />
    case 'tolak':
      return <KartuTolak ev={ev} />
    case 'catatan':
      return <KartuCatatan g={ev.grup} />
    case 'balasan':
      return <KartuBalasan ev={ev} />
    default:
      return null
  }
}

function ModeBadge({ mode }) {
  const live = mode === 'live'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={
        live
          ? { background: 'var(--color-success-bg)', color: 'var(--color-app-success)' }
          : { background: 'var(--color-primary-12)', color: 'var(--color-primary-text)' }
      }
    >
      <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {live ? 'Live' : 'Replay'}
    </span>
  )
}

function Galat({ pesan }) {
  return (
    <div
      className="mx-auto mb-4 flex max-w-3xl items-center gap-2 rounded-xl border p-3 text-sm"
      style={{ borderColor: 'var(--color-app-warning)', background: 'var(--color-warning-bg)', color: '#b45309' }}
    >
      <WifiOff className="size-4 shrink-0" />
      Tidak bisa membaca data: {pesan}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div
        className="mx-auto flex size-12 items-center justify-center rounded-[10px]"
        style={{ background: 'var(--color-primary-12)', color: 'var(--color-primary-text)' }}
      >
        <ShieldCheck className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold">Belum ada percakapan</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-app-muted)' }}>
        Setiap permintaan owner, rencana, persetujuan, dan hasilnya akan muncul di sini.
      </p>
    </div>
  )
}
