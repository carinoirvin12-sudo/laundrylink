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

type Machine = {

  _id: string

  name: string

  type: 'washer' | 'dryer'

  capacityKg: number

  status: 'active' | 'maintenance'

  isBusy?: boolean

  isAvailable?: boolean

  availabilityStatus?: string

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

  machineId: z

    .string()

    .min(1, 'Please select a machine'),

  notes: z.string(),

})

type OrderFormData = z.infer<typeof orderSchema>

function NewOrder() {

  const navigate = useNavigate()

  const [customerMode, setCustomerMode] =

    useState<CustomerMode>('new')

  const [customers, setCustomers] = useState<Customer[]>([])

  const [services, setServices] = useState<Service[]>([])

  const [machines, setMachines] = useState<Machine[]>([])

  const [quote, setQuote] = useState<Quote | null>(null)

  const [loading, setLoading] = useState(true)

  const [machinesLoading, setMachinesLoading] = useState(false)

  const [quoteLoading, setQuoteLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')

  const {

    register,

    handleSubmit,

    watch,

    resetField,

    setValue,

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

      machineId: '',

      notes: '',

    },

  })

  const existingCustomerId = watch('existingCustomerId')

  const serviceId = watch('serviceId')

  const weightKg = watch('weightKg')

  const machineId = watch('machineId')

  const fullName = watch('fullName')

  // Load customers and active services.

  useEffect(() => {

    let active = true

    const loadSetupData = async () => {

      try {

        setLoading(true)

        setError('')

        const [customerResponse, serviceResponse] =

          await Promise.all([

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

          serviceData.filter((service) => service.isActive)

        )

      } catch (err) {

        if (!active) return

        setError(

          getErrorMessage(

            err,

            'Unable to load order setup data.'

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

  // Refresh available machines when weight changes.

  useEffect(() => {

    let active = true

    const numericWeight = Number(weightKg)

    if (

      !Number.isFinite(numericWeight) ||

      numericWeight < 1 ||

      numericWeight > 15

    ) {

      setMachines([])

      setValue('machineId', '')

      setMachinesLoading(false)

      return

    }

    // Clear old results while checking new capacity.

    setMachines([])

    setMachinesLoading(true)

    const loadMachines = async () => {

      try {

        const response = await api.get('/machines/availability', {

          params: {

            weightKg: numericWeight,

          },

        })

        if (!active) return

        const machineData: Machine[] =

          Array.isArray(response.data)

            ? response.data

            : []

        const availableMachines = machineData.filter(

          (machine) =>

            machine.status !== 'maintenance' &&

            machine.isBusy !== true &&

            machine.isAvailable !== false &&

            machine.capacityKg >= numericWeight

        )

        setMachines(availableMachines)

        const currentMachineId = machineId

        if (

          currentMachineId &&

          !availableMachines.some(

            (machine) => machine._id === currentMachineId

          )

        ) {

          setValue('machineId', '')

        }

      } catch (err) {

        if (!active) return

        setMachines([])

        setValue('machineId', '')

        setError(

          getErrorMessage(

            err,

            'Unable to check machine availability.'

          )

        )

      } finally {

        if (active) {

          setMachinesLoading(false)

        }

      }

    }

    void loadMachines()

    return () => {

      active = false

    }

    // Machine list should refresh for weight changes,

    // not every time the selected machine changes.

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [weightKg, setValue])

  // Calculate quotation.

  useEffect(() => {

    let active = true

    const numericWeight = Number(weightKg)

    const validWeight =

      Number.isFinite(numericWeight) &&

      numericWeight >= 1 &&

      numericWeight <= 15

    const validCustomer =

      customerMode === 'new' || Boolean(existingCustomerId)

    if (!serviceId || !validWeight || !validCustomer) {

      setQuote(null)

      setQuoteLoading(false)

      return

    }

    // Prevent stale quotation being displayed.

    setQuote(null)

    setQuoteLoading(true)

    const timer = window.setTimeout(async () => {

      try {

        if (customerMode === 'existing') {

          const response = await api.post('/orders/quote', {

            customer: existingCustomerId,

            service: serviceId,

            weightKg: numericWeight,

          })

          if (!active) return

          setQuote(normalizeQuote(response.data))

          return

        }

        const selectedService = services.find(

          (service) => service._id === serviceId

        )

        if (!active) return

        if (!selectedService) {

          setQuote(null)

          return

        }

        setQuote(

          calculateNewCustomerPreview(

            selectedService,

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

  const selectedService = useMemo(

    () =>

      services.find(

        (service) => service._id === serviceId

      ),

    [services, serviceId]

  )

  const selectedMachine = useMemo(

    () =>

      machines.find(

        (machine) => machine._id === machineId

      ),

    [machines, machineId]

  )

  const selectedCustomer = useMemo(

    () =>

      customers.find(

        (customer) => customer._id === existingCustomerId

      ),

    [customers, existingCustomerId]

  )

  const changeCustomerMode = (mode: CustomerMode) => {

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

  const createOrder = async (data: OrderFormData) => {

    if (submitting) return

    setError('')

    if (

      customerMode === 'existing' &&

      !customers.some(

        (customer) => customer._id === data.existingCustomerId

      )

    ) {

      setError('Please select a valid existing customer.')

      return

    }

    if (customerMode === 'new') {

      if (data.fullName.trim().length < 2) {

        setFieldError('fullName', {
          type: 'manual',
          message: 'Full name must be at least 2 characters.',
        }, { shouldFocus: true })

        return

      }

      if (!/^09\d{9}$/.test(data.phone.trim())) {

        setFieldError('phone', {
          type: 'manual',
          message: 'Phone number must be 11 digits and start with 09.',
        }, { shouldFocus: true })

        return

      }

    }

    if (!selectedService || !selectedService.isActive) {

      setError('Please select an active service.')

      return

    }

    if (machinesLoading) {

      setError(

        'Please wait while machine availability is being checked.'

      )

      return

    }

    const validMachine = machines.find(

      (machine) =>

        machine._id === data.machineId &&

        machine.status !== 'maintenance' &&

        machine.isBusy !== true &&

        machine.isAvailable !== false &&

        machine.capacityKg >= data.weightKg

    )

    if (!validMachine) {

      setError(

        'Selected machine is no longer available. Please choose another machine.'

      )

      return

    }

    try {

      setSubmitting(true)

      const commonPayload = {

        service: data.serviceId,

        machine: data.machineId,

        weightKg: data.weightKg,

        notes: data.notes.trim(),

      }

      const payload =

        customerMode === 'new'

          ? {

            customerType: 'new',

            customer: {

              fullName: data.fullName.trim(),

              phone: data.phone.trim(),

              address: data.address.trim(),

            },

            ...commonPayload,

          }

          : {

            customerType: 'existing',

            customerId: data.existingCustomerId,

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

          'Order was created but no order ID was returned.'

        )

      }

      navigate(`/orders/${createdOrder._id}`)

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

  if (loading) {

    return (

      <div className="rounded-2xl bg-white p-8 shadow-sm">

        <p className="text-slate-500">

          Loading new order form...

        </p>

      </div>

    )

  }

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

          Create a laundry transaction for a new or

          returning customer.

        </p>

      </div>

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

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">

                  Step 1

                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">

                  Customer

                </h2>

              </div>

              {/* CUSTOMER MODE */}

              <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">

                <button

                  type="button"

                  onClick={() =>

                    changeCustomerMode('new')

                  }

                  aria-pressed={customerMode === 'new'}

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

                  aria-pressed={customerMode === 'existing'}

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
                      <p className="mt-1 text-sm text-red-600" role="alert">
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
                      <p className="mt-1 text-sm text-red-600" role="alert">
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

                    {...register('existingCustomerId')}

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

                        {customer.fullName} — {customer.phone}

                      </option>

                    ))}

                  </select>

                  {customers.length === 0 && (

                    <p className="mt-2 text-sm text-amber-600">

                      No existing customers found.

                      Use New Customer instead.

                    </p>

                  )}

                </div>

              )}

            </section>

            {/* LAUNDRY DETAILS */}

            <section className="rounded-2xl bg-white p-6 shadow-sm">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">

                  Step 2

                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">

                  Laundry Details

                </h2>

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                {/* SERVICE */}

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">

                    Service

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

                        {service.name} — ₱

                        {service.pricePerKg}/kg

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

                      Add a service first.

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

                  {/* Manual split reminder */}

                  <p className="mt-2 text-xs text-slate-500">

                    Maximum 15 kg per order. For laundry exceeding

                    15 kg, create separate orders for the same customer.

                  </p>

                </div>

                {/* MACHINE */}

                <div className="md:col-span-2">

                  <label className="mb-2 block text-sm font-medium text-slate-700">

                    Available Machine

                  </label>

                  <select

                    {...register('machineId')}

                    disabled={

                      machinesLoading ||

                      !Number.isFinite(Number(weightKg)) ||

                      Number(weightKg) < 1 ||

                      Number(weightKg) > 15

                    }

                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 disabled:bg-slate-100"

                  >

                    <option value="">

                      {machinesLoading

                        ? 'Checking machines...'

                        : 'Select machine'}

                    </option>

                    {machines.map((machine) => (

                      <option

                        key={machine._id}

                        value={machine._id}

                      >

                        {machine.name} —{' '}

                        {capitalize(machine.type)} —{' '}

                        {machine.capacityKg} kg

                      </option>

                    ))}

                  </select>

                  {errors.machineId && (

                    <p className="mt-1 text-sm text-red-600">

                      {errors.machineId.message}

                    </p>

                  )}

                  {!machinesLoading &&

                    Number(weightKg) >= 1 &&

                    machines.length === 0 && (

                      <p className="mt-2 text-sm text-amber-600">

                        No available machine can handle

                        this load.

                      </p>

                    )}

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

          {/* SUMMARY */}

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

                label="Machine"

                value={

                  selectedMachine?.name ||

                  'Not selected'

                }

              />

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

                {/* DISCOUNT INDICATOR */}

                {quote.discountPercent > 0 && (

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm dark:border-cyan-800 dark:bg-cyan-950">

                    <span className="font-semibold text-cyan-800 dark:text-cyan-200">

                      {Number(weightKg) >= 10

                        ? '📦 Bulk Discount — 10% OFF'

                        : customerMode === 'existing'

                          ? '⭐ Loyalty Discount — 5% OFF'

                          : 'Discount Applied'}

                    </span>

                  </div>

                )}

                {quote.discountAmount > 0 && (

                  <PriceRow

                    label="Discount Amount"

                    value={-quote.discountAmount}

                  />

                )}

                <div className="border-t border-slate-200 pt-4">

                  <div className="flex items-end justify-between gap-3">

                    <span className="font-semibold text-slate-700">

                      Total

                    </span>

                    <span className="text-3xl font-bold text-slate-950">

                      ₱{quote.totalPrice.toFixed(2)}

                    </span>

                  </div>

                </div>

              </div>

            ) : (

              <p className="text-sm leading-6 text-slate-500">

                {customerMode === 'existing' &&

                  !existingCustomerId

                  ? 'Select an existing customer to calculate the correct price.'

                  : 'Select a service and enter the laundry weight to calculate the order price.'}

              </p>

            )}

            <button

              type="submit"

              disabled={

                submitting ||

                machinesLoading ||

                !selectedMachine ||

                !selectedService

              }

              className="mt-6 w-full rounded-xl bg-cyan-500 px-5 py-3.5 font-bold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"

            >

              {submitting

                ? 'Creating Order...'

                : 'Create Laundry Order'}

            </button>

            <button

              type="button"

              onClick={() => navigate('/orders')}

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

        {value < 0 ? '-' : ''}₱

        {Math.abs(value).toFixed(2)}

      </span>

    </div>

  )

}

function calculateNewCustomerPreview(

  service: Service,

  weightKg: number

): Quote {

  const subtotal = Math.max(

    weightKg * service.pricePerKg,

    service.minCharge

  )

  const discountPercent =

    weightKg >= 10 ? 10 : 0

  const discountAmount =

    subtotal * (discountPercent / 100)

  const totalPrice =

    subtotal - discountAmount

  return {

    subtotal,

    discountPercent,

    discountAmount,

    totalPrice,

  }

}

function normalizeQuote(

  data: Record<string, unknown>

): Quote {

  const subtotal = Number(

    data.subtotal ?? 0

  )

  const discountPercent = Number(

    data.discountPercent ?? 0

  )

  const calculatedDiscount =

    subtotal * (discountPercent / 100)

  const discountAmount = Number(

    data.discountAmount ?? calculatedDiscount

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

function capitalize(value: string) {

  return (

    value.charAt(0).toUpperCase() +

    value.slice(1)

  )

}

function getErrorMessage(

  error: unknown,

  fallback: string

) {

  if (axios.isAxiosError(error)) {

    return (

      error.response?.data?.message ||

      fallback

    )

  }

  if (error instanceof Error) {

    return error.message

  }

  return fallback

}

export default NewOrder
