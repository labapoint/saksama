import { Lampu, Monitor, Moon, Sun, X } from './Ikon.jsx'
import DashboardIcon from '../assets/nav/dashboard.svg?react'
import PosIcon from '../assets/nav/pos.svg?react'
import OrdersIcon from '../assets/nav/orders.svg?react'
import ProductsIcon from '../assets/nav/products-grp.svg?react'
import CustomersIcon from '../assets/nav/pelanggan.svg?react'
import ReportsIcon from '../assets/nav/laporan.svg?react'
import FinanceIcon from '../assets/nav/keuangan.svg?react'
import AiIcon from '../assets/nav/reports-analisa-pintar.svg?react'
import CollapseIcon from '../assets/nav/collapse.svg?react'
import ExpandIcon from '../assets/nav/expand.svg?react'
import logoWide from '../assets/logo/logo-expand.svg'
import logoWideWhite from '../assets/logo/logo-expand-white.svg'
import logoMark from '../assets/logo/logo-collapse.svg'
import logoMarkWhite from '../assets/logo/logo-collapse-white.svg'

// Menu meniru tampilan aplikasi Labapoint; hanya "AI" yang berfungsi di demo ini.
export const NAV = [
  // Grup tanpa label: Asisten AI berdiri sendiri di paling atas.
  { id: 'utama', items: [{ id: 'ai', label: 'Asisten AI', icon: AiIcon }] },
  {
    id: 'lainnya',
    label: 'Lainnya',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
      { id: 'pos', label: 'Kasir', icon: PosIcon },
      { id: 'orders', label: 'Pesanan', icon: OrdersIcon },
      { id: 'products', label: 'Produk & Stok', icon: ProductsIcon },
      { id: 'customers', label: 'Pelanggan', icon: CustomersIcon },
      { id: 'reports', label: 'Laporan', icon: ReportsIcon },
      { id: 'cash', label: 'Keuangan', icon: FinanceIcon },
    ],
  },
]

// Pilihan tema gaya PillTabs: ikut sistem (default) lebih dulu, lalu terang dan gelap.
// Vertikal di sidebar ciut, horizontal saat sidebar lebar.
const OPSI_TEMA = [
  { id: 'sistem', label: 'Ikut sistem', Icon: Monitor },
  { id: 'terang', label: 'Mode terang', Icon: Sun },
  { id: 'gelap', label: 'Mode gelap', Icon: Moon },
]

function PilihTema({ tema, onChange, horizontal }) {
  return (
    <div role="radiogroup" aria-label="Tema" className={'flex gap-1 rounded-xl border p-1 ' + (horizontal ? 'flex-row' : 'flex-col')} style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)' }}>
      {OPSI_TEMA.map(({ id, label, Icon }) => {
        const aktif = tema === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={aktif}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
            className="flex size-9 items-center justify-center rounded-lg transition-colors"
            style={aktif ? { background: 'var(--color-primary-12)', color: 'var(--color-primary-text)' } : { color: 'var(--color-app-text)' }}
          >
            <Icon className="size-5" />
          </button>
        )
      })}
    </div>
  )
}

// Logo resmi Labapoint:
// wide max 32×150px, mark 36×36px. Varian putih di mode gelap.
function Logo({ compact, dark }) {
  const src = compact ? (dark ? logoMarkWhite : logoMark) : dark ? logoWideWhite : logoWide
  return (
    <img
      src={src}
      alt="Labapoint"
      style={compact ? { width: 36, height: 36, objectFit: 'contain' } : { maxHeight: 32, maxWidth: 150 }}
    />
  )
}

