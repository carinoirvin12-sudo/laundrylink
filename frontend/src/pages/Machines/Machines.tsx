import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'

type MachineType = 'washer' | 'dryer'
type MachineDatabaseStatus = 'active' | 'maintenance'

type Machine = {
  _id: string
  name: string
  type: MachineType
  capacityKg: number
  status: MachineDatabaseStatus
  isBusy?: boolean
  isAvailable?: boolean
  availabilityStatus?: string
  createdAt?: string
}


const machineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Machine name must be at least 2 characters')
    .max(100, 'Machine name cannot exceed 100 characters'),

  type: z.enum(['washer', 'dryer']),

  capacityKg: z
    .number()
    .finite('Enter a valid machine capacity')
    .min(1, 'Capacity must be at least 1 kg')
    .max(15, 'Capacity cannot exceed 15 kg'),

  status: z.enum(['active', 'maintenance']),
})


type MachineFormData = z.infer<typeof machineSchema>

function Machines() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingMachine, setEditingMachine] =
    useState<Machine | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MachineFormData>({
    resolver: zodResolver(machineSchema),

    defaultValues: {
      name: '',
      type: 'washer',
      capacityKg: 1,
      status: 'active',
    },
  })

  const loadMachines = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response =
        await api.get('/machines/availability')

      setMachines(response.data)
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to load machines.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMachines()
  }, [loadMachines])

  const counts = useMemo(() => {
    const maintenance = machines.filter(
      (machine) =>
        machine.status === 'maintenance'
    ).length

    const inUse = machines.filter(
      (machine) =>
        machine.status !== 'maintenance' &&
        machine.isBusy === true
    ).length

    const available = machines.filter(
      (machine) =>
        machine.status === 'active' &&
        machine.isBusy !== true
    ).length

    return {
      total: machines.length,
      available,
      inUse,
      maintenance,
    }
  }, [machines])

  const openAddForm = () => {
    setEditingMachine(null)

    reset({
      name: '',
      type: 'washer',
      capacityKg: 1,
      status: 'active',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const openEditForm = (machine: Machine) => {
    setEditingMachine(machine)

    reset({
      name: machine.name,
      type: machine.type,
      capacityKg: machine.capacityKg,
      status: machine.status,
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingMachine(null)

    reset({
      name: '',
      type: 'washer',
      capacityKg: 1,
      status: 'active',
    })
  }

  const saveMachine = async (
    data: MachineFormData
  ) => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const payload = {
        name: data.name.trim(),
        type: data.type,
        capacityKg: data.capacityKg,
        status: data.status,
      }

      if (editingMachine) {
        await api.put(
          `/machines/${editingMachine._id}`,
          payload
        )

        setSuccess(
          'Machine updated successfully.'
        )
      } else {
        await api.post('/machines', payload)

        setSuccess(
          'Machine added successfully.'
        )
      }

      closeForm()
      await loadMachines()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to save machine.'
        )
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteMachine = async (
    machine: Machine
  ) => {
    const confirmed = window.confirm(
      `Delete ${machine.name}?\n\nMachines referenced by laundry orders cannot be deleted.`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setSuccess('')

      await api.delete(
        `/machines/${machine._id}`
      )

      setSuccess(
        'Machine deleted successfully.'
      )

      await loadMachines()
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Unable to delete machine.'
        )
      )
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading machines...
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
            Live Monitoring
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Machines
          </h1>

          <p className="mt-2 text-slate-500">
            Manage laundry machines and monitor their
            current availability.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600"
        >
          + Add Machine
        </button>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* SUMMARY */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Machines"
          value={counts.total}
        />

        <SummaryCard
          label="Available"
          value={counts.available}
        />

        <SummaryCard
          label="In Use"
          value={counts.inUse}
        />

        <SummaryCard
          label="Maintenance"
          value={counts.maintenance}
        />
      </div>

      {/* ADD / EDIT */}
      {showForm && (
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {editingMachine
                  ? 'Edit Machine'
                  : 'Add Machine'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure the machine type, capacity,
                and maintenance status.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit(saveMachine)}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            {/* NAME */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Machine Name
              </label>

              <input
                {...register('name')}
                placeholder="Example: Washer 1"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
              />

              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* TYPE */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Machine Type
              </label>

              <select
                {...register('type')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500"
              >
                <option value="washer">
                  Washer
                </option>

                <option value="dryer">
                  Dryer
                </option>
              </select>
            </div>

            {/* CAPACITY */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Capacity (kg)
              </label>

              <input
                type="number"
                min="1"
                max="15"
                step="1"
                {...register(
                  'capacityKg',
                  {
                    valueAsNumber: true,
                  }
                )}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
              />

              {errors.capacityKg && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.capacityKg.message}
                </p>
              )}


              <p className="mt-2 text-xs text-slate-500">
                Maximum machine capacity is 15 kg.
                Laundry exceeding 15 kg must be divided
                into separate orders.
              </p>

            </div>

            {/* STATUS */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Machine Status
              </label>

              <select
                {...register('status')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500"
              >
                <option value="active">
                  Active
                </option>

                <option value="maintenance">
                  Maintenance
                </option>
              </select>

              <p className="mt-1 text-xs text-slate-400">
                In Use is automatic and cannot be
                manually selected.
              </p>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingMachine
                    ? 'Save Changes'
                    : 'Add Machine'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* MACHINE LIST */}
      {machines.length === 0 ? (
        <section className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl">
            ◉
          </div>

          <h2 className="mt-4 text-lg font-bold text-slate-900">
            No machines yet
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Add your laundry shop's first machine.
          </p>

          <button
            type="button"
            onClick={openAddForm}
            className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600"
          >
            + Add Machine
          </button>
        </section>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => {
            const displayStatus =
              getDisplayStatus(machine)

            return (
              <article
                key={machine._id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-xl text-cyan-700">
                      {machine.type ===
                        'washer'
                        ? 'W'
                        : 'D'}
                    </div>

                    <div>
                      <h2 className="font-bold text-slate-900">
                        {machine.name}
                      </h2>

                      <p className="mt-1 text-sm capitalize text-slate-500">
                        {machine.type}
                      </p>
                    </div>
                  </div>

                  <StatusBadge
                    status={displayStatus}
                  />
                </div>

                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Capacity
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {machine.capacityKg} kg
                  </p>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openEditForm(machine)
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteMachine(machine)
                    }
                    className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'available' | 'in-use' | 'maintenance'
}) {
  const styles = {
    available:
      'bg-green-100 text-green-700',

    'in-use':
      'bg-amber-100 text-amber-700',

    maintenance:
      'bg-red-100 text-red-700',
  }

  const labels = {
    available: 'Available',
    'in-use': 'In Use',
    maintenance: 'Maintenance',
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function getDisplayStatus(
  machine: Machine
): 'available' | 'in-use' | 'maintenance' {
  if (machine.status === 'maintenance') {
    return 'maintenance'
  }

  if (
    machine.isBusy === true ||
    machine.availabilityStatus?.toLowerCase() === 'in-use'
  ) {
    return 'in-use'
  }

  return 'available'
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

  return fallback
}

export default Machines