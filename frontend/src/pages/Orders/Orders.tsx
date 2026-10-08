

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import axios from 'axios'

import api from '../../services/api'



type OrderStatus =

  | 'received'

  | 'washing'

  | 'ready'

  | 'claimed'

  | 'cancelled'



type FilterStatus = OrderStatus | 'active' | 'all'



type Customer = {

  _id: string

  fullName: string

  phone: string

}



type Service = {

  _id: string

  name: string

}



type Machine = {

  _id: string

  name: string

}



type Order = {

  _id: string

  customer: Customer | string | null

  service: Service | string | null

  machine?: Machine | string | null

  weightKg: number

  totalPrice: number

  status: OrderStatus

  dueDate: string

  createdAt: string

}



const ACTIVE_STATUSES: OrderStatus[] = [

  'received',

  'washing',

  'ready',

]



const STATUS_STYLES: Record<OrderStatus, string> = {

  received:

    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',

  washing:

    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',

  ready:

    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',

  claimed:

    'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',

  cancelled:

    'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',

}



function getName(

  value: Customer | Service | Machine | string | null | undefined

): string {

  if (!value) return '—'

  if (typeof value === 'string') return '—'



  if ('fullName' in value) return value.fullName

  return value.name

}



function getPhone(

  value: Customer | string | null

): string {

  if (!value || typeof value === 'string') return ''

  return value.phone || ''

}



function money(value: number): string {

  return new Intl.NumberFormat('en-PH', {

    style: 'currency',

    currency: 'PHP',

  }).format(Number(value) || 0)

}



function formatDate(value: string): string {

  const date = new Date(value)



  if (Number.isNaN(date.getTime())) return '—'



  return date.toLocaleString('en-PH', {

    year: 'numeric',

    month: 'numeric',

    day: 'numeric',

    hour: 'numeric',

    minute: '2-digit',

  })

}



function isOverdue(order: Order): boolean {

  return (

    order.status === 'ready' &&

    new Date(order.dueDate).getTime() < Date.now()

  )

}



