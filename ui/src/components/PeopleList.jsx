import { Eye } from 'lucide-react'
import Avatar from './Avatar.jsx'

const LABEL_PERAN = {
  owner: 'Owner',
  kepala_cabang: 'Kepala cabang',
  kasir: 'Kasir',
  admin_gudang: 'Admin gudang',
  reseller: 'Reseller',
  'tidak dikenal': 'Tidak terdaftar',
}

function Baris({ aktif, onClick, avatar, judul, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktif ? 'true' : undefined}
      className={'flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors ' + (aktif ? '' : 'hover:bg-[var(--card)]')}
      style={aktif ? { background: 'var(--color-primary-12)', borderColor: 'transparent' } : { borderColor: 'var(--color-app-line)' }}
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

export default function PeopleList({ orang, pilihan, onPilih }) {
  return (
    <aside
      className="hidden w-[280px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: 'var(--color-app-line)', background: 'var(--color-panel-bg)' }}
    >
      <div className="flex h-20 shrink-0 flex-col justify-center border-b px-4" style={{ borderColor: 'var(--color-app-line)' }}>
        <h2 className="text-lg font-bold tracking-tight">Percakapan</h2>
        <p className="text-xs" style={{ color: 'var(--color-app-muted)' }}>
          Per orang yang memberi perintah
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
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
      {/* Pengganti kolom ketik: halaman ini hanya memantau. */}
      <div className="px-4 pb-4 pt-2">
        <div className="rounded-xl border px-3.5 py-3" style={{ background: 'var(--card)', borderColor: 'var(--color-app-line)' }}>
          <div className="mb-2.5 flex size-9 items-center justify-center rounded-full" style={{ background: 'var(--color-app-bg-hint)', color: 'var(--color-app-muted)' }}>
            <Eye className="size-[18px]" />
          </div>
          <div className="text-sm" style={{ color: 'var(--color-app-text)' }}>
            <p className="font-bold">Halaman ini hanya memantau.</p>
            <p className="mt-1">Kirim perintah dan balas persetujuan lewat WorkBuddy atau Slack.</p>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-app-muted)' }}>
            Semua isi dibaca dari file yang ditulis gerbang <b style={{ color: 'var(--color-app-text)' }}>catat.py</b>: permintaan, rencana, persetujuan, dan hasil. Tidak ada yang dikarang atau diubah di sini.
          </p>
        </div>
      </div>
    </aside>
  )
}
