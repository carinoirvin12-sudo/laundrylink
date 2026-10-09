
import { Link } from 'react-router-dom'

function Landing() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <nav className="mx-auto flex max-w-7xl items-center px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950">
            L
          </div>

          <div>
            <p className="text-xl font-bold">
              LaundryLink
            </p>
            <p className="text-xs text-slate-400">
              Laundry Management System
            </p>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        {/* HERO TEXT */}
        <div>
          <span className="inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300">
            Simple. Organized. Connected.
          </span>

          <h1 className="mt-7 max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">
            Manage your laundry shop
            <span className="text-cyan-400">
              {' '}without the mess.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Track customer orders, laundry services,
            machines, payments, pickups, and revenue
            from one organized system.
          </p>

          {/* SINGLE DASHBOARD BUTTON */}
          <div className="mt-9">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-7 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Go to Dashboard
              <span className="ml-3" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Orders', 'Track every laundry order'],
            ['Machines', 'Know machine availability'],
            ['Payments', 'Monitor customer balances'],
            ['Reports', 'View revenue and activity'],
          ].map(([title, description]) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="mb-6 h-2 w-12 rounded-full bg-cyan-400" />

              <h2 className="text-xl font-bold">
                {title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default Landing
