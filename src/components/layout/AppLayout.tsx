import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logoMark from '../../assets/logo/logo-mark.png'

const WIDE_PATHS = ['/orders/new']

const NAV_ITEMS = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/orders', label: 'Заказы' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/materials', label: 'Склад сырья' },
  { to: '/products', label: 'Склад продукции' },
  { to: '/suppliers', label: 'Поставщики' },
  { to: '/employees', label: 'Сотрудники' },
  { to: '/finance', label: 'Финансы' },
  { to: '/production-settings', label: 'Настройки производства' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isWide = WIDE_PATHS.includes(pathname)

  return (
    <div className="min-h-screen flex flex-col bg-brand-gray">
      <header className="sticky top-0 z-30 bg-brand-black text-white">
        <div className="flex items-center gap-5 h-14 pl-2 pr-3 md:pl-3 md:pr-6">
          <img src={logoMark} alt="EnzoPack" className="h-10 w-auto shrink-0 object-contain" />
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-brand-yellow text-white'
                      : 'border-transparent text-white/60 hover:text-white/90'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className={`flex-1 p-4 md:p-8 w-full mx-auto ${isWide ? 'max-w-[1600px]' : 'max-w-6xl'}`}>{children}</main>
    </div>
  )
}
