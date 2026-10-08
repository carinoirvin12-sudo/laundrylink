
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

type Stats = {
  customers: {
    total: number
  }
  services: {
    total: number
    active: number
    inactive: number
  }
  machines: {
    total: number
    active: number
    maintenance: number
  }
  orders: {
    total: number
    received: number
    washing: number
    ready: number
    claimed: number
    cancelled: number
    overdue: number
  }
  revenue: {
    total: number
  }
}

type Machine = {
  _id: string
  status: 'active' | 'maintenance'
  isBusy?: boolean
  isAvailable?: boolean
  availabilityStatus?: string
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [availableMachines, setAvailableMachines] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [machineError, setMachineError] = useState(false)

  const loadStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')
      setMachineError(false)

      const statsResponse = await api.get<Stats>('/stats/summary')

      setStats(statsResponse.data)

      try {
        const machineResponse = await api.get('/machines/availability')

        const data = machineResponse.data


        const machines: Machine[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.machines)
            ? data.machines
            : (() => {
              throw new Error('Invalid machine availability response')
            })()


        const available = machines.filter((machine) => {
          if (typeof machine.isAvailable === 'boolean') {
            return machine.isAvailable
          }

          if (machine.availabilityStatus) {
            return (
              machine.availabilityStatus.toLowerCase() === 'available'
            )
          }

          return (
            machine.status === 'active' &&
            !machine.isBusy
          )
        }).length

        setAvailableMachines(available)

      } catch {
        setAvailableMachines(null)
        setMachineError(true)
      }

    } catch {
      setStats(null)
      setAvailableMachines(null)
      setError(
        'Unable to load dashboard. Please check your backend connection.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-slate-500">
          Loading dashboard...
        </p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-bold text-red-700">
          Dashboard unavailable
        </h2>

        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>

        <button
          type="button"
          onClick={() => void loadStats()}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  const cards = [
    {
      label: 'Total Orders',
      value: stats.orders.total,
      detail: `${stats.orders.washing} currently washing`,
    },
    {
      label: 'Customers',
      value: stats.customers.total,
      detail: 'Registered customers',
    },
    {
      label: 'Available Machines',
      value:
        availableMachines === null
          ? '—'
          : availableMachines,
      detail: machineError
        ? 'Machine availability unavailable'
        : `${stats.machines.maintenance} under maintenance`,
    },
    {
      label: 'Total Revenue',
      value: `₱${stats.revenue.total.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      detail: 'Recorded payments',
    },
  ]

  const orderStatuses = [
    { label: 'Received', value: stats.orders.received },
    { label: 'Washing', value: stats.orders.washing },
    { label: 'Ready for Pickup', value: stats.orders.ready },
    { label: 'Claimed', value: stats.orders.claimed },
    { label: 'Cancelled', value: stats.orders.cancelled },
  ]

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Overview of your LaundryLink operations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadStats(true)}
          disabled={refreshing}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <p className="text-sm font-medium text-slate-500">
              {card.label}
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {card.value}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              {card.detail}
            </p>
          </article>
        ))}
      </section>

      {/* ORDER STATUS + ATTENTION */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Order Status
          </h2>

          <div className="mt-5 space-y-3">
            {orderStatuses.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-600">
                  {item.label}
                </span>

                <span className="font-bold text-slate-950">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Attention Needed
          </h2>

          <div className="mt-5 rounded-2xl bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-700">
              Overdue Pickups
            </p>

            <p className="mt-2 text-4xl font-black text-amber-900">
              {stats.orders.overdue}
            </p>

            <p className="mt-2 text-sm text-amber-700">
              Ready orders that have passed their due date.
            </p>

            <Link
              to="/overdue"
              className="mt-5 inline-block text-sm font-bold text-amber-900 underline"
            >
              View overdue orders
            </Link>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-5">
            <p className="font-semibold text-slate-700">
              Services
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {stats.services.active} active ·{' '}
              {stats.services.inactive} inactive
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}

export default Dashboard
