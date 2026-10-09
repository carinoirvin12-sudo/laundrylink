
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import api from '../../services/api'

type MachineType = 'washer' | 'dryer'
type MachineStatus = 'active' | 'maintenance'

type AvailabilityStatus =
  | 'available'
  | 'in-use'
  | 'maintenance'

type Machine = {
  _id: string
  name: string
  type: MachineType
  capacityKg: number
  status: MachineStatus
  isBusy?: boolean
  isAvailable?: boolean
  hasCapacity?: boolean
  availabilityStatus?: string
  displayStatus?: string
}

const machineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      2,
      'Machine name must be at least 2 characters'
    )
    .max(
      100,
      'Machine name cannot exceed 100 characters'
    ),

  type: z.enum(['washer', 'dryer']),

  capacityKg: z
    .number({
      message: 'Machine capacity is required',
    })
    .finite('Enter a valid capacity')
    .min(1, 'Capacity must be at least 1 kg')
    .max(15, 'Capacity cannot exceed 15 kg'),

  status: z.enum(['active', 'maintenance']),
})

type MachineFormData = z.infer<
  typeof machineSchema
>

const MACHINE_PRESETS: {
  name: string
  type: MachineType
  capacityKg: number
}[] = [
  {
    name: 'Washer 01',
    type: 'washer',
    capacityKg: 15,
  },
  {
    name: 'Washer 02',
    type: 'washer',
    capacityKg: 15,
  },
  {
    name: 'Dryer 01',
    type: 'dryer',
    capacityKg: 15,
  },
  {
    name: 'Dryer 02',
    type: 'dryer',
    capacityKg: 15,
  },
]

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.code === 11000) {
      return 'Machine name already exists.'
    }

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

function getDisplayStatus(
  machine: Machine
): AvailabilityStatus {
  if (machine.status === 'maintenance') {
    return 'maintenance'
  }

  if (
    machine.isBusy === true ||
    machine.availabilityStatus === 'in-use'
  ) {
    return 'in-use'
  }

  return 'available'
}

