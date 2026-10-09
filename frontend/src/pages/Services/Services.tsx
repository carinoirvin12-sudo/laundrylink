
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'

type Service = {
  _id: string
  name: string
  pricePerKg: number
  minCharge: number
  turnaroundHours: number
  isActive: boolean
}

type DeleteResult = {
  message?: string
  archived?: boolean
}

type ServicePreset = {
  name: string
  pricePerKg: number
  minCharge: number
  turnaroundHours: number
  priority: string
  description: string
}

const SERVICE_PRESETS: ServicePreset[] = [
  {
    name: 'Standard Laundry',
    pricePerKg: 50,
    minCharge: 50,
    turnaroundHours: 24,
    priority: 'Normal Priority',
    description: 'Regular queue processing',
  },
  {
    name: 'Priority Laundry',
    pricePerKg: 65,
    minCharge: 65,
    turnaroundHours: 12,
    priority: 'High Priority',
    description: 'Processed ahead of Standard orders',
  },
  {
    name: 'Express Laundry',
    pricePerKg: 80,
    minCharge: 80,
    turnaroundHours: 6,
    priority: 'Highest Priority',
    description: 'Fastest available processing',
  },
]

const validMoney = (value: number) =>
  Number.isFinite(value) &&
  Math.abs(
    value * 100 - Math.round(value * 100)
  ) < 0.000001

const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),

  pricePerKg: z
    .number({
      message: 'Enter a valid price',
    })
    .finite('Enter a valid price')
    .min(1, 'Price must be at least ₱1')
    .refine(
      validMoney,
      'Use at most 2 decimal places'
    ),

  minCharge: z
    .number({
      message: 'Enter a valid minimum charge',
    })
    .finite('Enter a valid minimum charge')
    .min(0, 'Minimum charge cannot be negative')
    .refine(
      validMoney,
      'Use at most 2 decimal places'
    ),

  turnaroundHours: z
    .number({
      message: 'Enter turnaround hours',
    })
    .finite('Enter valid turnaround hours')
    .int('Use whole hours only')
    .min(1, 'Turnaround must be at least 1 hour'),

  isActive: z.boolean(),
})

type ServiceFormData = z.infer<
  typeof serviceSchema
>

const DEFAULT_FORM: ServiceFormData = {
  name: 'Standard Laundry',
  pricePerKg: 50,
  minCharge: 50,
  turnaroundHours: 24,
  isActive: true,
}

function money(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value) || 0)
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
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

function getPriority(name: string): string {
  const preset = SERVICE_PRESETS.find(
    (service) => service.name === name
  )

  return preset?.priority || 'Custom Service'
}

function getPriorityStyles(
  name: string
): string {
  if (name === 'Express Laundry') {
    return 'bg-purple-100 text-purple-700'
  }

  if (name === 'Priority Laundry') {
    return 'bg-amber-100 text-amber-700'
  }

  if (name === 'Standard Laundry') {
    return 'bg-cyan-100 text-cyan-700'
  }

  return 'bg-slate-100 text-slate-700'
}

