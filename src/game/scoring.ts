import type { GameState, RoundSettlement, ScoreDelta, WinInfo } from './types'

export const buildSettlement = (state: GameState, winner: WinInfo): RoundSettlement => {
  const breakdown: Array<{ label: string; points: number }> = []

  breakdown.push({ label: '平胡', points: 1 })
  if (winner.source === 'self-draw') {
    breakdown.push({ label: '自摸', points: 1 })
  }
  if (winner.isJiaHu) {
    breakdown.push({ label: '夹胡', points: 1 })
  }
  if (winner.usedBao) {
    breakdown.push({ label: winner.winType === 'bao-zhong-bao' ? '宝中宝' : '摸宝胡', points: 2 })
  }

  const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0)
  const rawDeltas = [0, 0, 0, 0]

  if (winner.source === 'self-draw') {
    state.players.forEach((player) => {
      if (player.id === winner.winnerId) return
      rawDeltas[player.id] -= totalPoints
      rawDeltas[winner.winnerId] += totalPoints
    })
  } else {
    const loserId = winner.sourcePlayerId ?? 0
    rawDeltas[loserId] -= totalPoints * 3
    rawDeltas[winner.winnerId] += totalPoints * 3
  }

  const deltas: ScoreDelta[] = rawDeltas.map((delta, playerId) => ({
    playerId: playerId as 0 | 1 | 2 | 3,
    delta,
  }))

  return {
    winnerId: winner.winnerId,
    deltas,
    totalPoints,
    breakdown,
    summary: `${state.players[winner.winnerId].name}${winner.source === 'self-draw' ? '自摸' : '点炮'}${winner.winType === 'bao-zhong-bao' ? '宝中宝' : '胡牌'}，${totalPoints} 分。`,
  }
}
