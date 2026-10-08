import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'

type OrderStatus =
  | 'received'
  | 'washing'
  | 'ready'
  | 'claimed'
  | 'cancelled'

type PaymentMethod =
  | 'cash'
  | 'gcash'
  | 'bank'

type Order = {
  _id: string

  customer: {
    _id: string
    fullName: string
    phone: string
    address?: string
  }

  service: {
    _id: string
    name: string
    pricePerKg: number
    turnaroundHours?: number
  }

  machine: {
    _id: string
    name: string
    type: 'washer' | 'dryer'
    capacityKg: number
  } | null

  weightKg: number
  discountPercent: number
  totalPrice: number
  status: OrderStatus
  dueDate: string
  claimedAt: string | null
  notes?: string
  createdAt: string
  updatedAt: string
}

type Payment = {
  _id: string
  order: string | Order
  amount: number
  method: PaymentMethod
  paidAt: string
  remarks?: string
}

type BalanceData = {
  totalPrice?: number
  totalPaid?: number
  paid?: number
  balance?: number
  remainingBalance?: number
  paymentStatus?: string
  payments?: Payment[]
}

const paymentSchema = z.object({
  amount: z
    .number({ message: 'Enter a valid payment amount' })
    .finite('Enter a valid payment amount')
    .min(1, 'Payment must be at least ₱1')
    .refine(
      (value) =>
        Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      'Payment must have at most 2 decimal places'
    ),

  method: z.enum([
    'cash',
    'gcash',
    'bank',
  ]),

  remarks: z.string(),
})

type PaymentFormData =
  z.infer<typeof paymentSchema>

