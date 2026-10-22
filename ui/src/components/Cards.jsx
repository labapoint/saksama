import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleX,
  FileText,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Tag,
  Send,
  CalendarClock,
} from 'lucide-react'
import { infoKeputusan, jam } from '../lib/feed.js'
import logoPutih from '../assets/logo/logo-collapse-white.svg'
import Markdown from '../lib/markdown.jsx'

const TONE = {
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-app-success)', line: 'var(--color-app-success)' },
  danger: { bg: 'var(--color-danger-bg)', fg: 'var(--color-app-danger)', line: 'var(--color-app-danger)' },
  warning: { bg: 'var(--color-warning-bg)', fg: '#b45309', line: 'var(--color-app-warning)' },
  primary: { bg: 'var(--color-primary-12)', fg: 'var(--color-primary-text)', line: 'var(--color-primary-text)' },
  muted: { bg: 'var(--color-app-bg-hint)', fg: 'var(--color-app-muted)', line: 'var(--color-app-line)' },
}

export function Chip({ tone = 'muted', children }) {
  const t = TONE[tone] || TONE.muted
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  )
}

export function StatusChip({ keputusan }) {
  const k = infoKeputusan(keputusan)
  return <Chip tone={k.tone}>{k.label}</Chip>
}

const IKON_AKSI = { transfer_stok: Truck, ubah_harga: Tag, pesan_tagihan: FileText, kirim_pesan: Send, jadwalkan: CalendarClock }
const LABEL_AKSI = { transfer_stok: 'Transfer stok', ubah_harga: 'Ubah harga', pesan_tagihan: 'Pesan tagihan', kirim_pesan: 'Kirim pesan', jadwalkan: 'Jadwal' }

// Balasan agent berlatar abu-abu tanpa border; status cukup lewat chip kecil supaya tidak ramai warna.
function Card({ children, sumber }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-chat-ai)' }}>
      {children}
      {sumber && (
        <div className="mt-3 border-t pt-2 text-xs" style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-muted)' }}>
          Tercatat di {sumber}
        </div>
      )}
    </div>
  )
}

function Waktu({ iso }) {
  return (
    <span className="text-xs tabular-nums" style={{ color: 'var(--color-app-muted)' }}>
      {jam(iso)}
    </span>
  )
}

const LABEL_KANAL = { workbuddy: 'WorkBuddy', slack: 'Slack' }

export function Pesan({ ev }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-chat-user)', color: 'var(--color-app-text)' }}>
          <div className="mb-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-app-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-app-text)' }}>{ev.dari}</span>
            {ev.peran && <span>· {ev.peran}</span>}
            <span className="tabular-nums">· {jam(ev.waktu)}</span>
            {ev.kanal && <span>· via {LABEL_KANAL[ev.kanal]}</span>}
          </div>
          <div className="whitespace-pre-wrap text-sm">{ev.teks}</div>
        </div>
      </div>
    </div>
  )
}

function Agent({ children }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--color-primary)' }}>
        <img src={logoPutih} alt="Asisten Saksama" className="size-5" />
      </div>
      <div className="min-w-0 max-w-[88%] flex-1">{children}</div>
    </div>
  )
}

