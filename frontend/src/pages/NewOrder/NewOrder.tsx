
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'

type CustomerMode = 'new' | 'existing'

type Customer = {
  _id: string
  fullName: string
  phone: string
  address?: string
}

type Service = {
  _id: string
  name: string
  pricePerKg: number
  minCharge: number
  turnaroundHours: number
  isActive: boolean
}

type Quote = {
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalPrice: number
  dueDate?: string
}

const orderSchema = z.object({
  existingCustomerId: z.string(),
  fullName: z.string(),
  phone: z.string(),
  address: z.string(),

  serviceId: z
    .string()
    .min(1, 'Please select a service'),

  weightKg: z
    .number()
    .finite('Enter a valid weight')
    .min(1, 'Weight must be at least 1 kg')
    .max(15, 'Weight cannot exceed 15 kg'),

  notes: z.string(),
})

type OrderFormData = z.infer<typeof orderSchema>

const peso = (amount: number) =>
  `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
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

function calculateNewCustomerPreview(
  service: Service,
  weightKg: number
): Quote {
  const pricePerKgCentavos = Math.round(
    service.pricePerKg * 100
  )

  const minChargeCentavos = Math.round(
    service.minCharge * 100
  )

  const subtotalCentavos = Math.max(
    Math.round(weightKg * pricePerKgCentavos),
    minChargeCentavos
  )

  const discountPercent =
    weightKg >= 10 ? 5 : 0

  const discountCentavos = Math.round(
    subtotalCentavos * (discountPercent / 100)
  )

  return {
    subtotal: subtotalCentavos / 100,
    discountPercent,
    discountAmount: discountCentavos / 100,
    totalPrice:
      (subtotalCentavos - discountCentavos) / 100,
    dueDate: new Date(
      Date.now() +
      service.turnaroundHours * 60 * 60 * 1000
    ).toISOString(),
  }
}

function normalizeQuote(
  data: Record<string, unknown>
): Quote {
  const subtotal = Number(data.subtotal ?? 0)
  const discountPercent = Number(
    data.discountPercent ?? 0
  )

  const discountAmount = Number(
    data.discountAmount ??
    Math.round(
      subtotal * discountPercent
    ) / 100
  )

  const totalPrice = Number(
    data.totalPrice ??
    subtotal - discountAmount
  )

  return {
    subtotal,
    discountPercent,
    discountAmount,
    totalPrice,
    dueDate:
      typeof data.dueDate === 'string'
        ? data.dueDate
        : undefined,
  }
}

function getPriorityLabel(name: string): string {
  if (name === 'Express Laundry') {
    return 'Highest priority'
  }

  if (name === 'Priority Laundry') {
    return 'High priority'
  }

  return 'Normal priority'
}

function NewOrder() {
  const navigate = useNavigate()

  const [customerMode, setCustomerMode] =
    useState<CustomerMode>('new')

  const [customers, setCustomers] = useState<
    Customer[]
  >([])

  const [services, setServices] = useState<
    Service[]
  >([])

  const [quote, setQuote] = useState<Quote | null>(
    null
  )

  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] =
    useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    setError: setFieldError,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      existingCustomerId: '',
      fullName: '',
      phone: '',
      address: '',
      serviceId: '',
      weightKg: 1,
      notes: '',
    },
  })

  const existingCustomerId = watch(
    'existingCustomerId'
  )

  const serviceId = watch('serviceId')
  const weightKg = watch('weightKg')
  const fullName = watch('fullName')

  const selectedService = useMemo(
    () =>
      services.find(
        (service) => service._id === serviceId
      ),
    [services, serviceId]
  )

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (customer) =>
          customer._id === existingCustomerId
      ),
    [customers, existingCustomerId]
  )

  // ==========================================
  // LOAD CUSTOMERS AND SERVICES
  // ==========================================

  useEffect(() => {
    let active = true

    const loadSetupData = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          customerResponse,
          serviceResponse,
        ] = await Promise.all([
          api.get('/customers'),
          api.get('/services'),
        ])

        if (!active) return

        const customerData: Customer[] =
          Array.isArray(customerResponse.data)
            ? customerResponse.data
            : []

        const serviceData: Service[] =
          Array.isArray(serviceResponse.data)
            ? serviceResponse.data
            : []

        setCustomers(customerData)

        setServices(
          serviceData.filter(
            (service) => service.isActive
          )
        )
      } catch (err) {
        if (!active) return

        setError(
          getErrorMessage(
            err,
            'Unable to load customers and services.'
          )
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSetupData()

    return () => {
      active = false
    }
  }, [])

  // ==========================================
  // LIVE PRICE QUOTATION
  // ==========================================

  useEffect(() => {
    let active = true

    const numericWeight = Number(weightKg)

    const validWeight =
      Number.isFinite(numericWeight) &&
      numericWeight >= 1 &&
      numericWeight <= 15

    const validCustomer =
      customerMode === 'new' ||
      Boolean(existingCustomerId)

    if (
      !serviceId ||
      !validWeight ||
      !validCustomer
    ) {
      setQuote(null)
      setQuoteLoading(false)
      return
    }

    setQuote(null)
    setQuoteLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        if (customerMode === 'existing') {
          const response = await api.post(
            '/orders/quote',
            {
              customer: existingCustomerId,
              service: serviceId,
              weightKg: numericWeight,
            }
          )

          if (!active) return

          setQuote(
            normalizeQuote(response.data)
          )

          return
        }

        const service = services.find(
          (item) => item._id === serviceId
        )

        if (!active) return

        if (!service) {
          setQuote(null)
          return
        }

        setQuote(
          calculateNewCustomerPreview(
            service,
            numericWeight
          )
        )
      } catch {
        if (active) {
          setQuote(null)
        }
      } finally {
        if (active) {
          setQuoteLoading(false)
        }
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [
    customerMode,
    existingCustomerId,
    serviceId,
    weightKg,
    services,
  ])

  // ==========================================
  // CUSTOMER MODE
  // ==========================================

  const changeCustomerMode = (
    mode: CustomerMode
  ) => {
    setCustomerMode(mode)
    setError('')
    setQuote(null)

    if (mode === 'new') {
      resetField('existingCustomerId')
    } else {
      resetField('fullName')
      resetField('phone')
      resetField('address')
    }
  }

  // ==========================================
  // CREATE ORDER
  // ==========================================

  const createOrder = async (
    data: OrderFormData
  ) => {
    if (submitting) return

    setError('')

    if (customerMode === 'existing') {
      const exists = customers.some(
        (customer) =>
          customer._id ===
          data.existingCustomerId
      )

      if (!exists) {
        setFieldError('existingCustomerId', {
          type: 'manual',
          message:
            'Please select an existing customer.',
        })

        return
      }
    }

    if (customerMode === 'new') {
      if (data.fullName.trim().length < 2) {
        setFieldError(
          'fullName',
          {
            type: 'manual',
            message:
              'Full name must be at least 2 characters.',
          },
          { shouldFocus: true }
        )

        return
      }

      if (!/^09\d{9}$/.test(data.phone.trim())) {
        setFieldError(
          'phone',
          {
            type: 'manual',
            message:
              'Phone must be 11 digits and start with 09.',
          },
          { shouldFocus: true }
        )

        return
      }
    }

    if (
      !selectedService ||
      !selectedService.isActive
    ) {
      setError(
        'Please select an active laundry service.'
      )

      return
    }

    try {
      setSubmitting(true)

      // No machine is assigned during creation.
      // Washer and dryer are selected later.
      const commonPayload = {
        service: data.serviceId,
        weightKg: data.weightKg,
        notes: data.notes.trim(),
      }

      const payload =
        customerMode === 'new'
          ? {
            customerType: 'new',
            customer: {
              fullName:
                data.fullName.trim(),
              phone: data.phone.trim(),
              address: data.address.trim(),
            },
            ...commonPayload,
          }
          : {
            customerType: 'existing',
            customerId:
              data.existingCustomerId,
            ...commonPayload,
          }

      const response = await api.post(
        '/orders/pos',
        payload
      )

      const createdOrder =
        response.data.order ?? response.data

      if (!createdOrder?._id) {
        throw new Error(
          'Order response did not contain an ID.'
        )
      }

      navigate(
        `/orders/${createdOrder._id}`
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to create laundry order.'
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading new order form...
        </p>
      </div>
    )
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="mx-auto max-w-6xl">
      {/* HEADER */}

      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
          Transaction
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          New Laundry Order
        </h1>

        <p className="mt-2 text-slate-500">
          Create a full-service laundry
          transaction. Orders enter the
          processing queue automatically.
        </p>
      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(createOrder)}>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">

            {/* CUSTOMER */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                Step 1
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Customer
              </h2>

              <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    changeCustomerMode('new')
                  }
                  aria-pressed={
                    customerMode === 'new'
                  }
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${customerMode === 'new'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500'
                    }`}
                >
                  New Customer
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeCustomerMode('existing')
                  }
                  aria-pressed={
                    customerMode === 'existing'
                  }
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${customerMode === 'existing'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500'
                    }`}
                >
                  Existing Customer
                </button>
              </div>

              {customerMode === 'new' ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Full Name
                    </label>

                    <input
                      {...register('fullName')}
                      placeholder="Customer full name"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                    />

                    {errors.fullName && (
                      <p
                        className="mt-1 text-sm text-red-600"
                        role="alert"
                      >
                        {errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Phone Number
                    </label>

                    <input
                      {...register('phone')}
                      placeholder="09XXXXXXXXX"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                    />

                    {errors.phone && (
                      <p
                        className="mt-1 text-sm text-red-600"
                        role="alert"
                      >
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Address
                    </label>

                    <input
                      {...register('address')}
                      placeholder="Customer address"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Select Customer
                  </label>

                  <select
                    {...register(
                      'existingCustomerId'
                    )}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500"
                  >
                    <option value="">
                      Select customer
                    </option>

                    {customers.map((customer) => (
                      <option
                        key={customer._id}
                        value={customer._id}
                      >
                        {customer.fullName} —{' '}
                        {customer.phone}
                      </option>
                    ))}
                  </select>

                  {errors.existingCustomerId && (
                    <p className="mt-1 text-sm text-red-600">
                      {
                        errors.existingCustomerId
                          .message
                      }
                    </p>
                  )}

                  {customers.length === 0 && (
                    <p className="mt-2 text-sm text-amber-600">
                      No existing customers.
                      Use New Customer instead.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* LAUNDRY DETAILS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                Step 2
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Laundry Details
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* SERVICE */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Laundry Service
                  </label>

                  <select
                    {...register('serviceId')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500"
                  >
                    <option value="">
                      Select service
                    </option>

                    {services.map((service) => (
                      <option
                        key={service._id}
                        value={service._id}
                      >
                        {service.name} —{' '}
                        {peso(
                          service.pricePerKg
                        )}
                        /kg
                      </option>
                    ))}
                  </select>

                  {errors.serviceId && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.serviceId.message}
                    </p>
                  )}

                  {services.length === 0 && (
                    <p className="mt-2 text-sm text-amber-600">
                      No active services found.
                      Add Standard, Priority,
                      and Express services first.
                    </p>
                  )}
                </div>

                {/* WEIGHT */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Weight (kg)
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="15"
                    step="0.1"
                    {...register('weightKg', {
                      valueAsNumber: true,
                    })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                  />

                  {errors.weightKg && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.weightKg.message}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-slate-500">
                    Maximum 15 kg per order.
                    For loads over 15 kg,
                    create separate orders.
                  </p>
                </div>

                {/* SERVICE DESCRIPTION */}

                {selectedService && (
                  <div className="md:col-span-2 rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <p className="font-semibold text-slate-900">
                      {selectedService.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      Wash + Dry + Fold
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      {getPriorityLabel(
                        selectedService.name
                      )}
                      {' · '}
                      Target turnaround:{' '}
                      {
                        selectedService
                          .turnaroundHours
                      }{' '}
                      hours
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Minimum charge:{' '}
                      {peso(
                        selectedService.minCharge
                      )}
                    </p>
                  </div>
                )}

                {/* MACHINE WORKFLOW INFO */}

                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    Machine Assignment
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No machine selection is
                    required when creating an
                    order. The order starts as
                    Received. Staff will assign
                    an available washer when
                    washing begins and a dryer
                    when drying begins.
                  </p>

                  <p className="mt-2 text-sm font-medium text-cyan-700">
                    Received → Washing → Drying
                    → Folding → Ready → Claimed
                  </p>
                </div>

                {/* NOTES */}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Optional laundry instructions"
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ORDER SUMMARY */}

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm xl:sticky xl:top-28">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
              Order Summary
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Laundry Order
            </h2>

            <div className="mt-6 space-y-4">
              <SummaryRow
                label="Customer"
                value={
                  customerMode === 'existing'
                    ? selectedCustomer?.fullName ||
                    'Not selected'
                    : fullName || 'New customer'
                }
              />

              <SummaryRow
                label="Service"
                value={
                  selectedService?.name ||
                  'Not selected'
                }
              />

              <SummaryRow
                label="Weight"
                value={
                  Number(weightKg) > 0
                    ? `${weightKg} kg`
                    : '—'
                }
              />

              <SummaryRow
                label="Initial Status"
                value="Received"
              />

              <SummaryRow
                label="Machine"
                value="Assigned during processing"
              />

              {selectedService && (
                <>
                  <SummaryRow
                    label="Priority"
                    value={getPriorityLabel(
                      selectedService.name
                    )}
                  />

                  <SummaryRow
                    label="Target Time"
                    value={`${selectedService.turnaroundHours} hours`}
                  />
                </>
              )}
            </div>

            <div className="my-6 border-t border-slate-200" />

            {quoteLoading ? (
              <p className="text-sm text-slate-500">
                Calculating price...
              </p>
            ) : quote ? (
              <div className="space-y-3">
                <PriceRow
                  label="Subtotal"
                  value={quote.subtotal}
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Discount
                  </span>

                  <span className="font-medium text-green-600">
                    {quote.discountPercent > 0
                      ? `${quote.discountPercent}%`
                      : 'None'}
                  </span>
                </div>

                {quote.discountPercent > 0 && (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-cyan-800">
                      {quote.discountPercent === 10
                        ? 'Bulk Discount (5%) + Loyalty Discount (5%) — 10% OFF'
                        : weightKg >= 10
                          ? 'Bulk Discount — 5% OFF'
                          : 'Loyalty Discount — 5% OFF'}
                    </span>
                  </div>
                )}
                {quote.discountAmount > 0 && (
                  <PriceRow
                    label="Discount Amount"
                    value={
                      -quote.discountAmount
                    }
                  />
                )}

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-end justify-between gap-3">
                    <span className="font-semibold text-slate-700">
                      Total
                    </span>

                    <span className="text-3xl font-bold text-slate-950">
                      {peso(
                        quote.totalPrice
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                {customerMode === 'existing' &&
                  !existingCustomerId
                  ? 'Select a customer to calculate the correct price.'
                  : 'Select a service and enter the laundry weight to see the total.'}
              </p>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                !selectedService ||
                (
                  customerMode === 'existing' &&
                  !existingCustomerId
                )
              }
              className="mt-6 w-full rounded-xl bg-cyan-500 px-5 py-3.5 font-bold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Creating Order...'
                : 'Create Laundry Order'}
            </button>

            <button
              type="button"
              onClick={() =>
                navigate('/orders')
              }
              disabled={submitting}
              className="mt-3 w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </aside>
        </div>
      </form>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="max-w-[190px] text-right text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  )
}

function PriceRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">
        {label}
      </span>

      <span
        className={
          value < 0
            ? 'font-semibold text-green-600'
            : 'font-semibold text-slate-800'
        }
      >
        {value < 0 ? '-' : ''}
        {peso(Math.abs(value))}
      </span>
    </div>
  )
}

export default NewOrder
