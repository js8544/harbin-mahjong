import { describe, expect, it } from 'vitest'
import { buildSettlement } from '../scoring'
import { createInitialGameState } from '../engine'
import type { Tile } from '../types'

let idCounter = 0
const t = (suit: Tile['suit'], rank: number): Tile => ({
  suit,
  rank,
  id: `st-${idCounter++}`,
})

describe('buildSettlement', () => {
  it('scores a self-draw standard hand', () => {
    const state = createInitialGameState()
    state.players[0].hand = [
      t('char', 1), t('char', 2), t('char', 3),
      t('char', 4), t('char', 5), t('char', 6),
      t('bam', 2), t('bam', 3), t('bam', 4),
      t('dot', 7), t('dot', 8), t('dot', 9),
      t('wind', 1), t('wind', 1),
    ]

    const settlement = buildSettlement(state, {
      winnerId: 0,
      source: 'self-draw',
      winningTile: state.players[0].hand[13],
    })

    expect(settlement?.totalPoints).toBeGreaterThanOrEqual(2)
    expect(settlement?.deltas.find((item) => item.playerId === 0)?.delta).toBeGreaterThan(0)
  })

  it('scores seven pairs bonus', () => {
    const state = createInitialGameState()
    state.players[1].hand = [
      t('char', 1), t('char', 1),
      t('char', 3), t('char', 3),
      t('bam', 2), t('bam', 2),
      t('bam', 5), t('bam', 5),
      t('dot', 4), t('dot', 4),
      t('dot', 9), t('dot', 9),
      t('dragon', 1), t('dragon', 1),
    ]

    const settlement = buildSettlement(state, {
      winnerId: 1,
      source: 'discard',
      sourcePlayerId: 2,
      winningTile: state.players[1].hand[13],
    })

    expect(settlement?.breakdown.some((item) => item.label === 'Seven pairs')).toBe(true)
    expect(settlement?.deltas.find((item) => item.playerId === 1)?.delta).toBeGreaterThan(0)
    expect(settlement?.deltas.find((item) => item.playerId === 2)?.delta).toBeLessThan(0)
  })
})
