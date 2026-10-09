
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import api from '../../services/api'

type OrderStatus =
  | 'received'
  | 'washing'
  | 'drying'
  | 'folding'
  | 'ready'
  | 'claimed'
  | 'cancelled'

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
    drying?: number
    folding?: number
    ready: number
    claimed: number
    cancelled: number
    overdue: number
  }
  revenue: {
    total: number
  }
}

type Service = {
  _id: string
  name: string
}

type Order = {
  _id: string
  status: OrderStatus
  service: Service | string | null
  dueDate: string
  createdAt: string
}

type Machine = {
  _id: string
  name: string
  type: 'washer' | 'dryer'
  status: 'active' | 'maintenance'
  isBusy?: boolean
  isAvailable?: boolean
  availabilityStatus?: string
}

type OrderCounts = Record<OrderStatus, number> & {
  total: number
  active: number
}

const PRIORITY: Record<string, number> = {
  'Standard Laundry': 1,
  'Priority Laundry': 2,
  'Express Laundry': 3,
}

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(amount) || 0)

const formatDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const getServiceName = (
  service: Service | string | null
) => {
  if (
    !service ||
    typeof service === 'string'
  ) {
    return 'Unknown Service'
  }

  return service.name
}

const getPriority = (order: Order) =>
  PRIORITY[getServiceName(order.service)] || 1

