import { describe, expect, it } from 'vitest'
import {
  canDeclareConcealedKong,
  canWinWithStandardHand,
  findDiscardClaimOptions,
  meetsHarbinBasicHu,
  playerOrderDistance,
} from '../rules'
import type { Tile } from '../types'

let idCounter = 0
const t = (suit: Tile['suit'], rank: number): Tile => ({
  suit,
  rank,
  id: `t-${idCounter++}`,
})

describe('standard shape', () => {
  it('returns true for a valid 4 meld + pair hand', () => {
    const tiles: Tile[] = [
      t('char', 1), t('char', 2), t('char', 3),
      t('char', 4), t('char', 5), t('char', 6),
      t('bam', 2), t('bam', 3), t('bam', 4),
      t('dot', 5), t('dot', 5), t('dot', 5),
      t('red', 1), t('red', 1),
    ]

    expect(canWinWithStandardHand(tiles)).toBe(true)
  })

  it('rejects unopened harbin basic hu', () => {
    const tiles: Tile[] = [
      t('char', 1), t('char', 2), t('char', 3),
      t('char', 4), t('char', 5), t('char', 6),
      t('bam', 2), t('bam', 3), t('bam', 4),
      t('dot', 5), t('dot', 5), t('dot', 5),
      t('red', 1), t('red', 1),
    ]

    expect(meetsHarbinBasicHu(tiles, false)).toBe(false)
    expect(meetsHarbinBasicHu(tiles, true)).toBe(true)
  })
})

describe('discard claim options', () => {
  it('allows chow only for next player', () => {
    const hand: Tile[] = [t('char', 3), t('char', 4), t('red', 1)]
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
