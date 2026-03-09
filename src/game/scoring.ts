import { canWinWithStandardHand, getTileCounts } from './rules'
import type { GameState, PlayerState, RoundSettlement, ScoreDelta, Tile, WinInfo } from './types'

export type ScoreBreakdownItem = {
  label: string
  points: number
}

const isHonor = (tile: Tile): boolean => tile.suit === 'wind' || tile.suit === 'dragon'

const isPureOneSuit = (tiles: Tile[]): boolean => {
  const suited = tiles.filter((tile) => !isHonor(tile))
  if (suited.length === 0) {
    return false
  }
  const baseSuit = suited[0].suit
  return suited.every((tile) => tile.suit === baseSuit) && tiles.every((tile) => !isHonor(tile))
}

const countPungsAndKongs = (player: PlayerState): number => {
  const concealed = [...getTileCounts(player.hand).values()].filter((count) => count >= 3).length
  const exposed = player.melds.filter((meld) => meld.type === 'pong' || meld.type === 'kong').length
  return concealed + exposed
}

const isSevenPairs = (tiles: Tile[]): boolean => {
  if (tiles.length !== 14) {
    return false
  }
  const counts = [...getTileCounts(tiles).values()]
  return counts.length === 7 && counts.every((count) => count === 2)
}

export const buildSettlement = (
  state: GameState,
  winner: WinInfo,
): RoundSettlement | null => {
  const player = state.players[winner.winnerId]
  const winningTiles = [...player.hand]

  if (!isSevenPairs(winningTiles) && !canWinWithStandardHand(winningTiles)) {
    return null
  }

  const breakdown: ScoreBreakdownItem[] = [{ label: 'Base win', points: 1 }]

  if (winner.source === 'self-draw') {
    breakdown.push({ label: 'Self draw', points: 1 })
  }

  if (winner.winnerId === state.dealerId) {
    breakdown.push({ label: 'Dealer win', points: 1 })
  }

  if (isSevenPairs(winningTiles)) {
    breakdown.push({ label: 'Seven pairs', points: 2 })
  }

  if (isPureOneSuit(winningTiles)) {
    breakdown.push({ label: 'Pure one suit', points: 2 })
  }

  const sets = countPungsAndKongs(player)
  if (sets >= 2) {
    breakdown.push({ label: 'Pung/Kong heavy hand', points: 1 })
  }

  const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0)
  const rawDeltas = [0, 0, 0, 0]

  if (winner.source === 'self-draw') {
    state.players.forEach((candidate) => {
      if (candidate.id === winner.winnerId) {
        return
      }
      rawDeltas[candidate.id] -= totalPoints
      rawDeltas[winner.winnerId] += totalPoints
    })
  } else {
    const loserId = winner.sourcePlayerId
    if (loserId === undefined) {
      return null
    }
    rawDeltas[loserId] -= totalPoints * 3
    rawDeltas[winner.winnerId] += totalPoints * 3
  }

  const deltas: ScoreDelta[] = rawDeltas.map((delta, playerId) => ({ playerId: playerId as 0 | 1 | 2 | 3, delta }))

  return {
    winnerId: winner.winnerId,
    deltas,
    totalPoints,
    breakdown,
    summary: `${player.name} wins for ${totalPoints} point(s).`,
  }
}
