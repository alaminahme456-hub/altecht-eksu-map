import { z } from 'zod'
import { CATEGORIES } from './categories'

export const geometryTypeSchema = z.enum(['point', 'polygon', 'polyline'])
export const statusSchema = z.enum(['draft', 'verified'])

export const locationInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  category: z.enum(CATEGORIES),
  description: z.string().max(4000).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geometryType: geometryTypeSchema.default('point'),
  // [[lng,lat], ...] original collected vertices for polygon/polyline
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2).optional().nullable(),
  status: statusSchema.default('draft'),
  externalId: z.string().max(100).optional().nullable(),
})

export type LocationInput = z.infer<typeof locationInputSchema>