const getErrorMessage = (
  error: unknown,
  fallback: string
) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message

    if (typeof message === 'string') {
      return message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function Dashboard() {
  const [stats, setStats] =
    useState<Stats | null>(null)

  const [orders, setOrders] =
    useState<Order[]>([])

  const [machines, setMachines] =
    useState<Machine[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')

  const [machineError, setMachineError] =
    useState(false)

  // ==========================================
  // LOAD DASHBOARD DATA
  // ==========================================

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')
        setMachineError(false)

        const [
          statsResponse,
          ordersResponse,
        ] = await Promise.all([
          api.get<Stats>('/stats/summary'),
          api.get<Order[]>('/orders'),
        ])

        const orderData =
          Array.isArray(ordersResponse.data)
            ? ordersResponse.data
            : []

        setStats(statsResponse.data)
        setOrders(orderData)

        try {
          const machineResponse =
            await api.get<Machine[]>(
              '/machines/availability'
            )

          if (!Array.isArray(machineResponse.data)) {
            throw new Error(
              'Invalid machine availability response'
            )
          }

          setMachines(machineResponse.data)
        } catch {
          setMachines([])
          setMachineError(true)
        }
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Unable to load dashboard. Check your backend connection.'
          )
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // ==========================================
  // ORDER COUNTS
  // ==========================================

  const counts = useMemo<OrderCounts>(() => {
    const result: OrderCounts = {
      total: orders.length,
      active: 0,
      received: 0,
      washing: 0,
      drying: 0,
      folding: 0,
      ready: 0,
      claimed: 0,
      cancelled: 0,
    }

    for (const order of orders) {
      if (order.status in result) {
        result[order.status] += 1
      }
    }

    result.active =
      result.received +
      result.washing +
      result.drying +
      result.folding +
      result.ready

    return result
  }, [orders])

  // ==========================================
  // MACHINE COUNTS
  // ==========================================

  const machineCounts = useMemo(() => {
    let available = 0
    let inUse = 0
    let maintenance = 0

    for (const machine of machines) {
      if (machine.status === 'maintenance') {
        maintenance += 1
        continue
      }

      if (
        machine.isBusy === true ||
        machine.availabilityStatus === 'in-use'
      ) {
        inUse += 1
        continue
      }

      if (
        machine.isAvailable === true ||
        machine.availabilityStatus === 'available'
      ) {
        available += 1
      }
    }

    return {
      total: machines.length,
      available,
      inUse,
      maintenance,
    }
  }, [machines])

  // ==========================================
  // PRIORITY QUEUE
  // ==========================================

  const waitingOrders = useMemo(() => {
    return orders
      .filter(
        (order) =>
          order.status === 'received'
      )
      .sort((a, b) => {
        const priorityDifference =
          getPriority(b) - getPriority(a)

        if (priorityDifference !== 0) {
          return priorityDifference
        }

        const timeDifference =
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()

        if (timeDifference !== 0) {
          return timeDifference
        }

        return a._id.localeCompare(b._id)
      })
      .slice(0, 5)
  }, [orders])

  // ==========================================
  // OVERDUE PROCESSING
  // Separate from overdue pickups.
  // ==========================================

  const overdueProcessing = useMemo(() => {
    const now = Date.now()

    return orders.filter((order) => {
      if (
        order.status === 'ready' ||
        order.status === 'claimed' ||
        order.status === 'cancelled'
      ) {
        return false
      }

      const dueDate =
        new Date(order.dueDate).getTime()

      return (
        Number.isFinite(dueDate) &&
        dueDate < now
      )
    }).length
  }, [orders])

  // ==========================================
  // LOADING / ERROR
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-slate-500">
          Loading dashboard...
        </p>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-bold text-red-700">
          Dashboard Unavailable
        </h2>

        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>

        <button
          type="button"
          onClick={() =>
            void loadDashboard()
          }
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  // ==========================================
  // SUMMARY CARDS
  // ==========================================

  const cards = [
    {
      label: 'Total Orders',
      value: counts.total,
      detail: `${counts.active} active orders`,
    },
    {
      label: 'Customers',
      value: stats.customers.total,
      detail: 'Registered customers',
    },
    {
      label: 'Available Machines',
      value: machineError
        ? '—'
        : machineCounts.available,
      detail: machineError
        ? 'Availability unavailable'
        : `${machineCounts.inUse} in use · ${machineCounts.maintenance} maintenance`,
    },
    {
      label: 'Total Revenue',
      value: money(stats.revenue.total),
      detail: 'Recorded payments',
    },
  ]

  const orderStatuses = [
    {
      label: 'Received',
      value: counts.received,
      style: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Washing',
      value: counts.washing,
      style: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Drying',
      value: counts.drying,
      style: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Folding',
      value: counts.folding,
      style: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Ready for Pickup',
      value: counts.ready,
      style: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Claimed',
      value: counts.claimed,
      style: 'bg-green-50 text-green-700',
    },
    {
      label: 'Cancelled',
      value: counts.cancelled,
      style: 'bg-red-50 text-red-700',
    },
  ]

  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600">
            Laundry Management
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Full-service laundry operations,
            priority queues, equipment usage,
            and payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/orders/new"
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
          >
            + New Order
          </Link>

          <button
            type="button"
            onClick={() =>
              void loadDashboard(true)
            }
            disabled={refreshing}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ERROR ON REFRESH */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
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

      {/* ORDER STATUS */}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Laundry Workflow
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current order counts for each
            processing stage.
          </p>

          <div className="mt-5 space-y-3">
            {orderStatuses.map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${item.style}`}
              >
                <span className="text-sm font-semibold">
                  {item.label}
                </span>

                <span className="text-lg font-black">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <Link
            to="/orders"
            className="mt-5 inline-block text-sm font-bold text-cyan-700 hover:underline"
          >
            View All Orders →
          </Link>
        </article>

        {/* PRIORITY QUEUE */}

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Priority Queue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Orders waiting for a washer.
              </p>
            </div>

            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">
              {counts.received} Waiting
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Express → Priority → Standard.
            Oldest orders first within each tier.
          </p>

          {waitingOrders.length === 0 ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center">
              <p className="font-semibold text-slate-700">
                Queue is Empty
              </p>

              <p className="mt-1 text-sm text-slate-500">
                No laundry orders are waiting
                to start washing.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {waitingOrders.map((order, index) => {
                const serviceName =
                  getServiceName(order.service)

                const priority =
                  getPriority(order)

                const priorityStyle =
                  priority === 3
                    ? 'bg-purple-100 text-purple-700'
                    : priority === 2
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'

                return (
                  <Link
                    key={order._id}
                    to={`/orders/${order._id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        #
                        {order._id
                          .slice(-8)
                          .toUpperCase()}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {serviceName}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Received:{' '}
                        {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${priorityStyle}`}
                    >
                      {priority === 3
                        ? 'Express'
                        : priority === 2
                          ? 'Priority'
                          : 'Standard'}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}

          <Link
            to="/orders"
            className="mt-5 inline-block text-sm font-bold text-cyan-700 hover:underline"
          >
            Open Orders →
          </Link>
        </article>
      </section>

      {/* EQUIPMENT STATUS */}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Equipment Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Washers are occupied during Washing.
              Dryers are occupied during Drying.
            </p>
          </div>

          <Link
            to="/machines"
            className="text-sm font-bold text-cyan-700 hover:underline"
          >
            Manage Machines →
          </Link>
        </div>

        {machineError ? (
          <p className="mt-5 text-sm text-amber-700">
            Machine availability could not
            be loaded.
          </p>
        ) : machines.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">
            No machines configured yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {machines.map((machine) => {
              const isMaintenance =
                machine.status ===
                'maintenance'

              const isBusy =
                machine.isBusy === true ||
                machine.availabilityStatus ===
                  'in-use'

              const label = isMaintenance
                ? 'Maintenance'
                : isBusy
                  ? 'In Use'
                  : 'Available'

              const style = isMaintenance
                ? 'bg-red-100 text-red-700'
                : isBusy
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'

              return (
                <div
                  key={machine._id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-bold text-slate-900">
                    {machine.name}
                  </p>

                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {machine.type}
                  </p>

                  <span
                    className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${style}`}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ATTENTION NEEDED */}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Attention Needed
          </h2>

          <div className="mt-5 rounded-xl bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-700">
              Overdue Pickups
            </p>

            <p className="mt-2 text-4xl font-black text-amber-900">
              {stats.orders.overdue}
            </p>

            <p className="mt-2 text-sm text-amber-700">
              Ready orders that have
              passed their due date.
            </p>

            <Link
              to="/overdue"
              className="mt-4 inline-block text-sm font-bold text-amber-900 underline"
            >
              View Overdue Orders
            </Link>
          </div>

          <div className="mt-4 rounded-xl bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">
              Overdue Processing
            </p>

            <p className="mt-2 text-4xl font-black text-red-900">
              {overdueProcessing}
            </p>

            <p className="mt-2 text-sm text-red-700">
              Orders still being processed
              after their target due date.
            </p>
          </div>
        </article>

        {/* SERVICES */}

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Service Overview
          </h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">
                Active Services
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {stats.services.active}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">
                Inactive Services
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {stats.services.inactive}
              </p>
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
              All LaundryLink packages
              include Wash + Dry + Fold.

              <p className="mt-2">
                Standard: 24 hours<br />
                Priority: 12 hours<br />
                Express: 6 hours
              </p>
            </div>
          </div>

          <Link
            to="/services"
            className="mt-5 inline-block text-sm font-bold text-cyan-700 hover:underline"
          >
            Manage Services →
          </Link>
        </article>
      </section>
    </div>
  )
}

export default Dashboard
