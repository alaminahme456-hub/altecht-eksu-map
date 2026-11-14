// Shared category registry for the map filters and the admin add/edit form.
// Includes the standard campus categories plus every category currently used
// by saved EKSU map records. Keep labels exact to avoid category mismatches.
export const CATEGORIES = [
  'Faculties',
  'Departments',
  'Lecture halls',
  'Laboratories',
  'Libraries',
  'Administrative buildings',
  'Hostels',
  'Cafeterias',
  'Health facilities',
  'Sports facilities',
  'Entrances and gates',
  'Roads and pathways',
  'Other campus facilities',
  // Additional categories already present in campus map data.
  'Auditoriums',
  'Banks',
  'Buildings',
  'CBT Centres',
  'ICT',
  'Lecture Halls',
  'Schools',
  'Shops',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_META: Record<
  Category,
  { icon: string; color: string; isLinear?: boolean }
> = {
  Faculties: { icon: '🎓', color: '#7c3aed' },
  Departments: { icon: '🏛️', color: '#9333ea' },
  'Lecture halls': { icon: '📝', color: '#0d9488' },
  Laboratories: { icon: '🔬', color: '#059669' },
  Libraries: { icon: '📚', color: '#b45309' },
  'Administrative buildings': { icon: '🏢', color: '#4d7c0f' },
  Hostels: { icon: '🛏️', color: '#be185d' },
  Cafeterias: { icon: '🍽️', color: '#ea580c' },
  'Health facilities': { icon: '🏥', color: '#dc2626' },
  'Sports facilities': { icon: '⚽', color: '#16a34a' },
  'Entrances and gates': { icon: '🚪', color: '#525252' },
  'Roads and pathways': { icon: '🛣️', color: '#a16207', isLinear: true },
  'Other campus facilities': { icon: '📍', color: '#0369a1' },
  Auditoriums: { icon: '🎤', color: '#7c3aed' },
  Banks: { icon: '🏦', color: '#0f766e' },
  Buildings: { icon: '🏢', color: '#64748b' },
  'CBT Centres': { icon: '💻', color: '#2563eb' },
  ICT: { icon: '🖥️', color: '#0891b2' },
  'Lecture Halls': { icon: '📝', color: '#0d9488' },
  Schools: { icon: '🏫', color: '#9333ea' },
  Shops: { icon: '🛍️', color: '#c2410c' },
}

export function categoryMeta(category: string) {
  return (
    CATEGORY_META[category as Category] ?? {
      icon: '📍',
      color: '#57534e',
    }
  )
}
