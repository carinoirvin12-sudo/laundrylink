
import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom'

import ThemeToggle from '../components/ThemeToggle'

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '▦' },
  { label: 'Orders', path: '/orders', icon: '▤' },
  { label: 'Customers', path: '/customers', icon: '♟' },
  { label: 'Machines', path: '/machines', icon: '◉' },
  { label: 'Services', path: '/services', icon: '✦' },
  { label: 'Overdue Pickups', path: '/overdue', icon: '!' },
  { label: 'Reports', path: '/reports', icon: '▥' },
]

function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-[#0B1220]">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-950 text-white lg:flex dark:bg-[#070D19]">

        {/* LOGO + THEME TOGGLE */}
        <div className="flex h-24 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-lg font-black text-slate-950">
              L
            </div>

            <div className="min-w-0">
              <h1 className="text-base font-bold text-white">
                LaundryLink
              </h1>

              <p className="text-[10px] text-slate-400">
                Management System
              </p>
            </div>
          </div>

          {/* DESKTOP THEME TOGGLE */}
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>

        {/* SIDEBAR NAVIGATION */}
        <nav className="flex-1 space-y-2 px-4 py-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 dark:bg-cyan-400 dark:text-slate-950'
                    : 'text-slate-200 hover:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <span className="w-5 text-center">
                {item.icon}
              </span>

              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-bold text-white">
              LaundryLink
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Laundry shop order, machine,
              customer, and payment management.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="lg:pl-64">

        {/* HEADER */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white transition-colors duration-200 dark:border-slate-700 dark:bg-[#111C2E]">
          <div className="flex min-h-20 items-center justify-between gap-4 px-6 lg:px-10">

            {/* HEADER TITLE */}
            <div>
              <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                Laundry Management
              </p>

              <p className="hidden text-sm text-slate-500 sm:block dark:text-slate-300">
                Manage your shop from one place.
              </p>
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-3">

              {/* MOBILE THEME TOGGLE */}
              <div className="lg:hidden">
                <ThemeToggle />
              </div>

              <button
                type="button"
                onClick={() => navigate('/orders/new')}
                className="shrink-0 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white transition hover:bg-cyan-600 sm:px-5 sm:text-sm dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
              >
                + New Laundry Order
              </button>
            </div>
          </div>
        </header>

        {/* MOBILE NAV */}
        <div className="overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 transition-colors duration-200 lg:hidden dark:border-slate-700 dark:bg-[#111C2E]">
          <div className="flex min-w-max gap-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 dark:bg-cyan-400 dark:text-slate-950'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* PAGE CONTENT */}
        <main className="p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
