import { useEffect } from 'react'
import { X } from './Ikon.jsx'
import { infoKeputusan, jam, kunciLog } from '../lib/feed.js'

const TITIK = { success: 'var(--color-app-success)', danger: 'var(--color-app-danger)', warning: 'var(--color-app-warning)', primary: 'var(--color-primary-text)', muted: 'var(--color-app-muted)' }

export default function AuditColumn({ log = [], orang = null, aktif = null, onPilih, onTutup }) {
  const terpilih = orang ? log.filter((b) => b.peminta === orang || b.disetujui_oleh === orang) : log
  const baris = [...terpilih].reverse()

  useEffect(() => {
    const tekan = (e) => e.key === 'Escape' && onTutup?.()
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [onTutup])
  return (
    <>
      {/* Di bawah 1280px kolom ini jadi panel geser dari kanan di atas percakapan. */}
      <div className="fixed inset-0 z-30 bg-black/30 xl:hidden" onClick={onTutup} aria-hidden="true" />
      <aside
        role="complementary"
        aria-label="Jejak audit"
        className="fixed inset-y-0 right-0 z-40 flex w-[min(340px,100vw)] animate-[geser-masuk_180ms_ease-out] flex-col border-l shadow-xl xl:static xl:animate-none xl:z-auto xl:w-[300px] xl:shrink-0 xl:shadow-none"
        style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)' }}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: 'var(--color-app-line)' }}>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Jejak audit</h2>
            <p className="text-xs tabular-nums" style={{ color: 'var(--color-app-muted)' }}>
              {terpilih.length} catatan
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            title="Tutup jejak audit"
            aria-label="Tutup jejak audit"
            className="-mr-1.5 flex size-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-app-bg-hint)]"
            style={{ color: 'var(--color-app-muted)' }}
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="border-b px-5 py-3 text-xs" style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-text)' }}>
          Catatan permanen siapa meminta apa, keputusannya, dan siapa yang menyetujui. Ditulis oleh kode, bukan oleh AI. Klik catatan untuk melihatnya di percakapan.
        </p>
        <ol className="flex-1 overflow-y-auto">
          {baris.length === 0 && (
            <li className="px-5 py-4 text-sm" style={{ color: 'var(--color-app-muted)' }}>
              Belum ada catatan.
            </li>
          )}
          {baris.map((b, i) => (
            <li key={i} className="border-b" style={{ borderColor: 'var(--color-app-line)' }}>
              <button
                type="button"
                onClick={() => onPilih?.(b)}
                title="Lihat di percakapan"
                className="block w-full px-5 py-3 text-left transition-colors hover:bg-[var(--color-app-bg-hint)]"
                style={aktif === kunciLog(b) ? { background: 'var(--color-primary-active-bg)' } : undefined}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="size-1.5 rounded-full" style={{ background: TITIK[infoKeputusan(b.keputusan).tone] }} />
                    {infoKeputusan(b.keputusan).label}
                  </span>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--color-app-muted)' }}>
                    {jam(b.waktu)}
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--color-app-text)' }}>
                  {b.peminta || '-'}
                  {b.peran ? ` · ${b.peran}` : ''}
                  {b.jenis ? ` · ${b.jenis}` : ''}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--color-app-muted)' }}>
                  {b.id_rencana ? `${b.id_rencana} #${b.no_aksi} · ` : ''}
                  {b.detail}
                </div>
                {b.disetujui_oleh && (
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--color-app-muted)' }}>
                    oleh {b.disetujui_oleh}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ol>
        <div className="border-t px-5 py-3 text-xs" style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-muted)' }}>
          Dibaca dari log.csv (ditulis oleh catat.py)
        </div>
      </aside>
    </>
  )
}
