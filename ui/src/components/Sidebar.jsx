import { Sun, Moon } from 'lucide-react'
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
  {
    label: 'Utama',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
      { id: 'ai', label: 'Asisten AI', icon: AiIcon, badge: 'Baru' },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { id: 'pos', label: 'Kasir', icon: PosIcon },
      { id: 'orders', label: 'Pesanan', icon: OrdersIcon },
      { id: 'products', label: 'Produk & Stok', icon: ProductsIcon },
      { id: 'customers', label: 'Pelanggan', icon: CustomersIcon },
      { id: 'reports', label: 'Laporan', icon: ReportsIcon },
      { id: 'cash', label: 'Keuangan', icon: FinanceIcon },
    ],
  },
]

// Logo resmi Labapoint:
// wide max 32×150px, mark 32×32px. Varian putih di mode gelap.
function Logo({ compact, dark }) {
  const src = compact ? (dark ? logoMarkWhite : logoMark) : dark ? logoWideWhite : logoWide
  return (
    <img
      src={src}
      alt="Labapoint"
      style={compact ? { width: 32, height: 32, objectFit: 'contain' } : { maxHeight: 32, maxWidth: 150 }}
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
      <Icon className={collapsed ? 'size-[22px]' : 'size-[18px]'} />
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

export default function Sidebar({ active, collapsed, onSelect, onToggle, dark, onToggleDark }) {
  return (
    <aside
      className={
        'flex h-full shrink-0 flex-col border-r transition-[width] duration-150 ' +
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
            aria-label="Ciutkan sidebar"
            onClick={onToggle}
            className="rounded-md p-1.5 hover:bg-[var(--color-sidebar-hover)]"
            style={{ color: 'var(--color-sidebar-muted)' }}
          >
            <CollapseIcon className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {NAV.map((group) => (
          <div key={group.label} className={collapsed ? 'mb-4 px-2' : 'mb-6 px-3'}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-8" style={{ background: 'var(--color-sidebar-border)' }} />
            ) : (
              <div
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
        className={'flex gap-1 border-t py-3 ' + (collapsed ? 'flex-col items-center px-2' : 'px-3')}
        style={{ borderColor: 'var(--color-sidebar-border)' }}
      >
        <button
          type="button"
          aria-label={dark ? 'Mode terang' : 'Mode gelap'}
          onClick={onToggleDark}
          className="flex size-10 items-center justify-center rounded-md hover:bg-[var(--color-sidebar-hover)]"
          style={{ color: 'var(--color-sidebar-fg)' }}
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        {collapsed && (
          <button
            type="button"
            aria-label="Lebarkan sidebar"
            onClick={onToggle}
            className="flex size-10 items-center justify-center rounded-md hover:bg-[var(--color-sidebar-hover)]"
            style={{ color: 'var(--color-sidebar-fg)' }}
          >
            <ExpandIcon className="size-[18px]" />
          </button>
        )}
      </div>
    </aside>
  )
}
