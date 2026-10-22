import { useEffect, useState } from 'react'
import { Construction } from 'lucide-react'
import Sidebar, { NAV } from './components/Sidebar.jsx'
import AiPage from './pages/AiPage.jsx'

function readDark() {
  try {
    return localStorage.getItem('saksama:dark') === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [active, setActive] = useState('ai')
  // Menu AI memakai mode rail (sidebar ciut) supaya percakapan dapat ruang.
  const [collapsed, setCollapsed] = useState(true)
  const [dark, setDark] = useState(readDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('saksama:dark', dark ? '1' : '0')
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [dark])

  function select(id) {
    setActive(id)
    setCollapsed(id === 'ai')
  }

  return (
    <div className="flex h-full">
      <Sidebar
        active={active}
        collapsed={collapsed}
        onSelect={select}
        onToggle={() => setCollapsed((c) => !c)}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
      />
      <main className="h-full min-w-0 flex-1 overflow-hidden">{active === 'ai' ? <AiPage /> : <Placeholder id={active} />}</main>
    </div>
  )
}

function Placeholder({ id }) {
  const item = NAV.flatMap((g) => g.items).find((i) => i.id === id)
  return (
    <div className="px-8 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{item?.label}</h1>
      <div
        className="mt-6 flex items-center gap-3 rounded-xl border p-6 text-sm"
        style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)', color: 'var(--color-app-muted)' }}
      >
        <Construction className="size-5" />
        Halaman ini hanya tampilan demo. Buka menu Asisten AI untuk melihat agent bekerja.
      </div>
    </div>
  )
}
