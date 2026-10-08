
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import api from '../../services/api'

type OverdueOrder = {
  _id: string
  customer?: {
    _id: string
    fullName: string
    phone: string
  } | null
  service?: {
    _id: string
    name: string
  } | null
  machine?: {
    _id: string
    name: string
  } | null
  weightKg: number
  totalPrice: number
  status: 'ready'
  dueDate: string
  createdAt: string
}

function OverduePickups() {
  const [orders, setOrders] = useState<OverdueOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadOverdueOrders = useCallback(
    async (initialLoad = false) => {
      try {
        if (initialLoad) {
          setLoading(true)
        } else {
          setRefreshing(true)
        }

        setError('')

        const response = await api.get('/orders/overdue')

        if (!Array.isArray(response.data)) {
          throw new Error('Invalid overdue orders response.')
        }

        setOrders(response.data)
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Unable to load overdue pickups.'
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
    void loadOverdueOrders(true)
  }, [loadOverdueOrders])

  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.totalPrice || 0),
    0
  )

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading overdue pickups...
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
            Attention Needed
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Overdue Pickups
          </h1>

          <p className="mt-2 text-slate-500">
            Ready laundry orders that have passed their due date.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOverdueOrders()}
          disabled={refreshing}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Overdue Pickups"
          value={orders.length}
        />

        <SummaryCard
          label="Total Value"
          value={`₱${totalValue.toFixed(2)}`}
        />

        <SummaryCard
          label="Status"
          value={
            error
              ? 'Unable to Refresh'
              : orders.length > 0
                ? 'Needs Attention'
                : 'All Clear'
          }
        />
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">
              ✓
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              {error
                ? 'Unable to confirm overdue pickups'
                : 'No overdue pickups'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {error
                ? 'Please refresh to try loading the latest records.'
                : 'All ready laundry orders are still within their due dates.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Weight</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Overdue</th>
                  <th className="px-6 py-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-900">
                        {order.customer?.fullName || 'Unknown'}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {order.customer?.phone || '—'}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-700">
                      {order.service?.name || '—'}
                    </td>

                    <td className="px-6 py-5 text-sm">
                      {order.weightKg} kg
                    </td>

                    <td className="px-6 py-5 font-semibold">
                      ₱{Number(order.totalPrice).toFixed(2)}
                    </td>

                    <td className="px-6 py-5">
                      <p className="text-sm font-semibold text-red-600">
                        {formatDateTime(order.dueDate)}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        {getOverdueTime(order.dueDate)}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <Link
                        to={`/orders/${order._id}`}
                        className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
                      >
                        View Order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function getOverdueTime(dueDate: string) {
  const timestamp = new Date(dueDate).getTime()

  if (!Number.isFinite(timestamp)) {
    return 'Unknown'
  }

  const difference = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(difference / (1000 * 60))

  if (minutes < 60) {
    return `${Math.max(1, minutes)}m overdue`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h overdue`
  }

  const days = Math.floor(hours / 24)

  return `${days} day${days !== 1 ? 's' : ''} overdue`
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

export default OverduePickups
