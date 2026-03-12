import type { PendingPromptAction, PlayerId, PlayerState } from './types'

export const PLAYER_DISPLAY_NAMES = ['你', '左家', '对家', '右家'] as const
export const SEAT_WIND_LABELS = {
  East: '东',
  South: '南',
  West: '西',
  North: '北',
} as const

export const playerName = (playerId: PlayerId): string => PLAYER_DISPLAY_NAMES[playerId]

export const seatWindLabel = (seatWind: PlayerState['seatWind']): string => SEAT_WIND_LABELS[seatWind]

export const actionLabel = (action: PendingPromptAction): string => {
  if (action === 'win') return '胡'
  if (action === 'kong') return '杠'
  if (action === 'pong') return '碰'
  if (action === 'chow') return '吃'
  return '过'
}

export const meldTypeLabel = (type: 'chow' | 'pong' | 'kong'): string => {
  if (type === 'chow') return '吃'
  if (type === 'pong') return '碰'
  return '杠'
}
