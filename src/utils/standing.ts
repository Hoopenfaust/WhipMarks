import { Star, CheckCircle2, TrendingUp, AlertTriangle, Flag, Circle, type LucideIcon } from 'lucide-react'

// Where a student stands on their semester mark so far. One list shared by the dashboard's
// Class standing summary and the roster's By standing view and List, so they always agree.
export type StandingId = 'high' | 'track' | 'developing' | 'borderline' | 'risk' | 'none'

export interface Standing {
  id: StandingId
  label: string
  range: string
  icon: LucideIcon
  rgb: string   // 'r,g,b' for text, tints and glows
}

export const STANDINGS: Standing[] = [
  { id: 'high',       label: 'High achievers', range: '85%+',      icon: Star,          rgb: '167,139,250' },
  { id: 'track',      label: 'On track',       range: '75–85%',    icon: CheckCircle2,  rgb: '52,211,153' },
  { id: 'developing', label: 'Developing',     range: '65–75%',    icon: TrendingUp,    rgb: '56,189,248' },
  { id: 'borderline', label: 'Borderline',     range: '50–65%',    icon: AlertTriangle, rgb: '251,191,36' },
  { id: 'risk',       label: 'At risk',        range: 'under 50%', icon: Flag,          rgb: '248,113,113' },
  { id: 'none',       label: 'Not marked yet', range: '',          icon: Circle,        rgb: '145,140,171' },
]

export function standingOf(mark: number | null): Standing {
  const id: StandingId = mark === null ? 'none'
    : mark >= 85 ? 'high'
    : mark >= 75 ? 'track'
    : mark >= 65 ? 'developing'
    : mark >= 50 ? 'borderline'
    : 'risk'
  return STANDINGS.find(s => s.id === id)!
}
