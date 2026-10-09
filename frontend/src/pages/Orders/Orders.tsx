
import { useCallback, useEffect, useMemo, useState } from 'react'
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

type FilterStatus = OrderStatus | 'active' | 'all'

type Customer = {
  _id: string
  fullName: string
  phone: string
}

type Service = {
  _id: string
  name: string
}

type Machine = {
  _id: string
  name: string
}

type Order = {
  _id: string
  customer: Customer | string | null
  service: Service | string | null
  machine?: Machine | string | null
  washer?: Machine | string | null
  dryer?: Machine | string | null
  weightKg: number
  totalPrice: number
  status: OrderStatus
  dueDate: string
  createdAt: string
}

const PAGE_SIZE = 5

const ACTIVE_STATUSES: OrderStatus[] = [
  'received',
  'washing',
  'drying',
  'folding',
  'ready',
]

const STATUS_STYLES: Record<OrderStatus, string> = {
  received:
    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  washing:
    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  drying:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  folding:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  ready:
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  claimed:
    'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled:
    'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const PRIORITY_NAMES: Record<string, number> = {
  'Standard Laundry': 1,
  'Priority Laundry': 2,
  'Express Laundry': 3,
}

function getName(
  value: Customer | Service | Machine | string | null | undefined
): string {
  if (!value || typeof value === 'string') {
    return '—'
  }

  if ('fullName' in value) {
    return value.fullName
  }

  return value.name
}

function getPhone(value: Customer | string | null): string {
  if (!value || typeof value === 'string') {
    return ''
  }

  return value.phone || ''
}

function getServicePriority(
  value: Service | string | null
): number {
  return PRIORITY_NAMES[getName(value)] || 1
}

function getPriorityLabel(
  value: Service | string | null
): string {
  const priority = getServicePriority(value)

  if (priority === 3) return 'Express'
  if (priority === 2) return 'Priority'

  return 'Standard'
}

