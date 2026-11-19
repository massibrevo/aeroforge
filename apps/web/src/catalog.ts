import catalog from '../../../shared/aircraft/catalog.json'

export type AircraftId = keyof typeof catalog
export type AircraftVisual = {
  body: 'single' | 'hump' | 'double' | 'turboprop' | 'glider'
  tip: 'plain' | 'winglet' | 'sharklet' | 'raked' | 'blended' | 'split' | 'fence'
  engineStations: number[]
  wingStation: number
  nose: number
  nacelle: number
  cabin: number
  finHeight: number
}

type AircraftReference = {
  maker: string
  variant: string
  geometry: { length: number; span: number; area: number }
  reference: { height: number | null; mtow: number; powerplant: string; wingAreaPublished: boolean }
  visual: AircraftVisual
  sources: string[]
}

const aircraft = catalog as Record<AircraftId, AircraftReference>
export function aircraftReference(profile: AircraftId | 'generic' | 'glider' | undefined) {
  return profile && profile !== 'generic' && profile !== 'glider' ? aircraft[profile] : undefined
}
