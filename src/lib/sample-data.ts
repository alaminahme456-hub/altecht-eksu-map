// Starter dataset for the ALTECH EKSU map.
//
// DATA-ACCURACY POLICY (must never be violated):
//  - Exactly ONE record is verified: the EKSU main-campus reference point at
//    7.712°N 5.251°E, taken from a public record (Wikipedia coordinates for
//    Ekiti State University). Its source is noted.
//  - Every other record in this file is a SAMPLE: real EKSU facility names
//    from public information, but APPROXIMATE positions for demonstration and
//    survey planning only. They are stored as status="draft", source="sample",
//    and their descriptions begin with "SAMPLE —". They must be replaced by
//    real GPS field survey data through the admin dashboard. Nothing here is
//    presented as verified campus data.

export type SampleRecord = {
  name: string
  category: string
  description: string
  lat: number
  lng: number
  geometryType: 'point' | 'polygon' | 'polyline'
  coordinates?: [number, number][]
  status: 'draft' | 'verified'
  source: string
}

const SAMPLE_TAG =
  'SAMPLE — approximate position, pending GPS field survey. Replace or verify via the admin dashboard.'

export const SAMPLE_DATA: SampleRecord[] = [
  {
    name: 'EKSU Main Campus (reference point)',
    category: 'Other campus facilities',
    description:
      'Reference centre of the Ekiti State University main campus, along Ado-Iworoko Road, Ado-Ekiti (PMB 5363). Coordinate 7.712°N 5.251°E is from a public record (Wikipedia). Use as map anchor; individual buildings must still be GPS-surveyed.',
    lat: 7.712,
    lng: 5.251,
    geometryType: 'point',
    status: 'verified',
    source: 'public-record',
  },
  {
    name: 'Faculty of Science',
    description: `${SAMPLE_TAG} One of EKSU's founding faculties (public record: new office buildings constructed for Science).`,
    category: 'Faculties',
    lat: 7.7139,
    lng: 5.2538,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Arts',
    description: `${SAMPLE_TAG} EKSU Faculty of Arts (public record: new office buildings constructed for Arts).`,
    category: 'Faculties',
    lat: 7.7104,
    lng: 5.2483,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Education',
    description: `${SAMPLE_TAG} EKSU Faculty of Education (public record: new office buildings constructed for Education).`,
    category: 'Faculties',
    lat: 7.7132,
    lng: 5.2494,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Agricultural Sciences',
    description: `${SAMPLE_TAG} EKSU Faculty of Agricultural Sciences.`,
    category: 'Faculties',
    lat: 7.7089,
    lng: 5.2531,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Social Sciences',
    description: `${SAMPLE_TAG} EKSU Faculty of Social Sciences (public record: new office buildings constructed for Social Sciences).`,
    category: 'Faculties',
    lat: 7.7109,
    lng: 5.2542,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Management Sciences',
    description: `${SAMPLE_TAG} EKSU Faculty of Management Sciences.`,
    category: 'Faculties',
    lat: 7.7145,
    lng: 5.2501,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Law',
    description: `${SAMPLE_TAG} EKSU Faculty of Law (public record: Law is one of EKSU's faculties).`,
    category: 'Faculties',
    lat: 7.7095,
    lng: 5.2455,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'University Central Library',
    description: `${SAMPLE_TAG} EKSU central library building.`,
    category: 'Libraries',
    lat: 7.7117,
    lng: 5.2512,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Student Affairs Division',
    description: `${SAMPLE_TAG} EKSU Student Affairs administrative building.`,
    category: 'Administrative buildings',
    lat: 7.7126,
    lng: 5.2499,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'University Health Centre',
    description: `${SAMPLE_TAG} EKSU campus clinic / health centre.`,
    category: 'Health facilities',
    lat: 7.7108,
    lng: 5.2472,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Main Gate (Ado-Iworoko Road)',
    description: `${SAMPLE_TAG} Primary entrance to EKSU main campus from Ado-Iworoko Road.`,
    category: 'Entrances and gates',
    lat: 7.7079,
    lng: 5.2462,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Student Hostel Block (sample)',
    description: `${SAMPLE_TAG} Representative hostel block — replace with surveyed hostel positions.`,
    category: 'Hostels',
    lat: 7.7153,
    lng: 5.2526,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Students’ Cafeteria (sample)',
    description: `${SAMPLE_TAG} Representative campus eatery — replace with surveyed cafeteria positions.`,
    category: 'Cafeterias',
    lat: 7.7121,
    lng: 5.2551,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Sports Complex (sample)',
    description: `${SAMPLE_TAG} Representative sports field area — replace with surveyed facilities.`,
    category: 'Sports facilities',
    lat: 7.7084,
    lng: 5.2504,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Lecture Theatre Complex (sample)',
    description: `${SAMPLE_TAG} Representative large lecture-theatre block.`,
    category: 'Lecture halls',
    lat: 7.7134,
    lng: 5.2557,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Science Laboratory Wing (sample)',
    description: `${SAMPLE_TAG} Representative laboratory wing.`,
    category: 'Laboratories',
    lat: 7.7146,
    lng: 5.2549,
    geometryType: 'point',
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Faculty of Science Complex (sample outline)',
    description: `${SAMPLE_TAG} Demonstration building OUTLINE polygon. Its shape is illustrative only — survey the real footprint with GPS.`,
    category: 'Faculties',
    lat: 7.7139,
    lng: 5.2538,
    geometryType: 'polygon',
    coordinates: [
      [5.2531, 7.7135],
      [5.2546, 7.7135],
      [5.2546, 7.7143],
      [5.2531, 7.7143],
      [5.2531, 7.7135],
    ],
    status: 'draft',
    source: 'sample',
  },
  {
    name: 'Campus Internal Loop Road (sample path)',
    description: `${SAMPLE_TAG} Demonstration walkable pathway recorded as a polyline. Survey the real network with GPS; polylines like this will form the walking-navigation graph.`,
    category: 'Roads and pathways',
    lat: 7.7119,
    lng: 5.2507,
    geometryType: 'polyline',
    coordinates: [
      [5.2462, 7.7079],
      [5.2488, 7.7103],
      [5.2507, 7.7119],
      [5.2526, 7.7134],
      [5.2549, 7.7146],
    ],
    status: 'draft',
    source: 'sample',
  },
]
