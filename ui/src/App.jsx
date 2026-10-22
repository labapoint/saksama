import { useCallback, useEffect, useState } from 'react'
import { Menu, Work } from './components/Ikon.jsx'
import Sidebar, { NAV } from './components/Sidebar.jsx'
import AiPage from './pages/AiPage.jsx'

// Tema: 'sistem' (default, ikut pengaturan perangkat), 'terang', atau 'gelap'.
function bacaTema() {
  try {
    const t = localStorage.getItem('saksama:tema')
    return t === 'terang' || t === 'gelap' ? t : 'sistem'
  } catch {
    return 'sistem'
  }
}

const MEDIA_GELAP = '(prefers-color-scheme: dark)'

function sistemGelap() {
  return window.matchMedia?.(MEDIA_GELAP).matches ?? false
}

export default function App() {
  const [active, setActive] = useState('ai')
  // Menu AI memakai mode rail (sidebar ciut) supaya percakapan dapat ruang.
  const [collapsed, setCollapsed] = useState(true)
  const [tema, setTema] = useState(bacaTema)
  const [osGelap, setOsGelap] = useState(sistemGelap)
  const dark = tema === 'gelap' || (tema === 'sistem' && osGelap)
  // Mobile (< md): sidebar disembunyikan, dibuka lewat tombol burger sebagai drawer.
  const [menuTerbuka, setMenuTerbuka] = useState(false)
  // Tombol lampu di sidebar menyalakan permintaan ini; halaman AI memutar panduan lalu mengosongkannya.
  const [mintaPanduan, setMintaPanduan] = useState(false)
  const panduanDiterima = useCallback(() => setMintaPanduan(false), [])

  // Ikuti perubahan tema perangkat selagi halaman terbuka.
  useEffect(() => {
    const mq = window.matchMedia?.(MEDIA_GELAP)
    if (!mq) return
    const ubah = (e) => setOsGelap(e.matches)
    mq.addEventListener('change', ubah)
    return () => mq.removeEventListener('change', ubah)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    try {
      localStorage.setItem('saksama:tema', tema)
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [tema])

  function select(id) {
    setActive(id)
    setCollapsed(id === 'ai')
    setMenuTerbuka(false)
  }

  useEffect(() => {
    if (!menuTerbuka) return
    const tekan = (e) => e.key === 'Escape' && setMenuTerbuka(false)
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [menuTerbuka])

  const sidebar = {
    active,
    onSelect: select,
    dark,
    tema,
    onTema: setTema,
    onPanduan: () => {
      select('ai')
      setMintaPanduan(true)
    },
  }

  return (
    <div className="flex h-full">
      <div className="hidden h-full md:flex">
        <Sidebar {...sidebar} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {menuTerbuka && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuTerbuka(false)} aria-hidden="true" />
          <div className="relative h-full animate-[geser-masuk-kiri_180ms_ease-out] shadow-xl">
            <Sidebar {...sidebar} collapsed={false} onToggle={() => setMenuTerbuka(false)} diDrawer />
          </div>
        </div>
      )}
      <main className="h-full min-w-0 flex-1 overflow-hidden">
        {active === 'ai' ? <AiPage onMenu={() => setMenuTerbuka(true)} mintaPanduan={mintaPanduan} onPanduanDiterima={panduanDiterima} /> : <Placeholder id={active} onMenu={() => setMenuTerbuka(true)} />}
      </main>
    </div>
  )
}

function Placeholder({ id, onMenu }) {
  const item = NAV.flatMap((g) => g.items).find((i) => i.id === id)
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Buka menu"
          className="-ml-2 flex size-10 items-center justify-center rounded-lg hover:bg-[var(--color-app-bg-hint)] md:hidden"
        >
          <Menu className="size-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{item?.label}</h1>
      </div>
      <div
        className="mt-6 flex items-center gap-3 rounded-xl border p-6 text-sm"
        style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)', color: 'var(--color-app-muted)' }}
      >
        <Work className="size-5" />
        Halaman ini hanya tampilan demo. Buka menu Asisten AI untuk melihat agent bekerja.
      </div>
    </div>
  )
}