function Item({ item, active, collapsed, onSelect }) {
  const Icon = item.icon
  const style = active
    ? { background: 'var(--color-sidebar-active-bg)', color: 'var(--color-sidebar-active-fg)' }
    : { color: 'var(--color-sidebar-fg)' }
  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(item.id)}
      className={
        'flex items-center rounded-md text-sm font-medium transition-colors hover:bg-[var(--color-sidebar-hover)] ' +
        (collapsed ? 'mx-auto size-10 justify-center' : 'w-full gap-3 px-3 py-2')
      }
      style={style}
    >
      <Icon className="size-5" />
      {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
      {!collapsed && item.badge && (
        <span
          className="h-5 rounded-full px-2 text-[11px] font-bold leading-5"
          style={{ background: 'var(--color-sidebar-badge-bg)', color: 'var(--color-sidebar-badge-fg)' }}
        >
          {item.badge}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ active, collapsed, onSelect, onToggle, dark, tema, onTema, onPanduan, diDrawer = false }) {
  return (
    <aside
      className={
        'group/sidebar relative flex h-full shrink-0 flex-col border-r transition-[width] duration-150 ' +
        (collapsed ? 'w-[72px]' : 'w-[240px]')
      }
      style={{ background: 'var(--color-sidebar-bg)', borderColor: 'var(--color-sidebar-border)' }}
    >
      <div
        className={
          'flex h-20 shrink-0 items-center border-b ' + (collapsed ? 'justify-center px-3' : 'justify-between px-5')
        }
        style={{ borderColor: 'var(--color-sidebar-border)' }}
      >
        <Logo compact={collapsed} dark={dark} />
        {!collapsed && (
          <button
            type="button"
            aria-label={diDrawer ? 'Tutup menu' : 'Ciutkan sidebar'}
            onClick={onToggle}
            className="rounded-md p-1.5 hover:bg-[var(--color-sidebar-hover)]"
            style={{ color: 'var(--color-sidebar-fg)' }}
          >
            {diDrawer ? <X className="size-5" /> : <CollapseIcon className="size-5" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {NAV.map((group, i) => (
          <div key={group.id} className={collapsed ? 'mb-4 px-2' : 'mb-6 px-3'}>
            {collapsed ? (
              i > 0 && <div className="mx-auto mb-2 h-px w-8" style={{ background: 'var(--color-sidebar-border)' }} />
            ) : (
              group.label && <div
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-sidebar-muted)' }}
              >
                {group.label}
              </div>
            )}
            <div className="mt-1 flex flex-col gap-1">
              {group.items.map((item) => (
                <Item key={item.id} item={item} active={active === item.id} collapsed={collapsed} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={'flex flex-col gap-2 border-t py-3 ' + (collapsed ? 'items-center px-2' : 'px-4')}
        style={{ borderColor: 'var(--color-sidebar-border)' }}
      >
        {/* Kartu yang sama dengan pemilih tema di bawahnya. */}
        <div className="rounded-xl border p-1" style={{ borderColor: 'var(--color-app-line)', background: 'var(--card)' }}>
          <button
            type="button"
            onClick={onPanduan}
            title={collapsed ? 'Lihat panduan halaman' : undefined}
            aria-label="Lihat panduan halaman"
            className={
              'flex h-9 items-center rounded-lg text-sm font-medium transition-colors hover:bg-[var(--color-app-bg-hint)] ' +
              (collapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-2.5')
            }
            style={{ color: 'var(--color-app-text)' }}
          >
            <Lampu className="size-5 shrink-0" />
            {!collapsed && <span>Lihat panduan</span>}
          </button>
        </div>
        <PilihTema tema={tema} onChange={onTema} horizontal={!collapsed} />
      </div>

      {/* Sama dengan Labapoint: tombol lebarkan menempel di perbatasan dan hanya tampak saat sidebar di-hover.
          top-[26px]: pusat tombol 28px jatuh di 40px = pusat logo dalam header 80px. */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          title="Lebarkan sidebar"
          aria-label="Lebarkan sidebar"
          aria-expanded={false}
          className="pointer-events-none absolute -right-3.5 top-[26px] z-10 flex size-7 items-center justify-center rounded-full border opacity-0 transition-opacity duration-150 group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
          style={{ background: '#ffffff', borderColor: 'var(--color-app-line)', color: '#334155', boxShadow: '0 1px 4px rgba(16, 24, 40, 0.14)' }}
        >
          <ExpandIcon className="size-4" />
        </button>
      )}
    </aside>
  )
}
