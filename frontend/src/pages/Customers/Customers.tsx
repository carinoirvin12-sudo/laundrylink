
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'
import useDebounce from '../../hooks/useDebounce'

type Customer = {
  _id: string
  fullName: string
  phone: string
  address?: string
  createdAt: string
}

type CustomerOrder = {
  _id: string
  customer: string | { _id: string } | null
  status: string
}


const customerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters'),

  phone: z
    .string()
    .trim()
    .regex(
      /^09\d{9}$/,
      'Phone number must be 11 digits and start with 09'
    ),

  address: z.string().trim(),
})


type CustomerFormData = z.infer<typeof customerSchema>

const LOYALTY_THRESHOLD = 5

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [claimedCounts, setClaimedCounts] = useState<
    Record<string, number>
  >({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [loyaltyLoaded, setLoyaltyLoaded] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      address: '',
    },
  })

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const customerResponse = await api.get('/customers')

      if (!Array.isArray(customerResponse.data)) {
        throw new Error('Invalid customer list response.')
      }

      setCustomers(customerResponse.data)

      // Customer records remain available even if
      // the separate loyalty lookup fails.
      try {
        const ordersResponse = await api.get('/orders')

        if (!Array.isArray(ordersResponse.data)) {
          throw new Error('Invalid order list response.')
        }

        const counts: Record<string, number> = {}

        ;(ordersResponse.data as CustomerOrder[]).forEach(
          (order) => {
            if (order.status !== 'claimed') {
              return
            }

            const customerId =
              typeof order.customer === 'string'
                ? order.customer
                : order.customer?._id

            if (!customerId) {
              return
            }

            counts[customerId] =
              (counts[customerId] ?? 0) + 1
          }
        )

        setClaimedCounts(counts)
        setLoyaltyLoaded(true)
      } catch {
        setClaimedCounts({})
        setLoyaltyLoaded(false)
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to load customers.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const filteredCustomers = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase()

    if (!keyword) {
      return customers
    }

    return customers.filter((customer) => {
      return (
        customer.fullName.toLowerCase().includes(keyword) ||
        customer.phone.toLowerCase().includes(keyword) ||
        customer.address?.toLowerCase().includes(keyword)
      )
    })
  },  [customers, debouncedSearch])

  const loyalCustomerCount = useMemo(() => {
    if (!loyaltyLoaded) return 0

    return customers.filter(
      (customer) =>
        (claimedCounts[customer._id] ?? 0) >=
        LOYALTY_THRESHOLD
    ).length
  }, [customers, claimedCounts, loyaltyLoaded])

  const openAddForm = () => {
    setEditingCustomer(null)

    reset({
      fullName: '',
      phone: '',
      address: '',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer)

    reset({
      fullName: customer.fullName,
      phone: customer.phone,
      address: customer.address || '',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const closeForm = () => {
    setEditingCustomer(null)
    setShowForm(false)

    reset({
      fullName: '',
      phone: '',
      address: '',
    })
  }

  const saveCustomer = async (data: CustomerFormData) => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const payload = {
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
      }

      if (editingCustomer) {
        await api.put(
          `/customers/${editingCustomer._id}`,
          payload
        )

        setSuccess('Customer updated successfully.')
      } else {
        await api.post('/customers', payload)

        setSuccess('Customer added successfully.')
      }

      closeForm()
      await loadCustomers()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to save customer.'
        )
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteCustomer = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Delete ${customer.fullName}?\n\n` +
      'Customers with existing laundry orders cannot be deleted.'
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingId(customer._id)
      setError('')
      setSuccess('')

      await api.delete(`/customers/${customer._id}`)

      setSuccess('Customer deleted successfully.')

      await loadCustomers()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to delete customer.'
        )
      )
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading customers...
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
            Customer Records
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Customers
          </h1>

          <p className="mt-2 text-slate-500">
            Manage customer information and view laundry history.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600"
        >
          + Add Customer
        </button>
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
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {!loyaltyLoaded && customers.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Customer records loaded, but loyalty information is
          temporarily unavailable.
        </div>
      )}

      {/* ADD / EDIT FORM */}
      {showForm && (
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {editingCustomer
                  ? 'Edit Customer'
                  : 'Add Customer'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter the customer's basic information.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              aria-label="Close customer form"
              className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit(saveCustomer)}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="customer-full-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Full Name
              </label>

              <input
                id="customer-full-name"
                {...register('fullName')}
                placeholder="Customer full name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
              />

              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="customer-phone"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Phone Number
              </label>

              <input
                id="customer-phone"
                {...register('phone')}
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
              />

              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="customer-address"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Address
              </label>

              <input
                id="customer-address"
                {...register('address')}
                placeholder="Customer address"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingCustomer
                    ? 'Save Changes'
                    : 'Add Customer'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* CUSTOMER LIST */}
      <section className="rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold text-slate-900">
              Customer List
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {customers.length} registered customer
              {customers.length !== 1 ? 's' : ''}
            </p>

            {loyaltyLoaded && loyalCustomerCount > 0 && (
              <p className="mt-1 text-sm font-medium text-cyan-600 dark:text-cyan-300">
                ⭐ {loyalCustomerCount} loyal customer
                {loyalCustomerCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search name, phone, address..."
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-cyan-500 sm:w-80"
          />
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600">
              ♟
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              {customers.length === 0
                ? 'No customers yet'
                : 'No matching customers'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {customers.length === 0
                ? 'Add your first customer to get started.'
                : 'Try another search keyword.'}
            </p>

            {customers.length === 0 && (
              <button
                type="button"
                onClick={openAddForm}
                className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600"
              >
                + Add Customer
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const claimedOrders =
                claimedCounts[customer._id] ?? 0

              const isLoyal =
                loyaltyLoaded &&
                claimedOrders >= LOYALTY_THRESHOLD

              return (
                <article
                  key={customer._id}
                  className="rounded-2xl border border-slate-200 p-5 transition hover:border-cyan-300 hover:shadow-sm"
                >
                  {/* CUSTOMER */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-100 font-bold text-cyan-700">
                      {getInitials(customer.fullName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-slate-900">
                        {customer.fullName}
                      </h3>

                      <p className="text-sm text-slate-500">
                        {customer.phone}
                      </p>
                    </div>
                  </div>

                  {/* LOYALTY STATUS */}
                  <div className="mt-4">
                    {isLoyal ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200">
                        ⭐ Loyal Customer · 5% OFF
                      </div>
                    ) : loyaltyLoaded ? (
                      <p className="text-xs font-medium text-slate-500">
                        {claimedOrders} / 5 claimed orders
                        toward loyalty discount
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Loyalty status unavailable
                      </p>
                    )}
                  </div>

                  {/* ADDRESS */}
                  <div className="mt-4 min-h-10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Address
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {customer.address ||
                        'No address provided'}
                    </p>
                  </div>

                  {/* CREATED */}
                  <p className="mt-4 text-xs text-slate-400">
                    Customer since{' '}
                    {formatDate(customer.createdAt)}
                  </p>

                  {/* ACTIONS */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      to={`/customers/${customer._id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:border-cyan-700 hover:bg-cyan-700 hover:text-white dark:border-slate-600 dark:bg-slate-700 dark:text-cyan-300 dark:hover:border-cyan-500 dark:hover:bg-cyan-700 dark:hover:text-white"
                    >
                      History
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        openEditForm(customer)
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteCustomer(customer)
                      }
                      disabled={deletingId === customer._id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === customer._id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-PH')
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

export default Customers
