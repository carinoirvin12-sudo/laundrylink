import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'
import Receipt from './Receipt'

type OrderStatus =
  | 'received'
  | 'washing'
  | 'drying'
  | 'folding'
  | 'ready'
  | 'claimed'
  | 'cancelled'

type PaymentMethod = 'cash' | 'gcash' | 'bank'
type MachineType = 'washer' | 'dryer'

type Machine = {
  _id: string
  name: string
  type: MachineType
  capacityKg: number
  status: 'active' | 'maintenance'
  isBusy?: boolean
  isAvailable?: boolean
  availabilityStatus?: string
  displayStatus?: string
}

type Order = {
  _id: string
  customer: {
    _id: string
    fullName: string
    phone: string
    address?: string
  } | null
  service: {
    _id: string
    name: string
    pricePerKg: number
    turnaroundHours?: number
  } | null
  machine: Machine | null
  washer: Machine | null
  dryer: Machine | null
  weightKg: number
  discountPercent: number
  totalPrice: number
  status: OrderStatus
  dueDate: string
  washingStartedAt?: string | null
  dryingStartedAt?: string | null
  foldingStartedAt?: string | null
  readyAt?: string | null
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
  balance?: number
  paymentStatus?: string
  payments?: Payment[]
}

const STATUSES: OrderStatus[] = [
  'received',
  'washing',
  'drying',
  'folding',
  'ready',
  'claimed',
]

const paymentSchema = z.object({
  amount: z
    .number({
      message: 'Enter a valid payment amount',
    })
    .finite('Enter a valid payment amount')
    .min(1, 'Payment must be at least ₱1')
    .refine(
      (value) =>
        Math.abs(
          value * 100 - Math.round(value * 100)
        ) < 0.000001,
      'Payment must have at most 2 decimal places'
    ),
  method: z.enum(['cash', 'gcash', 'bank']),
  remarks: z.string(),
})

type PaymentFormData = z.infer<
  typeof paymentSchema
>

