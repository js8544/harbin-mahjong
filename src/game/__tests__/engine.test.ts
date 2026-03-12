import { describe, expect, it } from 'vitest'
import {
  createInitialGameState,
  discardTile,
  resolveClaim,
  startRound,
} from '../engine'
import type { GameState, Tile, WinInfo } from '../types'

let idCounter = 0
const t = (suit: Tile['suit'], rank: number): Tile => ({
  suit,
  rank,
  id: `et-${idCounter++}`,
})

const withHands = (hands: Tile[][]): GameState => {
  const state = createInitialGameState()
  const players = state.players.map((player, idx) => ({
    ...player,
    hand: hands[idx] ?? [],
    melds: [],
    discards: [],
    opened: idx === 1 || idx === 2,
    ting: idx === 1 || idx === 2,
  }))

  return {
    ...state,
    players,
    phase: 'discard',
    currentPlayerId: 0,
    turnNumber: 1,
  }
}

const winInfo = (partial: Omit<WinInfo, 'winType' | 'isJiaHu' | 'usedBao'>): WinInfo => ({
  ...partial,
  winType: partial.source === 'self-draw' ? 'self-draw' : 'pinghu',
  isJiaHu: false,
  usedBao: false,
})

describe('engine discard claim queue', () => {
  it('returns to next player draw when only claimer passes', () => {
    const c5a = t('char', 5)

    const state = withHands([
      [c5a, t('dot', 1), t('dot', 2)],
      [t('char', 3), t('char', 4), t('char', 6), t('char', 7), t('char', 8), t('char', 9), t('bam', 1), t('bam', 1), t('bam', 1), t('dot', 2), t('dot', 3), t('dot', 4), t('red', 1)],
      [t('char', 2), t('char', 2), t('bam', 9)],
      [t('red', 1), t('char', 2), t('char', 8)],
    ])
    state.players[1].opened = false
    state.players[1].ting = false

    const afterDiscard = discardTile(state, c5a.id)
    expect(afterDiscard.phase).toBe('claimPrompt')
    expect(afterDiscard.currentPrompt?.playerId).toBe(1)
    expect(afterDiscard.currentPrompt?.actions).toContain('chow')

    const afterPass = resolveClaim(afterDiscard, 'pass')
    expect(afterPass.phase).toBe('draw')
    expect(afterPass.currentPlayerId).toBe(1)
    expect(afterPass.currentPrompt).toBeNull()
    expect(afterPass.claimQueue).toHaveLength(0)
  })
})

describe('engine dealer flow', () => {
  it('rotates dealer when previous dealer does not win', () => {
    const round1 = startRound(createInitialGameState())
    const completed: GameState = {
      ...round1,
      phase: 'roundOver',
      winner: winInfo({
        winnerId: 2,
        source: 'discard',
        sourcePlayerId: 0,
        winningTile: t('dot', 9),
      }),
    }

    const round2 = startRound(completed)
    expect(round2.dealerId).toBe(1)
  })

  it('keeps dealer when dealer wins', () => {
    const round1 = startRound(createInitialGameState())
    const completed: GameState = {
      ...round1,
      phase: 'roundOver',
      winner: winInfo({
        winnerId: 0,
        source: 'self-draw',
        winningTile: t('dot', 1),
      }),
    }

    const round2 = startRound(completed)
    expect(round2.dealerId).toBe(0)
  })
})
