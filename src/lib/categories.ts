// The 13 EKSU campus location categories (per project specification).
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
}

export function categoryMeta(category: string) {
  return (
    CATEGORY_META[category as Category] ?? {
      icon: '📍',
      color: '#57534e',
    }
  )
}