function OrderDetails() {
  const { id } = useParams()

  const [order, setOrder] =
    useState<Order | null>(null)

  const [balanceData, setBalanceData] =
    useState<BalanceData | null>(null)

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [loading, setLoading] =
    useState(true)

  const [actionLoading, setActionLoading] =
    useState(false)

  const [paymentLoading, setPaymentLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),

    defaultValues: {
      amount: 1,
      method: 'cash',
      remarks: '',
    },
  })

  const loadOrder = useCallback(
    async () => {
      if (!id) {
        setError('Order ID is missing.')
        setOrder(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const [
          orderResponse,
          balanceResponse,
        ] = await Promise.all([
          api.get(`/orders/${id}`),
          api.get(
            `/orders/${id}/balance`
          ),
        ])

        const currentOrder =
          orderResponse.data

        const currentBalance =
          balanceResponse.data

        setOrder(currentOrder)
        setBalanceData(currentBalance)

        if (
          Array.isArray(
            currentBalance.payments
          )
        ) {
          setPayments(
            currentBalance.payments
          )
        } else {
          try {
            const paymentResponse =
              await api.get('/payments')

            const allPayments =
              paymentResponse.data

            if (
              Array.isArray(
                allPayments
              )
            ) {
              const orderPayments =
                allPayments.filter(
                  (
                    payment: Payment
                  ) => {
                    const paymentOrderId =
                      typeof payment.order ===
                        'string'
                        ? payment.order
                        : payment.order?._id

                    return (
                      paymentOrderId ===
                      id
                    )
                  }
                )

              setPayments(
                orderPayments
              )
            } else {
              setPayments([])
            }
          } catch {
            setPayments([])
          }
        }
      } catch (error) {
        setError(
          getErrorMessage(
            error,
            'Unable to load order.'
          )
        )

        setOrder(null)
        setBalanceData(null)
        setPayments([])
      } finally {
        setLoading(false)
      }
    },
    [id]
  )

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const totalPrice =
    Number(
      balanceData?.totalPrice ??
      order?.totalPrice ??
      0
    )

  const totalPaid = useMemo(() => {
    if (
      balanceData?.totalPaid !==
      undefined
    ) {
      return Number(
        balanceData.totalPaid
      )
    }

    if (
      balanceData?.paid !==
      undefined
    ) {
      return Number(
        balanceData.paid
      )
    }

    return payments.reduce(
      (total, payment) =>
        total +
        Number(payment.amount),
      0
    )
  }, [balanceData, payments])

  const balance = useMemo(() => {
    if (
      balanceData?.balance !==
      undefined
    ) {
      return Math.max(
        0,
        Number(
          balanceData.balance
        )
      )
    }

    if (
      balanceData
        ?.remainingBalance !==
      undefined
    ) {
      return Math.max(
        0,
        Number(
          balanceData
            .remainingBalance
        )
      )
    }

    return Math.max(
      0,
      totalPrice - totalPaid
    )
  }, [
    balanceData,
    totalPrice,
    totalPaid,
  ])

  const paymentStatus =
    balance <= 0
      ? 'Paid'
      : totalPaid > 0
        ? 'Partial'
        : 'Unpaid'

  useEffect(() => {
    if (balance > 0) {
      setValue(
        'amount',
        Number(
          balance.toFixed(2)
        )
      )
    }
  }, [balance, setValue])

  const updateStatus = async (
    newStatus: OrderStatus
  ) => {
    if (!id) {
      return
    }

    try {
      setActionLoading(true)
      setError('')
      setSuccess('')

      await api.patch(
        `/orders/${id}/status`,
        {
          status: newStatus,
        }
      )

      setSuccess(
        getStatusSuccessMessage(
          newStatus
        )
      )

      await loadOrder()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to update order status.'
        )
      )
    } finally {
      setActionLoading(false)
    }
  }

  const cancelOrder = async () => {
    if (
      !order ||
      order.status !== 'received'
    ) {
      return
    }
    if (totalPaid > 0 || payments.length > 0) {
      setError('Orders with recorded payments cannot be cancelled.')
      return
    }
    const confirmed =
      window.confirm(
        'Cancel this order? Cancellation is only allowed before washing starts.'
      )

    if (!confirmed) {
      return
    }

    await updateStatus(
      'cancelled'
    )
  }

  const addPayment = async (
    data: PaymentFormData
  ) => {
    if (!id || !order) {
      return
    }

    if (
      order.status === 'cancelled'
    ) {
      setError(
        'Payments cannot be added to a cancelled order.'
      )
      return
    }

    if (
      order.status === 'claimed'
    ) {
      setError(
        'This order has already been claimed.'
      )
      return
    }

    if (balance <= 0) {
      setError(
        'This order is already fully paid.'
      )
      return
    }

    if (data.amount > balance) {
      setError(
        `Payment cannot exceed the remaining balance of ₱${balance.toFixed(
          2
        )}.`
      )
      return
    }

    try {
      setPaymentLoading(true)
      setError('')
      setSuccess('')

      await api.post(
        '/payments',
        {
          order: id,
          amount: data.amount,
          method: data.method,
          remarks:
            data.remarks.trim(),
        }
      )

      setSuccess(
        'Payment recorded successfully.'
      )

      reset({
        amount: 1,
        method: 'cash',
        remarks: '',
      })

      await loadOrder()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to record payment.'
        )
      )
    } finally {
      setPaymentLoading(false)
    }
  }

  const claimOrder = async () => {
    if (
      !order ||
      order.status !== 'ready'
    ) {
      return
    }

    if (balance > 0) {
      setError(
        'Order cannot be claimed until fully paid.'
      )
      return
    }

    await updateStatus(
      'claimed'
    )
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading order...
        </p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          Order not found
        </h1>

        <p className="mt-2 text-slate-500">
          {error || 'The requested laundry order could not be loaded.'}
        </p>

        <Link
          to="/orders"
          className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
        >
          Back to Orders
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            to="/orders"
            className="text-sm font-semibold text-cyan-600 hover:text-cyan-700"
          >
            ← Back to Orders
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Order #
            {shortId(order._id)}
          </h1>

          <p className="mt-2 text-slate-500">
            Created{' '}
            {formatDateTime(
              order.createdAt
            )}
          </p>
        </div>

        <StatusBadge
          status={order.status}
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUCCESS */}
      {success && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ORDER PROGRESS */}
      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
          Laundry Progress
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Order Status
        </h2>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <ProgressStep
            label="Received"
            completed={
              statusLevel(
                order.status
              ) >= 1
            }
            current={
              order.status ===
              'received'
            }
          />

          <ProgressStep
            label="Washing"
            completed={
              statusLevel(
                order.status
              ) >= 2
            }
            current={
              order.status ===
              'washing'
            }
          />

          <ProgressStep
            label="Ready"
            completed={
              statusLevel(
                order.status
              ) >= 3
            }
            current={
              order.status ===
              'ready'
            }
          />

          <ProgressStep
            label="Claimed"
            completed={
              order.status ===
              'claimed'
            }
            current={
              order.status ===
              'claimed'
            }
          />
        </div>

        {/* RECEIVED */}
        {order.status ===
          'received' && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={
                    actionLoading
                  }
                  onClick={() =>
                    updateStatus(
                      'washing'
                    )
                  }
                  className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-50"
                >
                  {actionLoading
                    ? 'Updating...'
                    : 'Start Washing'}
                </button>

                <button
                  type="button"
                  disabled={
                    actionLoading || totalPaid > 0 || payments.length > 0
                  }
                  onClick={
                    cancelOrder
                  }
                  className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel Order
                </button>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                Cancellation is
                allowed only before
                washing starts.
              </p>
            </div>
          )}

        {/* WASHING */}
        {order.status ===
          'washing' && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="button"
                disabled={
                  actionLoading
                }
                onClick={() =>
                  updateStatus(
                    'ready'
                  )
                }
                className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {actionLoading
                  ? 'Updating...'
                  : 'Mark Ready'}
              </button>

              <p className="mt-3 text-sm text-slate-500">
                Washing has started.
                This order can no
                longer be cancelled.
              </p>
            </div>
          )}

        {/* READY */}
        {order.status ===
          'ready' && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-800">
                Laundry is ready for
                pickup.
              </p>

              <p className="mt-1 text-sm text-amber-700">
                Complete the payment
                below before releasing
                the order to the
                customer.
              </p>
            </div>
          )}

        {/* CLAIMED */}
        {order.status ===
          'claimed' && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-700">
                ✓ Transaction Complete
              </p>

              <p className="mt-1 text-sm text-green-600">
                {order.claimedAt
                  ? `Claimed on ${formatDateTime(
                    order.claimedAt
                  )}.`
                  : 'This order has been claimed.'}
              </p>
            </div>
          )}

        {/* CANCELLED */}
        {order.status ===
          'cancelled' && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-700">
                Order Cancelled
              </p>

              <p className="mt-1 text-sm text-red-600">
                This transaction was
                cancelled before
                washing started.
              </p>
            </div>
          )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* CUSTOMER */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Customer
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Info
                label="Full Name"
                value={
                  order.customer
                    ?.fullName ||
                  '—'
                }
              />

              <Info
                label="Phone"
                value={
                  order.customer
                    ?.phone ||
                  '—'
                }
              />

              <div className="md:col-span-2">
                <Info
                  label="Address"
                  value={
                    order.customer
                      ?.address ||
                    'No address provided'
                  }
                />
              </div>
            </div>
          </section>

          {/* LAUNDRY DETAILS */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Laundry Details
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Info
                label="Service"
                value={
                  order.service
                    ?.name ||
                  '—'
                }
              />

              <Info
                label="Weight"
                value={`${order.weightKg} kg`}
              />

              <Info
                label="Machine"
                value={
                  order.machine
                    ?.name ||
                  '—'
                }
              />

              <Info
                label="Machine Type"
                value={
                  order.machine
                    ? capitalize(
                      order.machine
                        .type
                    )
                    : '—'
                }
              />

              <Info
                label="Due Date"
                value={formatDateTime(
                  order.dueDate
                )}
              />

              <Info
                label="Discount"
                value={`${order.discountPercent}%`}
              />

              <div className="md:col-span-2">
                <Info
                  label="Notes"
                  value={
                    order.notes ||
                    'No notes'
                  }
                />
              </div>
            </div>
          </section>

          {/* PAYMENT HISTORY */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Payment History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Payments recorded
                for this order.
              </p>
            </div>

            {payments.length ===
              0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  No payments
                  recorded yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-6 py-4">
                        Date
                      </th>

                      <th className="px-6 py-4">
                        Method
                      </th>

                      <th className="px-6 py-4">
                        Remarks
                      </th>

                      <th className="px-6 py-4 text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map(
                      (
                        payment
                      ) => (
                        <tr
                          key={
                            payment._id
                          }
                          className="border-b border-slate-100"
                        >
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDateTime(
                              payment.paidAt
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                              {
                                payment.method
                              }
                            </span>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-500">
                            {payment.remarks ||
                              '—'}
                          </td>

                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ₱
                            {Number(
                              payment.amount
                            ).toFixed(
                              2
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* PAYMENT PANEL */}
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm xl:sticky xl:top-28">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
            Payment
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Order Balance
          </h2>

          {/* TOTALS */}
          <div className="mt-6 space-y-4">
            <MoneyRow
              label="Total"
              value={totalPrice}
            />

            <MoneyRow
              label="Paid"
              value={totalPaid}
            />

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-end justify-between gap-4">
                <span className="font-semibold text-slate-700">
                  Balance
                </span>

                <span className="text-3xl font-bold text-slate-950">
                  ₱
                  {balance.toFixed(
                    2
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Payment Status
              </span>

              <PaymentBadge
                status={
                  paymentStatus
                }
              />
            </div>
          </div>

          {/* INLINE PAYMENT FORM */}
          {balance > 0 &&
            order.status !==
            'cancelled' &&
            order.status !==
            'claimed' && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-900">
                  Record Payment
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the amount
                  received from the
                  customer.
                </p>

                <form
                  onSubmit={handleSubmit(
                    addPayment
                  )}
                  className="mt-5 space-y-4"
                >
                  {/* AMOUNT */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Amount
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={balance}
                      step="0.01"
                      {...register(
                        'amount',
                        {
                          valueAsNumber:
                            true,
                        }
                      )}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                    />

                    {errors.amount && (
                      <p className="mt-1 text-sm text-red-600">
                        {
                          errors.amount
                            .message
                        }
                      </p>
                    )}
                  </div>

                  {/* METHOD */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Method
                    </label>

                    <select
                      {...register(
                        'method'
                      )}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-cyan-500"
                    >
                      <option value="cash">
                        Cash
                      </option>

                      <option value="gcash">
                        GCash
                      </option>

                      <option value="bank">
                        Bank
                      </option>
                    </select>
                  </div>

                  {/* REMARKS */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Remarks
                    </label>

                    <textarea
                      {...register(
                        'remarks'
                      )}
                      rows={3}
                      placeholder="Optional remarks"
                      className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      paymentLoading
                    }
                    className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paymentLoading
                      ? 'Recording Payment...'
                      : 'Record Payment'}
                  </button>
                </form>
              </div>
            )}

          {/* FULLY PAID */}
          {balance <= 0 &&
            order.status !==
            'cancelled' && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="font-bold text-green-700">
                  ✓ Fully Paid
                </p>

                <p className="mt-1 text-sm text-green-600">
                  No remaining
                  balance.
                </p>
              </div>
            )}

          {/* CLAIM - ONLY HERE */}
          {order.status ===
            'ready' && (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={
                    balance > 0 ||
                    actionLoading
                  }
                  onClick={
                    claimOrder
                  }
                  className="w-full rounded-xl bg-green-600 px-5 py-3.5 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionLoading
                    ? 'Processing...'
                    : 'Claim Order'}
                </button>

                {balance > 0 && (
                  <p className="mt-2 text-center text-xs font-medium text-amber-600">
                    Complete the
                    remaining payment
                    before claiming.
                  </p>
                )}
              </div>
            )}

          {/* CLAIMED */}
          {order.status ===
            'claimed' && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-bold text-green-700">
                  ✓ Order Claimed
                </p>

                <p className="mt-1 text-sm text-green-600">
                  {order.claimedAt
                    ? formatDateTime(
                      order.claimedAt
                    )
                    : 'Transaction complete'}
                </p>
              </div>
            )}

          {/* CANCELLED */}
          {order.status ===
            'cancelled' && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="font-bold text-red-700">
                  Order Cancelled
                </p>

                <p className="mt-1 text-sm text-red-600">
                  No further
                  transaction is
                  allowed.
                </p>
              </div>
            )}
        </aside>
      </div>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-medium text-slate-800">
        {value}
      </p>
    </div>
  )
}

function MoneyRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        ₱{value.toFixed(2)}
      </span>
    </div>
  )
}

