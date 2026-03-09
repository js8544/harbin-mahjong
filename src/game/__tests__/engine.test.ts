import { describe, expect, it } from 'vitest'
import {
  createInitialGameState,
  discardTile,
  resolveClaim,
  startRound,
} from '../engine'
import type { GameState, Tile } from '../types'

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
  }))

  return {
    ...state,
    players,
    phase: 'discard',
    currentPlayerId: 0,
    turnNumber: 1,
  }
}

describe('engine discard claim queue', () => {
  it('falls through to lower-priority claimers when first claimer passes', () => {
    const c5a = t('char', 5)
    const c5b = t('char', 5)
    const c5c = t('char', 5)

    const state = withHands([
      [c5a, t('dot', 1), t('dot', 2)],
      [t('char', 3), t('char', 4), t('dot', 8)],
      [c5b, c5c, t('bam', 9)],
      [t('wind', 1), t('wind', 2), t('wind', 3)],
    ])

    const afterDiscard = discardTile(state, c5a.id)
    expect(afterDiscard.phase).toBe('claimPrompt')
    expect(afterDiscard.currentPrompt?.playerId).toBe(2)
    expect(afterDiscard.currentPrompt?.actions).toContain('pong')
    expect(afterDiscard.claimQueue[0]?.playerId).toBe(1)

    const afterFirstPass = resolveClaim(afterDiscard, 'pass')
    expect(afterFirstPass.phase).toBe('claimPrompt')
    expect(afterFirstPass.currentPrompt?.playerId).toBe(1)
    expect(afterFirstPass.currentPlayerId).toBe(1)

    const afterSecondPass = resolveClaim(afterFirstPass, 'pass')
    expect(afterSecondPass.phase).toBe('draw')
    expect(afterSecondPass.currentPlayerId).toBe(1)
    expect(afterSecondPass.currentPrompt).toBeNull()
    expect(afterSecondPass.claimQueue).toHaveLength(0)
  })
})

describe('engine dealer flow', () => {
  it('rotates dealer when previous dealer does not win', () => {
    const round1 = startRound(createInitialGameState())
    const completed = {
      ...round1,
      phase: 'roundOver' as const,
      winner: {
        winnerId: 2 as const,
        source: 'discard' as const,
        sourcePlayerId: 0 as const,
        winningTile: t('dot', 9),
      },
    }

    const round2 = startRound(completed)
    expect(round2.dealerId).toBe(1)
  })

  it('keeps dealer when dealer wins', () => {
    const round1 = startRound(createInitialGameState())
    const completed = {
      ...round1,
      phase: 'roundOver' as const,
      winner: {
        winnerId: 0 as const,
        source: 'self-draw' as const,
        winningTile: t('dot', 1),
      },
    }

    const round2 = startRound(completed)
    expect(round2.dealerId).toBe(0)
  })
})
