import { describe, expect, it } from 'vitest'
import { buildSettlement } from '../scoring'
import { createInitialGameState } from '../engine'
import type { Tile, WinInfo } from '../types'

let idCounter = 0
const t = (suit: Tile['suit'], rank: number): Tile => ({
  suit,
  rank,
  id: `st-${idCounter++}`,
})

const info = (partial: Omit<WinInfo, 'winType' | 'isJiaHu' | 'usedBao'>): WinInfo => ({
  ...partial,
  winType: partial.source === 'self-draw' ? 'self-draw' : 'pinghu',
  isJiaHu: false,
  usedBao: false,
})

describe('buildSettlement', () => {
  it('scores a self-draw standard hand', () => {
    const state = createInitialGameState()
    state.players[0].hand = [
      t('char', 1), t('char', 2), t('char', 3),
      t('char', 4), t('char', 5), t('char', 6),
      t('bam', 2), t('bam', 3), t('bam', 4),
      t('dot', 7), t('dot', 8), t('dot', 9),
      t('red', 1), t('red', 1),
    ]

    const settlement = buildSettlement(state, info({
      winnerId: 0,
      source: 'self-draw',
      winningTile: state.players[0].hand[13],
    }))

    expect(settlement.totalPoints).toBeGreaterThanOrEqual(2)
    expect(settlement.deltas.find((item) => item.playerId === 0)?.delta).toBeGreaterThan(0)
  })

  it('adds bao bonus', () => {
    const state = createInitialGameState()
    const settlement = buildSettlement(state, {
      winnerId: 1,
      source: 'discard',
      sourcePlayerId: 2,
      winningTile: t('red', 1),
      winType: 'bao-zhong-bao',
      isJiaHu: true,
      usedBao: true,
    })

    expect(settlement.breakdown.some((item) => item.label === '宝中宝')).toBe(true)
    expect(settlement.deltas.find((item) => item.playerId === 1)?.delta).toBeGreaterThan(0)
    expect(settlement.deltas.find((item) => item.playerId === 2)?.delta).toBeLessThan(0)
  })
})
