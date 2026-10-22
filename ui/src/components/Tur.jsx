import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from './Ikon.jsx'

// Walkthrough ala Labapoint: lapisan gelap berlubang di atas komponen yang
// dijelaskan, plus tooltip berisi judul, kalimat, dan tombol langkah.
// Langkah yang targetnya tidak terlihat (mis. kolom percakapan di layar HP
// yang sedang menampilkan daftar orang) dilewati, bukan error.

const KUNCI = 'saksama:tur-dilihat'
const LEBAR = 320
const JARAK = 14
const TEPI = 16

export function sudahDilihat() {
  try {
    return localStorage.getItem(KUNCI) === '1'
  } catch {
    return false
  }
}

function tandaiDilihat() {
  try {
    localStorage.setItem(KUNCI, '1')
  } catch {
    /* penyimpanan tidak tersedia: tur bisa muncul lagi, tidak masalah */
  }
}

function cari(target) {
  for (const el of document.querySelectorAll(`[data-tur="${target}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

// Pilih sisi pertama yang muat; kalau tidak ada yang muat (target sebesar
// layar), tooltip duduk di bagian bawah target.
function letakkan(r, kartu, sisiPilihan) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = kartu.w
  const h = kartu.h
  const urutan = [sisiPilihan, 'bottom', 'top', 'right', 'left']
  const muat = {
    bottom: vh - r.bottom >= h + JARAK + TEPI,
    top: r.top >= h + JARAK + TEPI,
    right: vw - r.right >= w + JARAK + TEPI,
    left: r.left >= w + JARAK + TEPI,
  }
  const sisi = urutan.find((s) => muat[s])
  const jepit = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max))
  let x
  let y
  if (sisi === 'bottom' || sisi === 'top') {
    x = jepit(r.left + r.width / 2 - w / 2, TEPI, vw - w - TEPI)
    y = sisi === 'bottom' ? r.bottom + JARAK : r.top - JARAK - h
  } else if (sisi === 'right' || sisi === 'left') {
    x = sisi === 'right' ? r.right + JARAK : r.left - JARAK - w
    y = jepit(r.top + r.height / 2 - h / 2, TEPI, vh - h - TEPI)
  } else {
    x = jepit(r.left + r.width / 2 - w / 2, TEPI, vw - w - TEPI)
    y = jepit(r.bottom - h - TEPI, TEPI, vh - h - TEPI)
  }
  // Panah menunjuk pusat target, dijepit agar tidak memanjat sudut kartu.
  let panah = null
  if (sisi === 'bottom' || sisi === 'top') panah = { sisi, pos: jepit(r.left + r.width / 2 - x, 18, w - 18) }
  if (sisi === 'right' || sisi === 'left') panah = { sisi, pos: jepit(r.top + r.height / 2 - y, 18, h - 18) }
  return { x, y, panah }
}

export default function Tur({ langkah, onSelesai }) {
  // Hanya langkah yang targetnya ada saat tur dimulai. Disaring setelah commit,
  // supaya elemen yang baru dirender bersamaan dengan tur (tombol audit yang
  // muncul lagi saat kolom audit ditutup) ikut terhitung.
  const [daftar, setDaftar] = useState(null)
  useLayoutEffect(() => {
    setDaftar(langkah.filter((l) => cari(l.target)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [i, setI] = useState(0)
  const [kotak, setKotak] = useState(null)
  const [ukuran, setUkuran] = useState({ w: LEBAR, h: 180 })
  const kartu = useRef(null)
  const sekarang = daftar?.[i]

  const tutup = useCallback(() => {
    tandaiDilihat()
    onSelesai()
  }, [onSelesai])

  useEffect(() => {
    if (daftar?.length === 0) tutup()
  }, [daftar, tutup])

  // Bawa target ke layar, lalu ukur posisinya tiap frame (gulir, ubah ukuran
  // jendela, kartu yang datanya baru mendarat ikut sendiri).
  useEffect(() => {
    if (!sekarang) return undefined
    const el = cari(sekarang.target)
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
    let frame = 0
    let sidikLama = ''
    const ukur = () => {
      const t = cari(sekarang.target)
      if (t) {
        const r = t.getBoundingClientRect()
        const sidik = [r.left, r.top, r.width, r.height].map(Math.round).join('|')
        if (sidik !== sidikLama) {
          sidikLama = sidik
          setKotak({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, lengkung: parseFloat(getComputedStyle(t).borderTopLeftRadius) || 8 })
        }
      }
      frame = requestAnimationFrame(ukur)
    }
    frame = requestAnimationFrame(ukur)
    return () => cancelAnimationFrame(frame)
  }, [sekarang])

  useLayoutEffect(() => {
    if (!kartu.current) return
    const { width, height } = kartu.current.getBoundingClientRect()
    if (Math.round(width) !== Math.round(ukuran.w) || Math.round(height) !== Math.round(ukuran.h)) setUkuran({ w: width, h: height })
  })

  useEffect(() => {
    const tekan = (e) => {
      if (e.key === 'Escape') tutup()
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, (daftar?.length ?? 1) - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [tutup, daftar])

  if (!sekarang || !kotak) return null
  const { x, y, panah } = letakkan(kotak, ukuran, sekarang.sisi ?? 'right')
  const terakhir = i === daftar.length - 1

  return createPortal(
    <>
      <svg aria-hidden className="fixed inset-0 z-[90] h-full w-full">
        <defs>
          <mask id="tur-lubang">
            <rect width="100%" height="100%" fill="white" />
            <rect x={kotak.left} y={kotak.top} width={kotak.width} height={kotak.height} rx={kotak.lengkung} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.55)" mask="url(#tur-lubang)" />
      </svg>
      {/* Penghadang klik di atas lubang: selama tur, yang disorot hanya untuk dilihat. */}
      <div aria-hidden className="fixed z-[91]" style={{ left: kotak.left, top: kotak.top, width: kotak.width, height: kotak.height }} />
      <div
        ref={kartu}
        role="dialog"
        aria-label={sekarang.judul}
        className="fixed z-[92] rounded-lg p-4 shadow-lg"
        style={{ left: x, top: y, width: `min(${LEBAR}px, calc(100vw - ${TEPI * 2}px))`, background: 'var(--card)', color: 'var(--color-app-text)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="pr-1 text-sm font-bold leading-5">{sekarang.judul}</p>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup panduan"
            className="-mr-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-bg-hint)]"
            style={{ color: 'var(--color-app-muted)' }}
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-5">{sekarang.deskripsi}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-app-muted)' }}>
            {i + 1} / {daftar.length}
          </span>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="h-8 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-[var(--color-app-bg-hint)]"
                style={{ borderColor: 'var(--color-app-line)' }}
              >
                Sebelumnya
              </button>
            )}
            <button
              type="button"
              onClick={terakhir ? tutup : () => setI(i + 1)}
              className="h-8 rounded-lg px-3 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              {terakhir ? 'Selesai' : 'Selanjutnya'}
            </button>
          </div>
        </div>
        {panah && (
          <span
            aria-hidden
            className="absolute size-3 rotate-45"
            style={{
              background: 'var(--card)',
              ...(panah.sisi === 'bottom' && { top: -6, left: panah.pos - 6 }),
              ...(panah.sisi === 'top' && { bottom: -6, left: panah.pos - 6 }),
              ...(panah.sisi === 'right' && { left: -6, top: panah.pos - 6 }),
              ...(panah.sisi === 'left' && { right: -6, top: panah.pos - 6 }),
            }}
          />
        )}
      </div>
    </>,
    document.body,
  )
}