function Machines() {
  const [machines, setMachines] =
    useState<Machine[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] =
    useState(false)

  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [editingMachine, setEditingMachine] =
    useState<Machine | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MachineFormData>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      name: '',
      type: 'washer',
      capacityKg: 15,
      status: 'active',
    },
  })

  // ==========================================
  // LOAD MACHINE AVAILABILITY
  // ==========================================

  const loadMachines = useCallback(
    async (initial = false) => {
      try {
        if (initial) {
          setLoading(true)
        } else {
          setRefreshing(true)
        }

        const response = await api.get<Machine[]>(
          '/machines/availability'
        )

        if (!Array.isArray(response.data)) {
          throw new Error(
            'Unexpected machines response.'
          )
        }

        setMachines(response.data)
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Unable to load machines.'
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
    void loadMachines(true)
  }, [loadMachines])

  // ==========================================
  // MACHINE COUNTS
  // ==========================================

  const counts = useMemo(() => {
    const available = machines.filter(
      (machine) =>
        getDisplayStatus(machine) ===
        'available'
    ).length

    const inUse = machines.filter(
      (machine) =>
        getDisplayStatus(machine) ===
        'in-use'
    ).length

    const maintenance = machines.filter(
      (machine) =>
        getDisplayStatus(machine) ===
        'maintenance'
    ).length

    const washers = machines.filter(
      (machine) =>
        machine.type === 'washer'
    ).length

    const dryers = machines.filter(
      (machine) =>
        machine.type === 'dryer'
    ).length

    return {
      total: machines.length,
      available,
      inUse,
      maintenance,
      washers,
      dryers,
    }
  }, [machines])

  // ==========================================
  // FORM HELPERS
  // ==========================================

  const resetForm = () => {
    reset({
      name: '',
      type: 'washer',
      capacityKg: 15,
      status: 'active',
    })
  }

  const openAddForm = () => {
    setEditingMachine(null)
    resetForm()
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
    resetForm()
  }

  const applyPreset = (
    preset: (typeof MACHINE_PRESETS)[number]
  ) => {
    setValue('name', preset.name, {
      shouldValidate: true,
    })

    setValue('type', preset.type, {
      shouldValidate: true,
    })

    setValue(
      'capacityKg',
      preset.capacityKg,
      {
        shouldValidate: true,
      }
    )

    setValue('status', 'active', {
      shouldValidate: true,
    })
  }

  // ==========================================
  // CREATE / UPDATE MACHINE
  // ==========================================

  const saveMachine = async (
    data: MachineFormData
  ) => {
    if (saving) return

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
        await api.post(
          '/machines',
          payload
        )

        setSuccess(
          'Machine added successfully.'
        )
      }

      closeForm()
      await loadMachines()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to save machine.'
        )
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // DELETE UNUSED MACHINE
  // ==========================================

  const deleteMachine = async (
    machine: Machine
  ) => {
    if (deletingId) return

    if (getDisplayStatus(machine) === 'in-use') {
      setError(
        `"${machine.name}" is currently in use and cannot be deleted.`
      )
      setSuccess('')
      return
    }

    const confirmed = window.confirm(
      `Delete "${machine.name}"?\n\n` +
        'Only machines without laundry order history can be deleted.\n' +
        'Machines used in previous orders must be retained.'
    )

    if (!confirmed) return

    try {
      setDeletingId(machine._id)
      setError('')
      setSuccess('')

      await api.delete(
        `/machines/${machine._id}`
      )

      setSuccess(
        `"${machine.name}" was deleted successfully.`
      )

      await loadMachines()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Unable to delete machine.'
        )
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleRefresh = async () => {
    setError('')
    setSuccess('')
    await loadMachines()
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">
          Loading machines...
        </p>
      </div>
    )
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="mx-auto max-w-7xl">
      {/* HEADER */}

      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">
            Equipment Management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Machines
          </h1>

          <p className="mt-2 text-slate-500">
            Manage washing and drying equipment
            and monitor machine availability.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              void handleRefresh()
            }
            disabled={refreshing}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={openAddForm}
            disabled={saving}
            className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            + Add Machine
          </button>
        </div>
      </div>

      {/* MESSAGES */}

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

      {/* WORKFLOW EXPLANATION */}


<section className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-800 dark:bg-slate-800">
  <h2 className="font-bold text-slate-900 dark:text-white">
    Washer-to-Dryer Workflow
  </h2>

  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
    Laundry orders start in the Received queue.
    An assigned washer becomes In Use during
    Washing. When Drying starts, the washer
    becomes Available and the assigned dryer
    becomes In Use. The dryer becomes Available
    when Folding starts.
  </p>

  <p className="mt-2 text-xs font-medium text-cyan-800 dark:text-cyan-300">
    Machine availability is calculated from
    current order statuses, not set manually.
  </p>
