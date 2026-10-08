import { z } from 'zod'

export const orderSchema = z.object({
  service: z
    .string()
    .min(
      1,
      'Please select a service'
    ),

  machine: z
    .string()
    .min(
      1,
      'Please select an available machine'
    ),

  weightKg: z
    .number({
      message:
        'Weight is required',
    })
    .min(
      1,
      'Weight must be at least 1 kg'
    )
    .max(
      50,
      'Weight cannot exceed 50 kg'
    ),

  notes: z
    .string()
    .max(
      500,
      'Notes cannot exceed 500 characters'
    )
    .optional(),
})

export type OrderFormData =
  z.infer<typeof orderSchema>