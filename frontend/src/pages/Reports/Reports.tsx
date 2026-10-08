
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import api from '../../services/api'

type Summary = {
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

type Payment = {
  _id: string
  amount: number
  method: 'cash' | 'gcash' | 'bank'
  paidAt: string
  remarks?: string
  order?: {
    _id: string
    customer?: {
      fullName: string
    } | null
  } | null
}

type RevenueData = {
  totalRevenue: number
  paymentCount: number
  byMethod: {
    cash: number
    gcash: number
    bank: number
  }
  payments: Payment[]
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDefaultDates() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)

  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  return {
    from: getDateInputValue(thirtyDaysAgo),
    to: getDateInputValue(today),
  }
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

function formatMoney(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function Reports() {
  const [initialDates] = useState(getDefaultDates)

  const [from, setFrom] = useState(initialDates.from)
  const [to, setTo] = useState(initialDates.to)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)

  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState('')
  const [appliedRange, setAppliedRange] = useState({
    from: initialDates.from,
    to: initialDates.to,
  })

  const loadReports = useCallback(
    async (
      rangeFrom: string,
      rangeTo: string,
      isInitial = false
    ) => {
      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError('')

      try {
        const [summaryResponse, revenueResponse] =
          await Promise.all([
            api.get('/stats/summary'),
            api.get('/stats/revenue', {
              params: {
                from: rangeFrom,
                to: rangeTo,
              },
            }),
          ])

        const revenueData = revenueResponse.data as RevenueData

        if (
          !revenueData ||
          !Array.isArray(revenueData.payments) ||
          !revenueData.byMethod
        ) {
          throw new Error('Unexpected revenue report response.')
        }

        setSummary(summaryResponse.data)
        setRevenue(revenueData)
        setAppliedRange({
          from: rangeFrom,
          to: rangeTo,
        })
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Unable to load reports.'
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
    void loadReports(
      initialDates.from,
      initialDates.to,
      true
    )
  }, [loadReports, initialDates])

  const generateReport = async () => {
    setError('')

    if (!from || !to) {
      setError('Please select both From and To dates.')
      return
    }

    if (from > to) {
      setError('From date cannot be later than To date.')
      return
    }

    setReportLoading(true)

    try {
      const response = await api.get('/stats/revenue', {
        params: {
          from,
          to,
        },
      })

      const data = response.data as RevenueData

      if (
        !data ||
        !Array.isArray(data.payments) ||
        !data.byMethod
      ) {
        throw new Error('Unexpected revenue report response.')
      }

      setRevenue(data)
      setAppliedRange({ from, to })
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to generate revenue report.'
        )
      )
    } finally {
      setReportLoading(false)
    }
  }

  const revenueTotal = Number(revenue?.totalRevenue ?? 0)
  const paymentCount = Number(revenue?.paymentCount ?? 0)

  // IMPORTANT: Backend returns "byMethod", not "breakdown".
  const cashRevenue = Number(revenue?.byMethod?.cash ?? 0)
  const gcashRevenue = Number(revenue?.byMethod?.gcash ?? 0)
  const bankRevenue = Number(revenue?.byMethod?.bank ?? 0)

  const payments = revenue?.payments ?? []

  const busy = loading || reportLoading || refreshing

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading reports...
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
            Business Analytics
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Reports
          </h1>

          <p className="mt-2 text-slate-500">
            Review LaundryLink revenue and business activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadReports(
              appliedRange.from,
              appliedRange.to
            )
          }
          disabled={busy}
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

      {/* OVERALL SUMMARY */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportCard
              label="Total Revenue"
              value={formatMoney(summary.revenue.total)}
              subtitle="All recorded payments"
            />

            <ReportCard
              label="Total Orders"
              value={summary.orders.total}
              subtitle={`${summary.orders.claimed} completed`}
            />

            <ReportCard
              label="Customers"
              value={summary.customers.total}
              subtitle="Registered customers"
            />

            <ReportCard
              label="Overdue Pickups"
              value={summary.orders.overdue}
              subtitle="Needs attention"
            />
          </div>

          {/* ORDER ACTIVITY */}
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Order Activity
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatusCard
                label="Received"
                value={summary.orders.received}
              />

              <StatusCard
                label="Washing"
                value={summary.orders.washing}
              />

              <StatusCard
                label="Ready"
                value={summary.orders.ready}
              />

              <StatusCard
                label="Claimed"
                value={summary.orders.claimed}
              />

              <StatusCard
                label="Cancelled"
                value={summary.orders.cancelled}
              />
            </div>
          </section>
        </>
      )}

      {/* REVENUE REPORT */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Revenue Report
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Filter recorded payments by date.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label
                htmlFor="report-from"
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
              >
                From
              </label>

              <input
                id="report-from"
                type="date"
                value={from}
                onChange={(event) =>
                  setFrom(event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5"
              />
            </div>

            <div>
              <label
                htmlFor="report-to"
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
              >
                To
              </label>

              <input
                id="report-to"
                type="date"
                value={to}
                onChange={(event) =>
                  setTo(event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void generateReport()}
              className="rounded-xl bg-slate-950 px-5 py-2.5 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-50"
            >
              {reportLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Showing payments from {appliedRange.from} to{' '}
          {appliedRange.to}.
        </p>

        {/* REVENUE CARDS */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RevenueCard
            label="Revenue"
            value={formatMoney(revenueTotal)}
          />

          <RevenueCard
            label="Payments"
            value={paymentCount}
          />

          <RevenueCard
            label="Cash"
            value={formatMoney(cashRevenue)}
          />

          <RevenueCard
            label="GCash + Bank"
            value={formatMoney(
              gcashRevenue + bankRevenue
            )}
          />
        </div>

        {/* PAYMENT METHOD BREAKDOWN */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PaymentMethod
            method="Cash"
            amount={cashRevenue}
          />

          <PaymentMethod
            method="GCash"
            amount={gcashRevenue}
          />

          <PaymentMethod
            method="Bank"
            amount={bankRevenue}
          />
        </div>
      </section>

      {/* PAYMENT HISTORY */}
      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Payment Transactions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Payments recorded within the selected date range.
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No payments found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
              <thead>
                <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Remarks</th>
                  <th className="px-6 py-4 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(payment.paidAt)}
                    </td>

                    <td className="px-6 py-4 font-medium">
                      {payment.order?.customer?.fullName ??
                        '—'}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                        {payment.method}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {payment.remarks || '—'}
                    </td>

                    <td className="px-6 py-4 text-right font-bold">
                      {formatMoney(payment.amount)}
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

function ReportCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string | number
  subtitle: string
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-sm text-slate-400">
        {subtitle}
      </p>
    </div>
  )
}

function StatusCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function RevenueCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function PaymentMethod({
  method,
  amount,
}: {
  method: string
  amount: number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-5">
      <p className="text-sm font-medium text-slate-500">
        {method}
      </p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {formatMoney(amount)}
      </p>
    </div>
  )
}

export default Reports
