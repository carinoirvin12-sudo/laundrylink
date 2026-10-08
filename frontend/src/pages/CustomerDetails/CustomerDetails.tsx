
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import api from '../../services/api'

type Customer = {
  _id: string
  fullName: string
  phone: string
  address?: string
  createdAt?: string
}

type OrderStatus =
  | 'received'
  | 'washing'
  | 'ready'
  | 'claimed'
  | 'cancelled'

type Order = {
  _id: string
  customer: string | { _id: string; fullName?: string } | null
  service: string | { _id: string; name: string } | null
  weightKg: number
  totalPrice: number
  status: OrderStatus
  createdAt: string
  dueDate: string
}

type CustomerSummary = {
  totalOrders?: number
  claimedOrders?: number
  totalOrderValue?: number
  totalPaid?: number
  outstandingBalance?: number
  isLoyalCustomer?: boolean
  loyaltyDiscountPercent?: number
}

const LOYALTY_THRESHOLD = 5

function CustomerDetails() {
  const { id } = useParams<{ id: string }>()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [customerSummary, setCustomerSummary] =
    useState<CustomerSummary | null>(null)

  const [summaryError, setSummaryError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!id) {
      setCustomer(null)
      setOrders([])
      setCustomerSummary(null)
      setError('Customer ID is missing.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setSummaryError('')
    setCustomerSummary(null)

    try {
      const [customerResponse, ordersResponse] =
        await Promise.all([
          api.get<Customer>(`/customers/${id}`),
          api.get<Order[] | { orders: Order[] }>('/orders'),
        ])

      const allOrders = Array.isArray(ordersResponse.data)
        ? ordersResponse.data
        : Array.isArray(ordersResponse.data?.orders)
          ? ordersResponse.data.orders
          : []

      const customerOrders = allOrders
        .filter((order) => {
          const customerId =
            typeof order.customer === 'string'
              ? order.customer
              : order.customer?._id

          return customerId === id
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )

      setCustomer(customerResponse.data)
      setOrders(customerOrders)

      // Load financial summary separately so a summary
      // error does not hide the customer and order history.
      try {
        const summaryResponse =
          await api.get<CustomerSummary>(
            `/customers/${id}/summary`
          )


        const response = summaryResponse.data as
          | CustomerSummary
          | { summary: CustomerSummary }

        let summary: CustomerSummary

        if ('summary' in response && response.summary) {
          summary = response.summary
        } else {
          summary = response as CustomerSummary
        }

        setCustomerSummary(summary)

      } catch (summaryErr) {
        setSummaryError(
          getErrorMessage(
            summaryErr,
            'Payment summary is temporarily unavailable.'
          )
        )
      }
    } catch (err) {
      setCustomer(null)
      setOrders([])
      setError(
        getErrorMessage(
          err,
          'Unable to load customer details.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const orderSummary = useMemo(() => {
    const claimed = orders.filter(
      (order) => order.status === 'claimed'
    )

    const active = orders.filter((order) =>
      ['received', 'washing', 'ready'].includes(
        order.status
      )
    )

    return {
      total: orders.length,
      active: active.length,
      claimed: claimed.length,
      cancelled: orders.filter(
        (order) => order.status === 'cancelled'
      ).length,
      completedValue: claimed.reduce(
        (sum, order) =>
          sum + Number(order.totalPrice || 0),
        0
      ),
    }
  }, [orders])

  const claimedCount =
    customerSummary?.claimedOrders ??
    orderSummary.claimed

  const isLoyal =
    claimedCount >= LOYALTY_THRESHOLD

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
        Loading customer details...
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>

        <Link
          to="/customers"
          className="font-semibold text-cyan-600"
        >
          ← Back to Customers
        </Link>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="mb-4 text-slate-600">
          Customer not found.
        </p>

        <Link
          to="/customers"
          className="font-semibold text-cyan-600"
        >
          ← Back to Customers
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* HEADER */}
      <div>
        <Link
          to="/customers"
          className="text-sm font-semibold text-cyan-600 hover:text-cyan-700"
        >
          ← Back to Customers
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Customer Details
            </h1>

            <p className="mt-1 text-slate-500">
              Customer profile, loyalty status,
              payment summary, and laundry history.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* CUSTOMER PROFILE */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-xl font-bold text-cyan-700">
              {customer.fullName.charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {customer.fullName}
              </h2>

              <p className="text-sm text-slate-500">
                Customer Profile
              </p>
            </div>
          </div>

          {isLoyal ? (
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-800">
              ⭐ Loyal Customer · 5% OFF
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              {claimedCount} / {LOYALTY_THRESHOLD} Claimed Orders
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6 md:grid-cols-3">
          <Info
            label="Full Name"
            value={customer.fullName}
          />

          <Info
            label="Phone Number"
            value={customer.phone}
          />

          <Info
            label="Address"
            value={customer.address || 'Not provided'}
          />

          {customer.createdAt && (
            <Info
              label="Customer Since"
              value={formatDate(customer.createdAt)}
            />
          )}
        </div>

        {!isLoyal && (
          <p className="mt-5 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            {Math.max(
              0,
              LOYALTY_THRESHOLD - claimedCount
            )}{' '}
            more claimed{' '}
            {LOYALTY_THRESHOLD - claimedCount === 1
              ? 'order'
              : 'orders'}{' '}
            needed to unlock the 5% loyalty discount.
          </p>
        )}

        {isLoyal && (
          <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            This customer qualifies for the loyalty
            discount. The applicable discount will be
            calculated when creating an order.
          </p>
        )}
      </section>

      {/* ORDER SUMMARY */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Total Orders"
          value={orderSummary.total}
        />

        <SummaryCard
          label="Active Orders"
          value={orderSummary.active}
        />

        <SummaryCard
          label="Claimed Orders"
          value={orderSummary.claimed}
        />

        <SummaryCard
          label="Cancelled"
          value={orderSummary.cancelled}
        />

        <SummaryCard
          label="Claimed Order Value"
          value={formatMoney(
            orderSummary.completedValue
          )}
        />
      </section>

      {/* FINANCIAL SUMMARY */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">
            Payment Summary
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Financial totals provided by the backend.
          </p>
        </div>

        {summaryError && (
          <p
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            role="alert"
          >
            {summaryError}
          </p>
        )}

        {customerSummary ? (
          <div className="grid gap-4 md:grid-cols-3">
            <FinancialCard
              label="Total Order Value"
              value={formatOptionalMoney(
                customerSummary.totalOrderValue
              )}
            />

            <FinancialCard
              label="Total Payments"
              value={formatOptionalMoney(
                customerSummary.totalPaid
              )}
            />

            <FinancialCard
              label="Outstanding Balance"
              value={formatOptionalMoney(
                customerSummary.outstandingBalance
              )}
              highlight
            />
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            Payment information is unavailable.
            Customer order history is still shown below.
          </p>
        )}
      </section>

      {/* ORDER HISTORY */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Laundry Order History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Previous and ongoing laundry orders for this customer.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
              🧺
            </div>

            <h3 className="font-semibold text-slate-900">
              No laundry orders yet
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              This customer has no recorded transactions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Weight</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      #{order._id.slice(-8).toUpperCase()}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {typeof order.service === 'string'
                        ? 'Service'
                        : order.service?.name || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.weightKg} kg
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {formatMoney(order.totalPrice)}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/orders/${order._id}`}
                        className="text-sm font-semibold text-cyan-600 hover:text-cyan-700"
                      >
                        View Order →
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

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-2 break-words font-medium text-slate-800">
        {value}
      </p>
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
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function FinancialCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-2xl border border-cyan-200 bg-cyan-50 p-5'
          : 'rounded-2xl border border-slate-200 bg-slate-50 p-5'
      }
    >
      <p className="text-sm font-medium text-slate-600">
        {label}
      </p>

      <p className="mt-3 break-words text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: OrderStatus
}) {
  const styles: Record<OrderStatus, string> = {
    received: 'bg-blue-100 text-blue-700',
    washing: 'bg-purple-100 text-purple-700',
    ready: 'bg-amber-100 text-amber-700',
    claimed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

function formatOptionalMoney(value?: number) {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? formatMoney(value)
    : '—'
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

export default CustomerDetails
