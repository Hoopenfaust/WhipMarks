import type { DescriptorLevel } from '../types'

export interface LevelConfig {
  id: DescriptorLevel
  label: string
  shortLabel: string
  defaultScore: number  // fraction of maxMarks, 0–1
  dotColor: string      // Tailwind bg class for the dot
  textColor: string     // Tailwind text class
  bgColor: string       // Tailwind bg class for button hover
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'excellent',
    label: 'Demonstrates Mastery',
    shortLabel: 'Mastery',
    defaultScore: 1.0,
    dotColor: 'bg-emerald-400',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-950/50',
  },
  {
    id: 'good',
    label: 'Demonstrates Understanding',
    shortLabel: 'Understanding',
    defaultScore: 0.75,
    dotColor: 'bg-blue-400',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-950/50',
  },
  {
    id: 'satisfactory',
    label: 'Demonstrates Some Understanding',
    shortLabel: 'Some Understanding',
    defaultScore: 0.5,
    dotColor: 'bg-amber-400',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-950/50',
  },
  {
    id: 'poor',
    label: 'Needs Improvement',
    shortLabel: 'Needs Improvement',
    defaultScore: 0.25,
    dotColor: 'bg-red-400',
    textColor: 'text-red-400',
    bgColor: 'bg-red-950/50',
  },
]