</section>


      {/* SUMMARY */}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Machines"
          value={counts.total}
          detail={`${counts.washers} washers · ${counts.dryers} dryers`}
        />

        <SummaryCard
          label="Available"
          value={counts.available}
          detail="Ready for new assignments"
        />

        <SummaryCard
          label="In Use"
          value={counts.inUse}
          detail="Washing or drying in progress"
        />

        <SummaryCard
          label="Maintenance"
          value={counts.maintenance}
          detail="Temporarily unavailable"
        />
      </div>

      {/* MACHINE FORM */}

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
                Configure machine name, type,
                capacity, and maintenance status.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* PRESETS */}

          {!editingMachine && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Suggested Machines
              </p>

              <div className="flex flex-wrap gap-2">
                {MACHINE_PRESETS.map(
                  (preset) => {
                    const alreadyExists =
                      machines.some(
                        (machine) =>
                          machine.name.toLowerCase() ===
                          preset.name.toLowerCase()
                      )

                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() =>
                          applyPreset(preset)
                        }
                        disabled={alreadyExists}
                        className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {preset.name}
                        {alreadyExists
                          ? ' ✓'
                          : ''}
                      </button>
                    )
                  }
                )}
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Each machine needs a unique name.
                Suggested machines have 15 kg
                capacity each.
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit(saveMachine)}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            {/* NAME */}

            <div>
              <label
                htmlFor="machine-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Machine Name
              </label>

              <input
                id="machine-name"
                {...register('name')}
                placeholder="Example: Washer 01"
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
              <label
                htmlFor="machine-type"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Machine Type
              </label>

              <select
                id="machine-type"
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

              <p className="mt-1 text-xs text-slate-500">
                Washers clean clothes. Dryers
                dry clothes after washing.
              </p>
            </div>

            {/* CAPACITY */}

            <div>
              <label
                htmlFor="machine-capacity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Capacity (kg)
              </label>

              <input
                id="machine-capacity"
                type="number"
                min="1"
                max="15"
                step="0.5"
                {...register('capacityKg', {
                  valueAsNumber: true,
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500"
              />

              {errors.capacityKg && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.capacityKg.message}
                </p>
              )}

              <p className="mt-2 text-xs text-slate-500">
                Maximum capacity is 15 kg.
              </p>
            </div>

            {/* STATUS */}

            <div>
              <label
                htmlFor="machine-status"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Machine Status
              </label>

              <select
                id="machine-status"
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

              <p className="mt-1 text-xs text-slate-500">
                In Use is calculated automatically
                from laundry orders.
              </p>
            </div>

            {/* BUSY NOTICE */}

            {editingMachine?.isBusy && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2">
                This machine is currently in use.
                It cannot be placed under maintenance
                or have its capacity reduced below
                the active laundry load.
              </div>
            )}

            {/* FORM BUTTONS */}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
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
                disabled={saving}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
          <h2 className="text-lg font-bold text-slate-900">
            No Machines Yet
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Add washers and dryers to start
            processing laundry orders.
          </p>

          <button
            type="button"
            onClick={openAddForm}
            className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            + Add Machine
          </button>
        </section>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => {
            const displayStatus =
              getDisplayStatus(machine)

            const isBusy =
              displayStatus === 'in-use'

            return (
              <article
                key={machine._id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                {/* MACHINE HEADER */}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-xl font-bold text-cyan-700">
                      {machine.type === 'washer'
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

                {/* CAPACITY */}

                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Capacity
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {machine.capacityKg} kg
                  </p>
                </div>

                {/* WORKFLOW STATUS */}

                <div className="mt-4 rounded-xl border border-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current Usage
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {displayStatus === 'maintenance'
                      ? 'Unavailable for assignments'
                      : isBusy
                        ? machine.type === 'washer'
                          ? 'Washing in progress'
                          : 'Drying in progress'
                        : 'Ready for next laundry order'}
                  </p>
                </div>

                {/* ACTIONS */}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openEditForm(machine)
                    }
                    disabled={
                      deletingId !== null
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void deleteMachine(machine)
                    }
                    disabled={
                      deletingId !== null ||
                      isBusy
                    }
                    className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === machine._id
                      ? 'Deleting...'
                      : 'Delete'}
                  </button>
                </div>

                {isBusy && (
                  <p className="mt-3 text-xs text-amber-700">
                    This machine is currently
                    assigned to an active
                    laundry order.
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-sm text-slate-500">
        Machine availability updates whenever
        you refresh this page. Machines used
        in previous orders are protected from
        deletion to preserve transaction history.
      </p>
    </div>
  )
}

// ==========================================
// SUMMARY CARD
// ==========================================

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  )
}

// ==========================================
// STATUS BADGE
// ==========================================

function StatusBadge({
  status,
}: {
  status: AvailabilityStatus
}) {
  const styles: Record<
    AvailabilityStatus,
    string
  > = {
    available:
      'bg-green-100 text-green-700',
    'in-use':
      'bg-amber-100 text-amber-700',
    maintenance:
      'bg-red-100 text-red-700',
  }

  const labels: Record<
    AvailabilityStatus,
    string
  > = {
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

export default Machines
