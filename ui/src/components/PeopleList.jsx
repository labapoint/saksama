import { DuaOrang, Menu, RefreshLeft, Show } from './Ikon.jsx'
import Avatar from './Avatar.jsx'

const LABEL_PERAN = {
  owner: 'Owner',
  kepala_cabang: 'Kepala cabang',
  kasir: 'Kasir',
  admin_gudang: 'Admin gudang',
  reseller: 'Reseller',
  'tidak dikenal': 'Tidak terdaftar',
}

// Di mobile daftar ini halaman tersendiri dan belum ada yang dibuka, jadi tanda aktif baru tampil mulai md.
function Baris({ aktif, onClick, avatar, judul, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktif ? 'true' : undefined}
      className={'flex w-full items-center gap-3 rounded-[10px] border border-[var(--color-app-line)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--card)] ' + (aktif ? 'md:border-transparent md:bg-[var(--color-primary-12)] md:hover:bg-[var(--color-primary-12)]' : '')}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" style={{ color: 'var(--color-app-text)' }}>
          {judul}
        </div>
        <div className="truncate text-xs" style={{ color: 'var(--color-app-muted)' }}>
          {sub}
        </div>
      </div>
    </button>
  )
}

export default function PeopleList({ orang, pilihan, onPilih, onMenu, tersembunyiDiMobile, direkam, disaring, batas, onMulaiNol, onTampilkanSemua }) {
  return (
    <aside
      className={'w-full shrink-0 flex-col md:flex md:w-[220px] lg:w-[280px] md:border-r ' + (tersembunyiDiMobile ? 'hidden' : 'flex')}
      style={{ borderColor: 'var(--color-app-line)', background: 'var(--color-panel-bg)' }}
    >
      <div className="flex h-20 shrink-0 items-center gap-3 border-b px-4 md:px-3 lg:px-5" style={{ borderColor: 'var(--color-app-line)' }}>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Buka menu"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-app-bg-hint)] md:hidden"
          style={{ color: 'var(--color-app-text)' }}
        >
          <Menu className="size-6" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">Percakapan</h2>
          <p className="truncate text-xs" style={{ color: 'var(--color-app-muted)' }}>
            Per orang yang memberi perintah
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 md:px-3 lg:px-5">
        {orang.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl px-4 py-5 text-center text-sm" style={{ background: 'var(--color-empty-bg)', color: 'var(--color-app-muted)' }}>
            <DuaOrang className="size-6" />
            Nama pengirim akan tampil di sini
          </div>
        )}
        <div data-tur="daftar-orang" className="flex flex-col gap-2">
        {orang.map((o) => (
          <Baris
            key={o.nama}
            aktif={pilihan === o.nama}
            onClick={() => onPilih(o.nama)}
            avatar={<Avatar nama={o.nama} size={36} />}
            judul={o.nama}
            sub={`${LABEL_PERAN[o.peran] || o.peran}${o.cabang ? ` · ${o.cabang}` : ''}`}
          />
        ))}
        </div>
      </div>
      {/* Pengganti kolom ketik: halaman ini hanya memantau. */}
      <div className="px-4 pb-4 pt-2 md:px-3 md:pb-3 lg:px-5 lg:pb-4">
        <div data-tur="kartu-pantau" className="rounded-xl border px-3.5 py-3" style={{ background: 'var(--card)', borderColor: 'var(--color-app-line)' }}>
          <div className="mb-2.5 flex size-9 items-center justify-center rounded-full" style={{ background: 'var(--color-app-bg-hint)', color: 'var(--color-app-muted)' }}>
            <Show className="size-[18px]" />
          </div>
          <div className="text-sm" style={{ color: 'var(--color-app-text)' }}>
            {direkam ? (
              <>
                <p className="font-bold">Ini rekaman sesi uji.</p>
                <p className="mt-1">Direkam {direkam}. Versi live berjalan di komputer owner dan diperbarui tiap 2 detik.</p>
              </>
            ) : (
              <>
                <p className="font-bold">Halaman ini hanya memantau.</p>
                <p className="mt-1">Kirim perintah dan balas persetujuan lewat WorkBuddy atau Slack.</p>
              </>
            )}
          </div>
          {/* Live dan replay sama: pesan yang disaring selalu disebut, tidak pernah hilang diam-diam. */}
          {disaring?.length > 0 && (
            <p className="mt-1 text-sm" style={{ color: 'var(--color-app-text)' }}>
              {disaring.length} pesan di luar skenario tidak ditampilkan. Alasannya dicatat terbuka di temuan {[...new Set(disaring.map((d) => d.temuan))].join(', ')}.
            </p>
          )}
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-app-muted)' }}>
            Semua isi dibaca dari file yang ditulis gerbang <b style={{ color: 'var(--color-app-text)' }}>catat.py</b>: permintaan, rencana, persetujuan, dan hasil. Tidak ada yang dikarang atau diubah di sini.
          </p>
          {/* Kontrol tampilan (live saja): menyembunyikan isi lama tanpa menghapus file. */}
          {onMulaiNol && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-app-line)' }}>
              {batas && (
                <p className="mb-2 text-xs" style={{ color: 'var(--color-app-muted)' }}>
                  Ditampilkan sejak {batas}.{' '}
                  {onTampilkanSemua && (
                    <button type="button" onClick={onTampilkanSemua} className="font-semibold hover:underline" style={{ color: 'var(--color-primary-text)' }}>
                      Tampilkan semua
                    </button>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={onMulaiNol}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-[var(--color-app-bg-hint)]"
                style={{ borderColor: 'var(--color-app-line)', color: 'var(--color-app-text)' }}
              >
                <RefreshLeft className="size-4" />
                Mulai dari nol
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