function ProgressStep({
  label,
  completed,
  current,
}: {
  label: string
  completed: boolean
  current: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${current
        ? 'border-cyan-500 bg-cyan-50'
        : completed
          ? 'border-green-200 bg-green-50'
          : 'border-slate-200 bg-slate-50'
        }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${current
            ? 'bg-cyan-500 text-white'
            : completed
              ? 'bg-green-600 text-white'
              : 'bg-slate-200 text-slate-500'
            }`}
        >
          {completed
            ? '✓'
            : '•'}
        </div>

        <span
          className={`font-semibold ${current
            ? 'text-cyan-700'
            : completed
              ? 'text-green-700'
              : 'text-slate-500'
            }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: OrderStatus
}) {
  const styles: Record<
    OrderStatus,
    string
  > = {
    received:
      'bg-blue-100 text-blue-700',

    washing:
      'bg-purple-100 text-purple-700',

    ready:
      'bg-amber-100 text-amber-700',

    claimed:
      'bg-green-100 text-green-700',

    cancelled:
      'bg-red-100 text-red-700',
  }

  return (
    <span
      className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function PaymentBadge({
  status,
}: {
  status: string
}) {
  const style =
    status === 'Paid'
      ? 'bg-green-100 text-green-700'
      : status === 'Partial'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}
    >
      {status}
    </span>
  )
}

function statusLevel(
  status: OrderStatus
) {
  switch (status) {
    case 'received':
      return 1

    case 'washing':
      return 2

    case 'ready':
      return 3

    case 'claimed':
      return 4

    default:
      return 0
  }
}

function getStatusSuccessMessage(
  status: OrderStatus
) {
  switch (status) {
    case 'washing':
      return 'Laundry washing started.'

    case 'ready':
      return 'Laundry is now ready for pickup.'

    case 'claimed':
      return 'Order claimed successfully.'

    case 'cancelled':
      return 'Order cancelled successfully.'

    default:
      return 'Order status updated.'
  }
}

function shortId(
  id: string
) {
  return id
    .slice(-8)
    .toUpperCase()
}

function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString()
}

function capitalize(
  value: string
) {
  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  )
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    axios.isAxiosError(
      error
    )
  ) {
    return (
      error.response?.data
        ?.message ||
      fallback
    )
  }

  if (
    error instanceof Error
  ) {
    return error.message
  }

  return fallback
}

export default OrderDetails