const peso = (value: number) =>
  `₱${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDateTime = (
  value?: string | null
) => {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-PH')
}

const shortId = (id: string) =>
  id.slice(-8).toUpperCase()

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() +
  value.slice(1)

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message

    return typeof message === 'string'
      ? message
      : fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function getPriorityLabel(serviceName?: string) {
  if (serviceName === 'Express Laundry') {
    return 'Highest Priority'
  }

  if (serviceName === 'Priority Laundry') {
    return 'High Priority'
  }

  return 'Normal Priority'
}

function getStatusSuccessMessage(
  status: OrderStatus
) {
  const messages: Partial<
    Record<OrderStatus, string>
  > = {
    washing: 'Washing started successfully.',
    drying:
      'Drying started. The washer is now available.',
    folding:
      'Folding started. The dryer is now available.',
    ready: 'Laundry is ready for pickup.',
    claimed: 'Order claimed successfully.',
    cancelled: 'Order cancelled successfully.',
  }

  return (
    messages[status] ||
    'Order status updated successfully.'
  )
}

function OrderDetails() {
  const { id } = useParams()

  const [order, setOrder] =
    useState<Order | null>(null)

  const [balanceData, setBalanceData] =
    useState<BalanceData | null>(null)

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [machines, setMachines] =
    useState<Machine[]>([])

  const [selectedWasher, setSelectedWasher] =
    useState('')

  const [selectedDryer, setSelectedDryer] =
    useState('')

  const [loading, setLoading] = useState(true)

  const [
    machinesLoading,
    setMachinesLoading,
  ] = useState(false)

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false)

  const [
    paymentLoading,
    setPaymentLoading,
  ] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  // ==========================================
  // LOAD ORDER AND BALANCE
  // ==========================================

  const loadOrder = useCallback(
    async (showLoading = true) => {
      if (!id) {
        setError('Order ID is missing.')
        setOrder(null)
        setLoading(false)
        return
      }

      try {
        if (showLoading) {
          setLoading(true)
        }

        const [
          orderResponse,
          balanceResponse,
        ] = await Promise.all([
          api.get(`/orders/${id}`),
          api.get(`/orders/${id}/balance`),
        ])

        const currentOrder =
          orderResponse.data as Order

        const currentBalance =
          balanceResponse.data as BalanceData

        setOrder(currentOrder)
        setBalanceData(currentBalance)
        setPayments(
          Array.isArray(currentBalance.payments)
            ? currentBalance.payments
            : []
        )
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Unable to load order details.'
          )
        )

        if (showLoading) {
          setOrder(null)
          setBalanceData(null)
          setPayments([])
        }
      } finally {
        if (showLoading) {
          setLoading(false)
        }
      }
    },
    [id]
  )

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  // ==========================================
  // AVAILABLE MACHINES
  // ==========================================

  const loadMachines = useCallback(async () => {
    if (
      !order ||
      !['received', 'washing'].includes(
        order.status
      )
    ) {
      setMachines([])
      return
    }

    const type: MachineType =
      order.status === 'received'
        ? 'washer'
        : 'dryer'

    try {
      setMachinesLoading(true)

      const response = await api.get(
        '/machines/availability',
        {
          params: {
            type,
            weightKg: order.weightKg,
          },
        }
      )

      const machineData: Machine[] =
        Array.isArray(response.data)
          ? response.data
          : []

      const availableMachines =
        machineData.filter(
          (machine) =>
            machine.type === type &&
            machine.isAvailable === true &&
            machine.status === 'active' &&
            machine.capacityKg >= order.weightKg
        )

      setMachines(availableMachines)

      if (type === 'washer') {
        setSelectedWasher((current) =>
          availableMachines.some(
            (machine) =>
              machine._id === current
          )
            ? current
            : ''
        )
      } else {
        setSelectedDryer((current) =>
          availableMachines.some(
            (machine) =>
              machine._id === current
          )
            ? current
            : ''
        )
      }
    } catch (err) {
      setMachines([])
      setError(
        getErrorMessage(
          err,
          'Unable to check available machines.'
        )
      )
    } finally {
      setMachinesLoading(false)
    }
  }, [order])

  useEffect(() => {
    void loadMachines()
  }, [loadMachines])

  // ==========================================
  // PAYMENT COMPUTATIONS
  // ==========================================

  const totalPrice = Number(
    balanceData?.totalPrice ??
      order?.totalPrice ??
      0
  )

  const totalPaid = useMemo(() => {
    if (balanceData?.totalPaid !== undefined) {
      return Number(balanceData.totalPaid)
    }

    return payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount),
      0
    )
  }, [balanceData, payments])

  const balance = useMemo(() => {
    if (balanceData?.balance !== undefined) {
      return Math.max(
        0,
        Number(balanceData.balance)
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
    if (balance >= 1) {
      setValue(
        'amount',
        Number(balance.toFixed(2))
      )
    }
  }, [balance, setValue])

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  const updateStatus = async (
    newStatus: OrderStatus,
    extraData: Record<string, string> = {}
  ) => {
    if (!id || !order || actionLoading) {
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
          ...extraData,
        }
      )

      await loadOrder(false)

      setSuccess(
        getStatusSuccessMessage(newStatus)
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to update order status.'
        )
      )

      // Refresh in case another staff member
      // assigned this machine already.
      await loadOrder(false)
    } finally {
      setActionLoading(false)
    }
  }

  const startWashing = async () => {
    if (!selectedWasher) {
      setError('Please select an available washer.')
      return
    }

    await updateStatus('washing', {
      washer: selectedWasher,
    })
  }

  const startDrying = async () => {
    if (!selectedDryer) {
      setError('Please select an available dryer.')
      return
    }

    await updateStatus('drying', {
      dryer: selectedDryer,
    })
  }

  const cancelOrder = async () => {
    if (!order || order.status !== 'received') {
      return
    }

    if (
      totalPaid > 0 ||
      payments.length > 0
    ) {
      setError(
        'Orders with payments cannot be cancelled.'
      )
      return
    }

    if (
      !window.confirm(
        'Cancel this order? This action cannot be reversed.'
      )
    ) {
      return
    }

    await updateStatus('cancelled')
  }

  const claimOrder = async () => {
    if (!order || order.status !== 'ready') {
      return
    }

    if (balance > 0) {
      setError(
        'Order must be fully paid before claiming.'
      )
      return
    }

    await updateStatus('claimed')
  }

  // ==========================================
  // RECORD PAYMENT
  // ==========================================

  const addPayment = async (
    data: PaymentFormData
  ) => {
    if (!id || !order || paymentLoading) {
      return
    }

    if (
      order.status === 'cancelled' ||
      order.status === 'claimed'
    ) {
      setError(
        'Payments are not allowed for this order.'
      )
      return
    }

    if (balance <= 0) {
      setError('Order is already fully paid.')
      return
    }

    if (
      Math.round(data.amount * 100) >
      Math.round(balance * 100)
    ) {
      setError(
        `Payment cannot exceed ${peso(balance)}.`
      )
      return
    }

    try {
      setPaymentLoading(true)
      setError('')
      setSuccess('')

      await api.post('/payments', {
        order: id,
        amount: data.amount,
        method: data.method,
        remarks: data.remarks.trim(),
      })

      reset({
        amount: 1,
        method: 'cash',
        remarks: '',
      })

      await loadOrder(false)

      setSuccess(
        'Payment recorded successfully.'
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to record payment.'
        )
      )
    } finally {
      setPaymentLoading(false)
    }
  }

  // ==========================================
  // LOADING / NOT FOUND
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading order details...
        </p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          Order Not Found
        </h1>

        <p className="mt-2 text-slate-500">
          {error ||
            'The requested order could not be loaded.'}
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

  const selectedMachine =
    order.status === 'received'
      ? selectedWasher
      : selectedDryer

  const currentMachineType =
    order.status === 'received'
      ? 'washer'
      : 'dryer'

  const assignedWasher =
    order.washer || order.machine

  // ==========================================
  // PAGE
  // ==========================================

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
            Order #{shortId(order._id)}
          </h1>

          <p className="mt-2 text-slate-500">
            Created {formatDateTime(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Print Receipt
          </button>

          <StatusBadge status={order.status} />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* PROGRESS */}

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
          Laundry Progress
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Order Workflow
        </h2>

        {order.status === 'cancelled' ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Order Cancelled
            </p>
            <p className="mt-1 text-sm text-red-600">
              This order was cancelled before
              processing began.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {STATUSES.map((status, index) => {
              const currentIndex =
                STATUSES.indexOf(order.status)

              return (
                <ProgressStep
                  key={status}
                  label={capitalize(status)}
                  completed={
                    index < currentIndex
                  }
                  current={
                    status === order.status
                  }
                  number={index + 1}
                />
              )
            })}
          </div>
        )}

        {/* MACHINE ASSIGNMENT */}

        {['received', 'washing'].includes(
          order.status
        ) && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <h3 className="font-bold text-slate-900">
              {order.status === 'received'
                ? 'Assign a Washer'
                : 'Assign a Dryer'}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {order.status === 'received'
                ? 'Select an available washer to begin washing.'
                : 'Washing is complete. Select an available dryer to continue.'}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedMachine}
                onChange={(event) => {
                  if (
                    currentMachineType === 'washer'
                  ) {
                    setSelectedWasher(
                      event.target.value
                    )
                  } else {
                    setSelectedDryer(
                      event.target.value
                    )
                  }
                }}
                disabled={
                  machinesLoading ||
                  actionLoading
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 disabled:bg-slate-100"
              >
                <option value="">
                  {machinesLoading
                    ? 'Checking availability...'
                    : `Select ${currentMachineType}`}
                </option>

                {machines.map((machine) => (
                  <option
                    key={machine._id}
                    value={machine._id}
                  >
                    {machine.name} —{' '}
                    {machine.capacityKg} kg
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  void loadMachines()
                }
                disabled={
                  machinesLoading ||
                  actionLoading
                }
                className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() =>
                  void (
                    order.status === 'received'
                      ? startWashing()
                      : startDrying()
                  )
                }
                disabled={
                  actionLoading ||
                  machinesLoading ||
                  !selectedMachine
                }
                className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading
                  ? 'Updating...'
                  : order.status === 'received'
                    ? 'Start Washing'
                    : 'Start Drying'}
              </button>
            </div>

            {!machinesLoading &&
              machines.length === 0 && (
                <p className="mt-3 text-sm text-amber-700">
                  No available{' '}
                  {currentMachineType} can handle
                  this load. Check the Machines
                  page or wait for a machine to
                  become available.
                </p>
              )}

            {order.status === 'received' && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    void cancelOrder()
                  }
                  disabled={
                    actionLoading ||
                    paymentLoading ||
                    totalPaid > 0 ||
                    payments.length > 0
                  }
                  className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel Order
                </button>

                <p className="mt-2 text-xs text-slate-500">
                  Cancellation is only allowed
                  before washing, and only if
                  no payment has been recorded.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FOLDING */}

        {order.status === 'drying' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="font-semibold text-slate-900">
              Drying in Progress
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Dryer:{' '}
              {order.dryer?.name || '—'}.
              When drying is complete, move
              this order to folding. The dryer
              will become available again.
            </p>

            <button
              type="button"
              onClick={() =>
                void updateStatus('folding')
              }
              disabled={actionLoading}
              className="mt-4 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
            >
              {actionLoading
                ? 'Updating...'
                : 'Start Folding'}
            </button>
          </div>
        )}

        {/* READY */}

        {order.status === 'folding' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="font-semibold text-slate-900">
              Folding in Progress
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Both washer and dryer are now
              available for other orders.
              Mark this order ready when
              folding is finished.
            </p>

            <button
              type="button"
              onClick={() =>
                void updateStatus('ready')
              }
              disabled={actionLoading}
              className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {actionLoading
                ? 'Updating...'
                : 'Mark Ready for Pickup'}
            </button>
          </div>
        )}

        {order.status === 'ready' && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-800">
              Laundry Ready for Pickup
            </p>

            <p className="mt-1 text-sm text-amber-700">
              Complete the remaining payment
              before releasing the laundry
              to the customer.
            </p>
          </div>
        )}

        {order.status === 'claimed' && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-700">
              ✓ Transaction Complete
            </p>

            <p className="mt-1 text-sm text-green-600">
              Claimed:{' '}
              {formatDateTime(order.claimedAt)}
            </p>
          </div>
        )}
      </section>

      {/* DETAILS + PAYMENT */}

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
                  order.customer?.fullName || '—'
                }
              />

              <Info
                label="Phone"
                value={
                  order.customer?.phone || '—'
                }
              />

              <div className="md:col-span-2">
                <Info
                  label="Address"
                  value={
                    order.customer?.address ||
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
                  order.service?.name || '—'
                }
              />

              <Info
                label="Priority"
                value={getPriorityLabel(
                  order.service?.name
                )}
              />

              <Info
                label="Weight"
                value={`${order.weightKg} kg`}
              />

              <Info
                label="Discount"
                value={`${order.discountPercent}%`}
              />

              <Info
                label="Washer"
                value={
                  assignedWasher?.name ||
                  'Not assigned yet'
                }
              />

              <Info
                label="Dryer"
                value={
                  order.dryer?.name ||
                  'Not assigned yet'
                }
              />

              <Info
                label="Due Date"
                value={formatDateTime(
                  order.dueDate
                )}
              />

              <Info
                label="Washing Started"
                value={formatDateTime(
                  order.washingStartedAt
                )}
              />

              <Info
                label="Drying Started"
                value={formatDateTime(
                  order.dryingStartedAt
                )}
              />

              <Info
                label="Folding Started"
                value={formatDateTime(
                  order.foldingStartedAt
                )}
              />

              <Info
                label="Ready At"
                value={formatDateTime(
                  order.readyAt
                )}
              />

              <Info
                label="Claimed At"
                value={formatDateTime(
                  order.claimedAt
                )}
              />

              <div className="md:col-span-2">
                <Info
                  label="Notes"
                  value={
                    order.notes || 'No notes'
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
                Payments recorded for this order.
              </p>
            </div>

            {payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No payments recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-5 py-4">
                        Date
                      </th>
                      <th className="px-5 py-4">
                        Method
                      </th>
                      <th className="px-5 py-4">
                        Remarks
                      </th>
                      <th className="px-5 py-4 text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment._id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDateTime(
                            payment.paidAt
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                            {payment.method}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {payment.remarks || '—'}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {peso(payment.amount)}
                        </td>
                      </tr>
                    ))}
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
                  {peso(balance)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Payment Status
              </span>

              <PaymentBadge
                status={paymentStatus}
              />
            </div>
          </div>

          {/* PAYMENT FORM */}

          {balance > 0 &&
            order.status !== 'cancelled' &&
            order.status !== 'claimed' && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-900">
                  Record Payment
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the amount received
                  from the customer.
                </p>

                <form
                  onSubmit={handleSubmit(
                    addPayment
                  )}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Amount
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={balance}
                      step="0.01"
                      {...register('amount', {
                        valueAsNumber: true,
                      })}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                    />

                    {errors.amount && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.amount.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Method
                    </label>

                    <select
                      {...register('method')}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500"
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

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Remarks
                    </label>

                    <textarea
                      {...register('remarks')}
                      rows={3}
                      placeholder="Optional payment remarks"
                      className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      paymentLoading ||
                      actionLoading
                    }
                    className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
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
            order.status !== 'cancelled' && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="font-bold text-green-700">
                  ✓ Fully Paid
                </p>

                <p className="mt-1 text-sm text-green-600">
                  No remaining balance.
                </p>
              </div>
            )}

          {/* CLAIM */}

          {order.status === 'ready' && (
            <div className="mt-5">
              <button
                type="button"
                disabled={
                  balance > 0 ||
                  actionLoading ||
                  paymentLoading
                }
                onClick={() =>
                  void claimOrder()
                }
                className="w-full rounded-xl bg-green-600 px-5 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-40"
              >
                {actionLoading
                  ? 'Processing...'
                  : 'Claim Order'}
              </button>

              {balance > 0 && (
                <p className="mt-2 text-center text-xs font-medium text-amber-600">
                  Complete the remaining payment
                  before claiming.
                </p>
              )}
            </div>
          )}

          {order.status === 'claimed' && (
            <div className="mt-5 rounded-xl bg-green-50 p-4 text-center">
              <p className="font-bold text-green-700">
                ✓ Order Claimed
              </p>

              <p className="mt-1 text-sm text-green-600">
                {formatDateTime(
                  order.claimedAt
                )}
              </p>
            </div>
          )}

          {order.status === 'cancelled' && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-center">
              <p className="font-bold text-red-700">
                Order Cancelled
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* PRINTABLE RECEIPT (hidden on screen) */}

      <Receipt
        order={order}
        payments={payments}
        totalPaid={totalPaid}
        balance={balance}
      />
    </div>
  )
}

// ==========================================
// DISPLAY COMPONENTS
// ==========================================

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
        {peso(value)}
      </span>
    </div>
  )
}

function ProgressStep({
  label,
  completed,
  current,
  number,
}: {
  label: string
  completed: boolean
  current: boolean
  number: number
}) {
  const containerStyle = current
    ? 'border-cyan-500 bg-cyan-50'
    : completed
      ? 'border-green-200 bg-green-50'
      : 'border-slate-200 bg-slate-50'

  const circleStyle = current
    ? 'bg-cyan-500 text-white'
    : completed
      ? 'bg-green-600 text-white'
      : 'bg-slate-200 text-slate-500'

  const labelStyle = current
    ? 'text-cyan-700'
    : completed
      ? 'text-green-700'
      : 'text-slate-500'

  return (
    <div
      className={`rounded-xl border p-4 ${containerStyle}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circleStyle}`}
        >
          {completed ? '✓' : number}
        </div>

        <span
          className={`text-sm font-semibold ${labelStyle}`}
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
  const styles: Record<OrderStatus, string> = {
    received: 'bg-blue-100 text-blue-700',
    washing: 'bg-purple-100 text-purple-700',
    drying: 'bg-cyan-100 text-cyan-700',
    folding: 'bg-indigo-100 text-indigo-700',
    ready: 'bg-amber-100 text-amber-700',
    claimed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
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

export default OrderDetails