function Services() {
  const [services, setServices] = useState<
    Service[]
  >([])

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [formOpen, setFormOpen] =
    useState(false)

  const [editing, setEditing] =
    useState<Service | null>(null)

  const [workingId, setWorkingId] =
    useState<string | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showInactive, setShowInactive] =
    useState(true)

  const {
    register,
    reset,
    setValue,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: DEFAULT_FORM,
  })

  // ==========================================
  // LOAD SERVICES
  // ==========================================

  const refresh = async () => {
    try {
      setRefreshing(true)

      const response = await api.get<Service[]>(
        '/services'
      )

      if (!Array.isArray(response.data)) {
        throw new Error(
          'Unexpected services response'
        )
      }

      setServices(response.data)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadServices = async () => {
      try {
        setLoading(true)

        const response = await api.get<Service[]>(
          '/services'
        )

        if (!mounted) return

        if (!Array.isArray(response.data)) {
          throw new Error(
            'Unexpected services response'
          )
        }

        setServices(response.data)
      } catch (err) {
        if (!mounted) return

        setError(
          getErrorMessage(
            err,
            'Unable to load services.'
          )
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadServices()

    return () => {
      mounted = false
    }
  }, [])

  // ==========================================
  // FORM ACTIONS
  // ==========================================

  const openAdd = () => {
    setEditing(null)
    reset(DEFAULT_FORM)
    setError('')
    setSuccess('')
    setFormOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditing(service)

    reset({
      name: service.name,
      pricePerKg: service.pricePerKg,
      minCharge: service.minCharge,
      turnaroundHours:
        service.turnaroundHours,
      isActive: service.isActive,
    })

    setError('')
    setSuccess('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setEditing(null)
    setFormOpen(false)
    reset(DEFAULT_FORM)
  }

  const applyPreset = (
    preset: ServicePreset
  ) => {
    setValue('name', preset.name, {
      shouldValidate: true,
    })

    setValue(
      'pricePerKg',
      preset.pricePerKg,
      {
        shouldValidate: true,
      }
    )

    setValue(
      'minCharge',
      preset.minCharge,
      {
        shouldValidate: true,
      }
    )

    setValue(
      'turnaroundHours',
      preset.turnaroundHours,
      {
        shouldValidate: true,
      }
    )

    setValue('isActive', true, {
      shouldValidate: true,
    })
  }

  // ==========================================
  // SAVE SERVICE
  // ==========================================

  const saveService = async (
    data: ServiceFormData
  ) => {
    try {
      setError('')
      setSuccess('')

      const payload = {
        name: data.name.trim(),
        pricePerKg: data.pricePerKg,
        minCharge: data.minCharge,
        turnaroundHours:
          data.turnaroundHours,
        isActive: data.isActive,
      }

      const wasEditing = Boolean(editing)

      if (editing) {
        await api.put(
          `/services/${editing._id}`,
          payload
        )
      } else {
        await api.post(
          '/services',
          payload
        )
      }

      await refresh()

      closeForm()

      setSuccess(
        wasEditing
          ? 'Service updated successfully.'
          : 'Service added successfully.'
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to save service.'
        )
      )
    }
  }

  // ==========================================
  // ACTIVATE / DEACTIVATE
  // ==========================================

  const toggleActive = async (
    service: Service
  ) => {
    if (workingId) return

    const action = service.isActive
      ? 'Deactivate'
      : 'Reactivate'

    const confirmed = window.confirm(
      `${action} "${service.name}"?`
    )

    if (!confirmed) return

    try {
      setWorkingId(service._id)
      setError('')
      setSuccess('')

      await api.put(
        `/services/${service._id}`,
        {
          isActive: !service.isActive,
        }
      )

      await refresh()

      setSuccess(
        `Service ${service.isActive
          ? 'deactivated'
          : 'reactivated'
        } successfully.`
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          `Unable to ${action.toLowerCase()} service.`
        )
      )
    } finally {
      setWorkingId(null)
    }
  }

  // ==========================================
  // REMOVE SERVICE
  // ==========================================

  const removeService = async (
    service: Service
  ) => {
    if (workingId) return

    const confirmed = window.confirm(
      `Remove "${service.name}"?\n\n` +
      'Unused services will be deleted. ' +
      'Services with order history will be deactivated instead.'
    )

    if (!confirmed) return

    try {
      setWorkingId(service._id)
      setError('')
      setSuccess('')

      const response =
        await api.delete<DeleteResult>(
          `/services/${service._id}`
        )

      await refresh()

      setSuccess(
        response.data.message ||
        (
          response.data.archived
            ? 'Service deactivated to preserve order history.'
            : 'Service deleted successfully.'
        )
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to remove service.'
        )
      )
    } finally {
      setWorkingId(null)
    }
  }

  // ==========================================
  // COUNTS / FILTERS
  // ==========================================

  const counts = useMemo(() => {
    const active = services.filter(
      (service) => service.isActive
    ).length

    return {
      total: services.length,
      active,
      inactive: services.length - active,
    }
  }, [services])

  const visibleServices = useMemo(() => {
    const filtered = showInactive
      ? services
      : services.filter(
        (service) => service.isActive
      )

    const priorityOrder: Record<
      string,
      number
    > = {
      'Express Laundry': 3,
      'Priority Laundry': 2,
      'Standard Laundry': 1,
    }

    return [...filtered].sort((a, b) => {
      const aPriority =
        priorityOrder[a.name] || 0

      const bPriority =
        priorityOrder[b.name] || 0

      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }

      return a.name.localeCompare(b.name)
    })
  }, [services, showInactive])

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600">
            Laundry Management
          </p>

          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Services
          </h1>

          <p className="mt-2 text-slate-500">
            Manage full-service laundry
            packages, pricing, and
            processing priority.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setError('')
              setSuccess('')

              void refresh().catch((err) => {
                setError(
                  getErrorMessage(
                    err,
                    'Unable to refresh services.'
                  )
                )
              })
            }}
            disabled={refreshing || loading}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
          >
            + Add Service
          </button>
        </div>
      </div>

      {/* SERVICE INFORMATION */}

      <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-slate-700 dark:bg-slate-800/80">
        <h2 className="font-bold text-slate-900 dark:text-slate-100">
          Full-Service Laundry Packages
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
          All packages include Wash + Dry + Fold. They differ in pricing,
          turnaround time, and priority while waiting for an available
          machine.
        </p>

        <p className="mt-2 text-xs font-medium text-cyan-800 dark:text-cyan-300">
          Express orders have the highest priority, followed by Priority
          and Standard. Running machine cycles are never interrupted.
        </p>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          The prices below are suggested demo configurations. They are
          saved only when you add a service.
        </p>
      </section>

      {/* PRESET PACKAGE CARDS */}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {SERVICE_PRESETS.map((preset) => {
          const existingService =
            services.find(
              (service) =>
                service.name === preset.name
            )

          return (
            <article
              key={preset.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-bold text-slate-900">
                  {preset.name}
                </h3>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityStyles(
                    preset.name
                  )}`}
                >
                  {preset.priority}
                </span>
              </div>

              <p className="mt-4 text-3xl font-black text-cyan-700">
                {money(preset.pricePerKg)}
                <span className="text-sm font-medium text-slate-500">
                  /kg
                </span>
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {preset.turnaroundHours}{' '}
                hours · {preset.description}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Minimum charge:{' '}
                {money(preset.minCharge)}
              </p>

              <p className="mt-3 text-sm font-semibold text-slate-700">
                Wash + Dry + Fold
              </p>

              <button
                type="button"
                onClick={() => {
                  if (existingService) {
                    openEdit(existingService)
                    return
                  }

                  openAdd()
                  applyPreset(preset)
                }}
                className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                {existingService
                  ? 'Edit Existing Service'
                  : 'Use This Package'}
              </button>

              {existingService && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  {existingService.isActive
                    ? 'Already added · Active'
                    : 'Already added · Inactive'}
                </p>
              )}
            </article>
          )
        })}
      </section>

      {/* MESSAGES */}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* FORM */}

      {formOpen && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-950">
              {editing
                ? 'Edit Service'
                : 'Add Service'}
            </h2>

            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          {!editing && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Quick-Fill Packages
              </p>

              <div className="flex flex-wrap gap-2">
                {SERVICE_PRESETS.map(
                  (preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        applyPreset(preset)
                      }
                      className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
                    >
                      {preset.name}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit(
              saveService
            )}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            {/* NAME */}

            <div className="sm:col-span-2">
              <label
                htmlFor="service-name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Service Name *
              </label>

              <input
                id="service-name"
                {...register('name')}
                placeholder="Standard Laundry"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900"
              />

              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* PRICE */}

            <div>
              <label
                htmlFor="service-price"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Price per Kg *
              </label>

              <input
                id="service-price"
                type="number"
                min="1"
                step="0.01"
                {...register('pricePerKg', {
                  valueAsNumber: true,
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900"
              />

              {errors.pricePerKg && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.pricePerKg.message}
                </p>
              )}
            </div>

            {/* MINIMUM */}

            <div>
              <label
                htmlFor="service-min"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Minimum Charge *
              </label>

              <input
                id="service-min"
                type="number"
                min="0"
                step="0.01"
                {...register('minCharge', {
                  valueAsNumber: true,
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900"
              />

              {errors.minCharge && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.minCharge.message}
                </p>
              )}
            </div>

            {/* TURNAROUND */}

            <div>
              <label
                htmlFor="service-hours"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Turnaround Hours *
              </label>

              <input
                id="service-hours"
                type="number"
                min="1"
                step="1"
                {...register('turnaroundHours', {
                  valueAsNumber: true,
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900"
              />

              {errors.turnaroundHours && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.turnaroundHours.message}
                </p>
              )}
            </div>

            {/* ACTIVE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Service Status
              </label>

              <label className="flex h-[50px] items-center gap-3 rounded-xl border border-slate-300 px-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  {...register('isActive')}
                />
                Service is active
              </label>
            </div>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Add Service'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* COUNTS AND FILTERS */}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {counts.total} total ·{' '}
          {counts.active} active ·{' '}
          {counts.inactive} inactive
        </p>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) =>
              setShowInactive(
                event.target.checked
              )
            }
          />
          Show inactive services
        </label>
      </div>

      {/* SERVICE LIST */}

      {loading ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-slate-500">
          Loading services...
        </div>
      ) : visibleServices.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
          No services to display.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => (
            <article
              key={service._id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              {/* SERVICE HEADER */}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {service.name}
                  </h2>

                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${service.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {service.isActive
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </div>

                <p className="whitespace-nowrap text-lg font-black text-cyan-700">
                  {money(
                    service.pricePerKg
                  )}
                  <span className="text-xs font-medium text-slate-500">
                    /kg
                  </span>
                </p>
              </div>

              {/* PRIORITY */}

              <div className="mt-4">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${getPriorityStyles(
                    service.name
                  )}`}
                >
                  {getPriority(service.name)}
                </span>
              </div>

              <p className="mt-3 text-sm font-medium text-slate-700">
                Wash + Dry + Fold
              </p>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">
                    Minimum Charge
                  </span>

                  <strong className="text-slate-900">
                    {money(
                      service.minCharge
                    )}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">
                    Turnaround
                  </span>

                  <strong className="text-slate-900">
                    {
                      service.turnaroundHours
                    }{' '}
                    hours
                  </strong>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openEdit(service)
                  }
                  disabled={
                    workingId !== null
                  }
                  className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm font-bold text-cyan-800 disabled:opacity-50"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void toggleActive(
                      service
                    )
                  }
                  disabled={
                    workingId !== null
                  }
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
                >
                  {service.isActive
                    ? 'Deactivate'
                    : 'Reactivate'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void removeService(
                      service
                    )
                  }
                  disabled={
                    workingId !== null
                  }
                  className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"
                >
                  {workingId === service._id
                    ? 'Processing...'
                    : 'Remove Service'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default Services