function money(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value) || 0)
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isOverdue(order: Order): boolean {
  if (
    order.status === 'claimed' ||
    order.status === 'cancelled'
  ) {
    return false
  }

  const dueTime = new Date(order.dueDate).getTime()

  return !Number.isNaN(dueTime) && dueTime < Date.now()
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return typeof message === 'string' ? message : fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('active')
  const [currentPage, setCurrentPage] = useState(1)

  // FETCH ORDERS
  const loadOrders = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      const response = await api.get('/orders')
      const data = response.data

      const records: Order[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.orders)
          ? data.orders
          : []

      setOrders(records)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to load orders. Make sure the backend is running.'
        )
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  // DELETE ORDER
  const deleteOrder = async (order: Order) => {
    if (deletingId) return

    if (!['received', 'cancelled'].includes(order.status)) {
      setError(
        'Only received or cancelled orders can be deleted.'
      )
      setSuccess('')
      return
    }

    const confirmed = window.confirm(
      `Delete order #${order._id.slice(-8).toUpperCase()}?\n\n` +
        'This action cannot be undone. Orders with recorded payments cannot be deleted.'
    )

    if (!confirmed) return

    try {
      setDeletingId(order._id)
      setError('')
      setSuccess('')

      await api.delete(`/orders/${order._id}`)

      setOrders((previous) =>
        previous.filter((item) => item._id !== order._id)
      )

      setSuccess(
        `Order #${order._id.slice(-8).toUpperCase()} deleted successfully.`
      )

      await loadOrders(true)
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to delete order.')
      )
    } finally {
      setDeletingId(null)
    }
  }

  // STATUS COUNTS
  const counts = useMemo(() => {
    const results: Record<OrderStatus, number> = {
      received: 0,
      washing: 0,
      drying: 0,
      folding: 0,
      ready: 0,
      claimed: 0,
      cancelled: 0,
    }

    for (const order of orders) {
      if (order.status in results) {
        results[order.status] += 1
      }
    }

    return {
      ...results,
      all: orders.length,
      active: ACTIVE_STATUSES.reduce(
        (sum, status) => sum + results[status],
        0
      ),
    }
  }, [orders])

  const filters: {
    label: string
    value: FilterStatus
    count: number
  }[] = [
    { label: 'Active', value: 'active', count: counts.active },
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Received', value: 'received', count: counts.received },
    { label: 'Washing', value: 'washing', count: counts.washing },
    { label: 'Drying', value: 'drying', count: counts.drying },
    { label: 'Folding', value: 'folding', count: counts.folding },
    { label: 'Ready', value: 'ready', count: counts.ready },
    { label: 'Claimed', value: 'claimed', count: counts.claimed },
    { label: 'Cancelled', value: 'cancelled', count: counts.cancelled },
  ]

  // FILTER, SEARCH, AND SORT
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()

    return orders
      .filter((order) => {
        if (filter === 'all') return true

        if (filter === 'active') {
          return ACTIVE_STATUSES.includes(order.status)
        }

        return order.status === filter
      })
      .filter((order) => {
        if (!query) return true

        const searchableText = [
          order._id,
          getName(order.customer),
          getPhone(order.customer),
          getName(order.service),
          getName(order.washer),
          getName(order.dryer),
          getName(order.machine),
          getPriorityLabel(order.service),
          order.status,
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(query)
      })
      .sort((a, b) => {
        if (
          filter === 'received' ||
          (filter === 'active' &&
            a.status === 'received' &&
            b.status === 'received')
        ) {
          if (
            a.status === 'received' &&
            b.status === 'received'
          ) {
            const priorityDifference =
              getServicePriority(b.service) -
              getServicePriority(a.service)

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
          }
        }

        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        )
      })
  }, [orders, filter, search])

  // PAGINATION
  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PAGE_SIZE)
  )

  const safePage = Math.min(currentPage, totalPages)

  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE

    return filteredOrders.slice(start, start + PAGE_SIZE)
  }, [filteredOrders, safePage])

  const showingFrom =
    filteredOrders.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1

  const showingTo = Math.min(
    safePage * PAGE_SIZE,
    filteredOrders.length
  )

  const handleFilterChange = (value: FilterStatus) => {
    setFilter(value)
    setCurrentPage(1)
    setError('')
    setSuccess('')
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const summaryCards = [
    {
      label: 'Active Orders',
      value: counts.active,
      detail: 'Orders still being processed or awaiting pickup',
    },
    {
      label: 'Washing',
      value: counts.washing,
      detail: 'Currently using washers',
    },
    {
      label: 'Drying',
      value: counts.drying,
      detail: 'Currently using dryers',
    },
    {
      label: 'Ready for Pickup',
      value: counts.ready,
      detail: 'Waiting for customers',
    },
  ]

  return (
    <div className="min-w-0 space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
          Transactions
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
          Laundry Orders
        </h1>

        <p className="mt-2 text-slate-500 dark:text-slate-300">
          Track priority queues, machine assignments, and customer pickups.
        </p>
      </div>

      {/* MESSAGES */}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
        >
          <p className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void loadOrders(true)}
            className="text-sm font-bold text-red-700 underline dark:text-red-300"
          >
            Try Again
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
        >
          {success}
        </div>
      )}

      {/* SUMMARY */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
              {card.label}
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
              {card.value}
            </p>

            <p className="mt-1 text-xs text-slate-400 dark:text-slate-300">
              {card.detail}
            </p>
          </article>
        ))}
      </section>

      {/* ORDER LIST */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {/* FILTERS */}
        <div className="border-b border-slate-200 p-4 sm:p-5 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => {
              const selected = filter === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleFilterChange(item.value)}
                  aria-pressed={selected}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    selected
                      ? 'bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {item.label}{' '}
                  <span
                    className={
                      selected
                        ? 'opacity-90'
                        : 'text-slate-400 dark:text-slate-300'
                    }
                  >
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* SEARCH */}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
              placeholder="Search customer, phone, service, machine..."
              aria-label="Search orders"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />

            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing}
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-900 dark:bg-slate-700 dark:text-cyan-300"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* LIST HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Order Records
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              View and manage laundry transactions
            </p>
          </div>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {filteredOrders.length} matching orders
          </span>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-300">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-700">
              🧺
            </div>

            <h2 className="font-bold text-slate-900 dark:text-white">
              No orders found
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              {orders.length === 0
                ? 'There are no laundry transactions yet.'
                : 'Try another search term or status filter.'}
            </p>

            {orders.length === 0 && (
              <Link
                to="/orders/new"
                className="mt-5 inline-flex rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-600"
              >
                Create First Order
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* COMPACT ORDER CARDS */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginatedOrders.map((order) => {
                const washer = order.washer || order.machine
                const canDelete =
                  order.status === 'received' ||
                  order.status === 'cancelled'

                return (
                  <article
                    key={order._id}
                    className="p-4 transition hover:bg-slate-50 sm:p-5 dark:hover:bg-slate-700/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* MAIN INFORMATION */}
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/orders/${order._id}`}
                            className="font-bold text-slate-950 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400"
                          >
                            #{order._id.slice(-8).toUpperCase()}
                          </Link>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status]}`}
                          >
                            {order.status}
                          </span>

                          {isOverdue(order) && (
                            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 dark:bg-red-950 dark:text-red-300">
                              Overdue
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {getName(order.customer)}
                          </p>

                          <span className="text-xs text-slate-500 dark:text-slate-300">
                            {getPhone(order.customer) || 'No phone'}
                          </span>
                        </div>

                        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                              Service
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                              {getName(order.service)}
                            </p>
                            <p className="text-xs text-cyan-600 dark:text-cyan-400">
                              {getPriorityLabel(order.service)} Priority
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                              Weight / Total
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                              {order.weightKg} kg
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="font-bold text-slate-950 dark:text-white">
                                {money(order.totalPrice)}
                              </span>
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                              Machine History
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                              W: {getName(washer)}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-100">
                              D: {getName(order.dryer)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                              Due Date
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-100">
                              {formatDate(order.dueDate)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-300">
                              Created {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ALWAYS-VISIBLE ACTIONS */}
                      <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col">
                        <Link
                          to={`/orders/${order._id}`}
                          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-center text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 lg:flex-none dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900"
                        >
                          View Order
                        </Link>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteOrder(order)}
                            disabled={deletingId !== null}
                            className="min-h-10 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 lg:flex-none dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                          >
                            {deletingId === order._id
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* PAGINATION */}
            <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Showing{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {showingFrom}–{showingTo}
                </span>{' '}
                of{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {filteredOrders.length}
                </span>{' '}
                orders
              </p>

              <nav
                aria-label="Orders pagination"
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(Math.max(1, safePage - 1))
                  }
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  ← Previous
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Go to page ${page}`}
                    aria-current={
                      safePage === page ? 'page' : undefined
                    }
                    className={`min-w-10 rounded-lg px-3 py-2 text-sm font-bold transition ${
                      safePage === page
                        ? 'bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      Math.min(totalPages, safePage + 1)
                    )
                  }
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  Next →
                </button>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default Orders
