import { describe, expect, it } from 'vitest'
import {
  canDeclareConcealedKong,
  canWinWithStandardHand,
  findDiscardClaimOptions,
  playerOrderDistance,
} from '../rules'
import type { Tile } from '../types'

let idCounter = 0
const t = (suit: Tile['suit'], rank: number): Tile => ({
  suit,
  rank,
  id: `t-${idCounter++}`,
})

describe('canWinWithStandardHand', () => {
  it('returns true for a valid 4 meld + pair hand', () => {
    const tiles: Tile[] = [
      t('char', 1),
      t('char', 2),
      t('char', 3),
      t('char', 4),
      t('char', 5),
      t('char', 6),
      t('bam', 2),
      t('bam', 3),
      t('bam', 4),
      t('dot', 5),
      t('dot', 5),
      t('dot', 5),
      t('wind', 1),
      t('wind', 1),
    ]

    expect(canWinWithStandardHand(tiles)).toBe(true)
  })

  it('returns false for non-winning hand shape', () => {
    const tiles: Tile[] = [
      t('char', 1),
      t('char', 1),
      t('char', 2),
      t('char', 3),
      t('char', 4),
      t('bam', 1),
      t('bam', 2),
      t('bam', 3),
      t('dot', 2),
      t('dot', 3),
      t('dot', 4),
      t('dragon', 1),
      t('dragon', 2),
      t('wind', 4),
    ]

    expect(canWinWithStandardHand(tiles)).toBe(false)
  })
})

describe('discard claim options', () => {
  it('allows chow only for next player', () => {
    const hand: Tile[] = [t('char', 3), t('char', 4), t('wind', 1)]
    const discarded = t('char', 5)

    expect(findDiscardClaimOptions(hand, discarded, true)).toContain('chow')
    expect(findDiscardClaimOptions(hand, discarded, false)).not.toContain('chow')
  })

  it('detects concealed kong in hand', () => {
    const hand = [t('dot', 9), t('dot', 9), t('dot', 9), t('dot', 9), t('bam', 1)]
    expect(canDeclareConcealedKong(hand)?.rank).toBe(9)
  })
})

describe('turn order distance', () => {
  it('wraps around table order', () => {
    expect(playerOrderDistance(3, 0)).toBe(1)
    expect(playerOrderDistance(1, 3)).toBe(2)
  })
})