function Orders() {

  const [orders, setOrders] = useState<Order[]>([])

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')

  const [filter, setFilter] = useState<FilterStatus>('active')



  const loadOrders = useCallback(async (refresh = false) => {

    try {

      if (refresh) {

        setRefreshing(true)

      } else {

        setLoading(true)

      }



      setError('')



      const response = await api.get('/orders')



      const data = response.data



      const records: Order[] = Array.isArray(data)

        ? data

        : Array.isArray(data.orders)

          ? data.orders

          : []



      setOrders(records)

    } catch (err) {

      const message = axios.isAxiosError(err)

        ? err.response?.data?.message

        : ''



      setError(

        message ||

          'Unable to load orders. Make sure the backend is running.'

      )

    } finally {

      setLoading(false)

      setRefreshing(false)

    }

  }, [])



  useEffect(() => {

    void loadOrders()

  }, [loadOrders])



  const deleteOrder = async (order: Order) => {
    if (deletingId) return

    if (!['received', 'cancelled'].includes(order.status)) {
      setError('Only received or cancelled orders can be deleted.')
      setSuccess('')
      return
    }

    const confirmed = window.confirm(
      `Delete order #${order._id.slice(-8).toUpperCase()}?\n\n` +
      'This action cannot be undone. Orders with recorded payments cannot be deleted.'
    )

    if (!confirmed) return

    try {
      setDeletingId(order._id)
      setError('')
      setSuccess('')

      await api.delete(`/orders/${order._id}`)

      // Remove deleted order immediately; refresh to sync with backend.
      setOrders((previous) => previous.filter((item) => item._id !== order._id))
      setSuccess(`Order #${order._id.slice(-8).toUpperCase()} deleted successfully.`)
      await loadOrders(true)
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Unable to delete order.'
          : 'Unable to delete order.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  const counts = useMemo(() => {

    const received = orders.filter(

      (order) => order.status === 'received'

    ).length



    const washing = orders.filter(

      (order) => order.status === 'washing'

    ).length



    const ready = orders.filter(

      (order) => order.status === 'ready'

    ).length



    const claimed = orders.filter(

      (order) => order.status === 'claimed'

    ).length



    const cancelled = orders.filter(

      (order) => order.status === 'cancelled'

    ).length



    return {

      active: received + washing + ready,

      all: orders.length,

      received,

      washing,

      ready,

      claimed,

      cancelled,

    }

  }, [orders])



  const filters: {

    label: string

    value: FilterStatus

    count: number

  }[] = [

    { label: 'Active', value: 'active', count: counts.active },

    { label: 'All', value: 'all', count: counts.all },

    { label: 'Received', value: 'received', count: counts.received },

    { label: 'Washing', value: 'washing', count: counts.washing },

    { label: 'Ready', value: 'ready', count: counts.ready },

    { label: 'Claimed', value: 'claimed', count: counts.claimed },

    { label: 'Cancelled', value: 'cancelled', count: counts.cancelled },

  ]



  const filteredOrders = useMemo(() => {

    const query = search.trim().toLowerCase()



    return orders

      .filter((order) => {

        if (filter === 'all') return true



        if (filter === 'active') {

          return ACTIVE_STATUSES.includes(order.status)

        }



        return order.status === filter

      })

      .filter((order) => {

        if (!query) return true



        const searchableText = [

          order._id,

          getName(order.customer),

          getPhone(order.customer),

          getName(order.service),

          getName(order.machine),

          order.status,

        ]

          .join(' ')

          .toLowerCase()



        return searchableText.includes(query)

      })

      .sort(

        (a, b) =>

          new Date(b.createdAt).getTime() -

          new Date(a.createdAt).getTime()

      )

  }, [orders, filter, search])



  const summaryCards = [

    {

      label: 'Active Orders',

      value: counts.active,

      detail: 'Received, washing, and ready',

    },

    {

      label: 'Washing',

      value: counts.washing,

      detail: 'Currently processing',

    },

    {

      label: 'Ready for Pickup',

      value: counts.ready,

      detail: 'Waiting for customer',

    },

    {

      label: 'Completed',

      value: counts.claimed,

      detail: 'Claimed orders',

    },

  ]



  return (

    <div className="space-y-6">

      {/* PAGE HEADER — NO DUPLICATE CREATE BUTTON */}

      <div>

        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">

          Transactions

        </p>



        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">

          Laundry Orders

        </h1>



        <p className="mt-2 text-slate-500 dark:text-slate-300">

          Track active laundry jobs and completed transactions.

        </p>

      </div>



      {/* ERROR */}

      {error && (

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">

          <p className="text-sm text-red-700 dark:text-red-300">

            {error}

          </p>



          <button

            type="button"

            onClick={() => void loadOrders(true)}

            className="text-sm font-bold text-red-700 underline dark:text-red-300"

          >

            Try Again

          </button>

        </div>

      )}



      {success && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {success}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {summaryCards.map((card) => (

          <article

            key={card.label}

            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"

          >

            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">

              {card.label}

            </p>



            <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">

              {card.value}

            </p>



            <p className="mt-2 text-sm text-slate-400 dark:text-slate-400">

              {card.detail}

            </p>

          </article>

        ))}

      </section>



      {/* ORDERS PANEL */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">

        {/* FILTERS + SEARCH */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">

          <div className="flex flex-wrap gap-2">

            {filters.map((item) => {

              const selected = filter === item.value



              return (

                <button

                  key={item.value}

                  type="button"

                  onClick={() => setFilter(item.value)}

                  aria-pressed={selected}

                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${

                    selected

                      ? 'bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950'

                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'

                  }`}

                >

                  {item.label}{' '}

                  <span

                    className={

                      selected

                        ? 'opacity-90'

                        : 'text-slate-400 dark:text-slate-300'

                    }

                  >

                    {item.count}

                  </span>

                </button>

              )

            })}

          </div>



          <div className="flex w-full flex-wrap gap-2 sm:w-auto">

            <input

              type="search"

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Search customer, phone, service..."

              aria-label="Search orders"

              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 sm:w-72 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"

            />



            <button

              type="button"

              onClick={() => void loadOrders(true)}

              disabled={refreshing}

              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"

            >

              {refreshing ? 'Refreshing...' : 'Refresh'}

            </button>

          </div>

        </div>



        {/* CONTENT */}

        {loading ? (

          <div className="p-12 text-center text-slate-500 dark:text-slate-300">

            Loading orders...

          </div>

        ) : filteredOrders.length === 0 ? (

          <div className="p-12 text-center">

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-700">

              🧺

            </div>



            <h2 className="font-bold text-slate-900 dark:text-white">

              No orders found

            </h2>



            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">

              {orders.length === 0

                ? 'There are no laundry transactions yet.'

                : 'Try another search term or status filter.'}

            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1080px] text-left">

              <thead className="bg-slate-50 dark:bg-slate-900">

                <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">

                  <th className="px-6 py-4">Order</th>

                  <th className="px-6 py-4">Customer</th>

                  <th className="px-6 py-4">Service</th>

                  <th className="px-6 py-4">Machine</th>

                  <th className="px-6 py-4">Weight</th>

                  <th className="px-6 py-4">Total</th>

                  <th className="px-6 py-4">Due</th>

                  <th className="px-6 py-4">Status</th>

                  <th className="px-6 py-4 text-right">Action</th>

                </tr>

              </thead>



              <tbody>

                {filteredOrders.map((order) => (

                  <tr

                    key={order._id}

                    className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"

                  >

                    <td className="px-6 py-5">

                      <p className="font-bold text-slate-900 dark:text-white">

                        #{order._id.slice(-8).toUpperCase()}

                      </p>



                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">

                        {new Date(order.createdAt).toLocaleDateString('en-PH')}

                      </p>

                    </td>



                    <td className="px-6 py-5">

                      <p className="font-semibold text-slate-900 dark:text-slate-100">

                        {getName(order.customer)}

                      </p>



                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">

                        {getPhone(order.customer) || '—'}

                      </p>

                    </td>



                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-200">

                      {getName(order.service)}

                    </td>



                    <td className="px-6 py-5 text-sm text-slate-500 dark:text-slate-300">

                      {getName(order.machine)}

                    </td>



                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-200">

                      {order.weightKg} kg

                    </td>



                    <td className="px-6 py-5 font-bold text-slate-900 dark:text-white">

                      {money(order.totalPrice)}

                    </td>



                    <td className="px-6 py-5">

                      <p className="text-xs text-slate-600 dark:text-slate-200">

                        {formatDate(order.dueDate)}

                      </p>



                      {isOverdue(order) && (

                        <span className="mt-1 inline-block text-xs font-semibold text-red-600 dark:text-red-400">

                          Overdue

                        </span>

                      )}

                    </td>



                    <td className="px-6 py-5">

                      <span

                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status]}`}

                      >

                        {order.status}

                      </span>

                    </td>



                    <td className="px-6 py-5 text-right">

                      <div className="flex flex-wrap justify-end gap-2">
  <Link
    to={`/orders/${order._id}`}
    className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
  >
    View Order
  </Link>
  {(order.status === 'received' || order.status === 'cancelled') && (
    <button
      type="button"
      onClick={() => void deleteOrder(order)}
      disabled={deletingId !== null}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {deletingId === order._id ? 'Deleting...' : 'Delete'}
    </button>
  )}
</div>

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



export default Orders
