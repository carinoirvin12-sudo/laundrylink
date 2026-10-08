import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'

import api from '../../services/api'


const hasValidPesoPrecision = (value: number) =>
  Number.isFinite(value) &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.000001

const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Service name must be at least 2 characters')
    .max(100, 'Service name cannot exceed 100 characters'),

  pricePerKg: z
    .number({
      message: 'Price per kg is required',
    })
    .finite('Enter a valid price')
    .min(1, 'Price per kg must be at least ₱1')
    .refine(
      hasValidPesoPrecision,
      'Price must have at most 2 decimal places'
    ),

  minCharge: z
    .number({
      message: 'Minimum charge is required',
    })
    .finite('Enter a valid minimum charge')
    .min(0, 'Minimum charge cannot be negative')
    .refine(
      hasValidPesoPrecision,
      'Minimum charge must have at most 2 decimal places'
    ),

  turnaroundHours: z
    .number({
      message: 'Turnaround time is required',
    })
    .int('Turnaround time must be a whole number')
    .min(1, 'Turnaround time must be at least 1 hour'),

  isActive: z.boolean(),
})


type ServiceFormData = z.infer<typeof serviceSchema>

type Service = {
  _id: string
  name: string
  pricePerKg: number
  minCharge: number
  turnaroundHours: number
  isActive: boolean
}

function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)

  const [editingService, setEditingService] =
    useState<Service | null>(null)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),

    defaultValues: {
      name: '',
      pricePerKg: 1,
      minCharge: 0,
      turnaroundHours: 24,
      isActive: true,
    },
  })

  const getErrorMessage = (
    error: unknown,
    fallback: string
  ) => {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message || fallback
    }

    return fallback
  }

  const loadServices = async () => {
    try {
      setLoading(true)
      setError('')

      const response =
        await api.get<Service[]>('/services')

      setServices(response.data)
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to load services.'
        )
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  const openAddForm = () => {
    setEditingService(null)

    reset({
      name: '',
      pricePerKg: 1,
      minCharge: 0,
      turnaroundHours: 24,
      isActive: true,
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const openEditForm = (service: Service) => {
    setEditingService(service)

    reset({
      name: service.name,
      pricePerKg: service.pricePerKg,
      minCharge: service.minCharge,
      turnaroundHours: service.turnaroundHours,
      isActive: service.isActive,
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingService(null)

    reset({
      name: '',
      pricePerKg: 1,
      minCharge: 0,
      turnaroundHours: 24,
      isActive: true,
    })
  }

  const onSubmit = async (
    data: ServiceFormData
  ) => {
    try {
      setError('')
      setSuccess('')

      const payload = {
        name: data.name.trim(),
        pricePerKg: data.pricePerKg,
        minCharge: data.minCharge,
        turnaroundHours: data.turnaroundHours,
        isActive: data.isActive,
      }

      if (editingService) {
        await api.put(
          `/services/${editingService._id}`,
          payload
        )

        setSuccess(
          'Service updated successfully.'
        )
      } else {
        await api.post(
          '/services',
          payload
        )

        setSuccess(
          'Service added successfully.'
        )
      }

      closeForm()
      await loadServices()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          editingService
            ? 'Unable to update service.'
            : 'Unable to add service.'
        )
      )
    }
  }

  const deleteService = async (
    service: Service
  ) => {
    const confirmed = window.confirm(
      `Delete "${service.name}"?`
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingId(service._id)
      setError('')
      setSuccess('')

      await api.delete(
        `/services/${service._id}`
      )

      setSuccess(
        'Service deleted successfully.'
      )

      await loadServices()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to delete service.'
        )
      )
    } finally {
      setDeletingId(null)
    }
  }

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">
            Services
          </h1>

          <p className="mt-2 text-slate-500">
            Manage laundry services, pricing, and turnaround time.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
        >
          + Add Service
        </button>
      </div>

      {success && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                {editingService
                  ? 'Edit Service'
                  : 'Add Service'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure the laundry service below.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Service Name *
              </label>

              <input
                id="name"
                type="text"
                {...register('name')}
                placeholder="Example: Wash & Fold"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pricePerKg"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Price per Kg *
              </label>

              <input
                id="pricePerKg"
                type="number"
                step="0.01"
                {...register(
                  'pricePerKg',
                  {
                    valueAsNumber: true,
                  }
                )}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              {errors.pricePerKg && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.pricePerKg.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="minCharge"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Minimum Charge
              </label>

              <input
                id="minCharge"
                type="number"
                step="0.01"
                {...register(
                  'minCharge',
                  {
                    valueAsNumber: true,
                  }
                )}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              {errors.minCharge && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.minCharge.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="turnaroundHours"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Turnaround Hours *
              </label>

              <input
                id="turnaroundHours"
                type="number"
                {...register(
                  'turnaroundHours',
                  {
                    valueAsNumber: true,
                  }
                )}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />

              {errors.turnaroundHours && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.turnaroundHours.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="isActive"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Status
              </label>

              <label className="flex h-[50px] items-center gap-3 rounded-xl border border-slate-300 px-4">
                <input
                  id="isActive"
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4"
                />

                <span className="text-sm text-slate-700">
                  Service is active
                </span>
              </label>
            </div>

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingService
                    ? 'Save Changes'
                    : 'Add Service'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          Loading services...
        </div>
      ) : services.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            No services yet
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Add your first laundry service.
          </p>

          <button
            type="button"
            onClick={openAddForm}
            className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
          >
            + Add First Service
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article
              key={service._id}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {service.name}
                  </h2>

                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                      service.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {service.isActive
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </div>

                <p className="text-xl font-black text-cyan-700">
                  {formatMoney(
                    service.pricePerKg
                  )}
                  <span className="text-xs font-medium text-slate-400">
                    /kg
                  </span>
                </p>
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Minimum Charge
                  </span>

                  <span className="font-semibold text-slate-800">
                    {formatMoney(
                      service.minCharge
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Turnaround
                  </span>

                  <span className="font-semibold text-slate-800">
                    {service.turnaroundHours}{' '}
                    hours
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openEditForm(service)
                  }
                  className="flex-1 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
                >
                  Edit
                </button>

                <button
                  type="button"
                  disabled={
                    deletingId === service._id
                  }
                  onClick={() =>
                    deleteService(service)
                  }
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingId === service._id
                    ? 'Deleting...'
                    : 'Delete'}
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