export function KartuRencana({ r }) {
  const menunggu = r.aksi.some((a) => a.status === 'menunggu')
  return (
    <Agent>
      <Card sumber={`rencana/${r.id}.json`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold">Rencana {r.id}</div>
            <div className="text-xs" style={{ color: 'var(--color-app-muted)' }}>
              Diminta {r.peminta} ({r.peran}) · berlaku sampai {jam(r.kedaluwarsa)}
            </div>
          </div>
          {menunggu ? <Chip tone="warning">Menunggu persetujuan</Chip> : <Chip tone="muted">Sudah diputuskan</Chip>}
        </div>
        <div className="flex flex-col gap-2">
          {r.aksi.map((a) => {
            const Ikon = IKON_AKSI[a.jenis] || FileText
            const ok = a.cek?.status === 'ok'
            const peringatan = a.cek?.status === 'peringatan'
            return (
              <div key={a.no} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Ikon className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--color-app-muted)' }} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {a.no}. {LABEL_AKSI[a.jenis] || a.jenis}
                      </div>
                      <div className="text-sm">{a.detail}</div>
                    </div>
                  </div>
                  <StatusChip keputusan={a.status} />
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-sm" style={{ color: ok ? 'var(--color-app-muted)' : peringatan ? '#b45309' : 'var(--color-app-danger)' }}>
                  {ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--color-app-success)' }} /> : peringatan ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleX className="mt-0.5 size-4 shrink-0" />}
                  <span>{a.cek?.alasan}</span>
                </div>
                {a.cek?.sumber?.length > 0 && (
                  <div className="mt-1 pl-[22px] text-xs" style={{ color: 'var(--color-app-muted)' }}>
                    Sumber: {a.cek.sumber.join(', ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {r.catatan && (
          <div className="mt-3 flex items-start gap-2 rounded-lg p-2.5 text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-app-danger)' }}>
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>{r.catatan}</span>
          </div>
        )}
      </Card>
    </Agent>
  )
}

export function KartuHasil({ h, stok, produk }) {
  return (
    <Agent>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BadgeCheck className="size-4" style={{ color: 'var(--color-app-success)' }} />
            Hasil setelah dijalankan
          </div>
          <Waktu iso={h.waktu} />
        </div>
        <div className="flex flex-col gap-3">
          {h.item.map((o) => {
            const s = stok[o.file]
            if (o.jenis === 'transfer_stok' && s) {
              return (
                <div key={o.file}>
                  <div className="mb-1.5 text-sm font-semibold">
                    {s.jumlah} dus {produk[s.sku] || s.sku}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 text-sm tabular-nums">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-app-muted)' }}>Cabang</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-app-muted)' }}>Sebelum</span>
                    <span />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-app-muted)' }}>Sesudah</span>
                    <span>{s.dari}</span>
                    <span>{s.sebelum.dari}</span>
                    <ArrowRight className="size-3.5" style={{ color: 'var(--color-app-muted)' }} />
                    <span className="font-bold">{s.sesudah.dari}</span>
                    <span>{s.ke}</span>
                    <span>{s.sebelum.ke}</span>
                    <ArrowRight className="size-3.5" style={{ color: 'var(--color-app-muted)' }} />
                    <span className="font-bold">{s.sesudah.ke}</span>
                  </div>
                </div>
              )
            }
            const d = o.hasil_cek_saat_jalan || {}
            if (o.jenis === 'ubah_harga') {
              return (
                <div key={o.file} className="text-sm">
                  <div className="font-semibold">{d.produk}</div>
                  <div className="tabular-nums">
                    {d.harga_lama} <ArrowRight className="inline size-3.5" /> <b>{d.harga_baru}</b>
                  </div>
                </div>
              )
            }
            return (
              <div key={o.file} className="text-sm">
                <div className="font-semibold">
                  {LABEL_AKSI[o.jenis]} ke {d.reseller || d.penerima || o.input?.penerima}
                </div>
                {d.total && <div className="tabular-nums">Total {d.total}</div>}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-xs" style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-muted)' }}>
          <Lock className="size-3" />
          Disetujui {h.item[0]?.disetujui_oleh} · ditandatangani · tercatat di outbox/ · simulasi, tidak ada yang benar-benar terkirim
        </div>
      </Card>
    </Agent>
  )
}

export function KartuSistem({ ev }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs" style={{ background: TONE[ev.tone].bg, color: TONE[ev.tone].fg }}>
        <CircleCheck className="size-3.5" />
        {ev.teks}
      </span>
    </div>
  )
}

export function KartuTolak({ ev }) {
  return (
    <Agent>
      <Card sumber="log.csv">
        <div className="mb-1 flex items-center justify-between gap-2">
          <StatusChip keputusan={ev.keputusan} />
          <Waktu iso={ev.waktu} />
        </div>
        <div className="text-sm">{ev.teks}</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--color-app-muted)' }}>
          Rencana {ev.id} tidak berubah.
        </div>
      </Card>
    </Agent>
  )
}

export function KartuCatatan({ g }) {
  const utama = g.baris[g.baris.length - 1]
  const k = infoKeputusan(utama.keputusan)
  const injeksi = utama.keputusan === 'isi_mencurigakan'
  return (
    <Agent>
      <Card sumber="log.csv">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {g.baris.map((b, i) => (
              <StatusChip key={i} keputusan={b.keputusan} />
            ))}
          </div>
          <Waktu iso={g.waktu} />
        </div>
        {injeksi && (
          <div className="mb-1 flex items-start gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-app-danger)' }}>
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Instruksi tersembunyi diabaikan
          </div>
        )}
        <div className="flex flex-col gap-1 text-sm">
          {g.baris.map((b, i) => (
            <div key={i}>
              {injeksi ? (
                <>
                  <div>{b.detail.replace(/^\[berkas: [^\]]+\]\s*/, '')}</div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--color-app-muted)' }}>
                    Ditemukan di {(b.detail.match(/^\[berkas: ([^\]]+)\]/) || [])[1] || 'dokumen'}
                  </div>
                </>
              ) : (
                b.catatan.replace('[dicatat agent, tidak diverifikasi script] ', '') || b.detail
              )}
            </div>
          ))}
        </div>
        {utama.sumber_dibaca && (
          <div className="mt-1.5 text-xs" style={{ color: 'var(--color-app-muted)' }}>
            Sumber: {utama.sumber_dibaca.replaceAll(' ', ', ')}
          </div>
        )}
      </Card>
    </Agent>
  )
}

// Balasan agent apa adanya dari file sesi. Bisa saja keliru: yang mengikat tetap kartu gerbang.
export function KartuBalasan({ ev }) {
  return (
    <Agent>
      <div className="rounded-xl p-4" style={{ background: 'var(--color-chat-ai)' }}>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-app-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-app-text)' }}>Asisten Saksama</span>
          <Waktu iso={ev.waktu} />
        </div>
        <div style={{ color: 'var(--color-app-text)' }}>
          <Markdown teks={ev.teks} />
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t pt-2 text-xs" style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-muted)' }}>
          {ev.gerbang?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span>
                Diperiksa gerbang: {[...new Set(ev.gerbang.map((b) => infoKeputusan(b.keputusan).label))].join(', ')} · tercatat di log.csv
              </span>
            </div>
          )}
          <span>Teks agent dari sesi {LABEL_KANAL[ev.kanal]}, tidak diverifikasi kode</span>
        </div>
      </div>
    </Agent>
  )
}
