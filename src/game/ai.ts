import { canTingWithTileAdded, meetsHarbinBasicHu } from './rules'
import type { MeldType, Tile } from './types'

type TileShape = Pick<Tile, 'suit' | 'rank'>

const ALL_TILE_TYPES: TileShape[] = [
  ...(['char', 'bam', 'dot'] as const).flatMap((suit) =>
    Array.from({ length: 9 }, (_, idx) => ({ suit, rank: idx + 1 })),
  ),
  { suit: 'red' as const, rank: 1 },
]

const makeVirtualTile = (shape: TileShape): Tile => ({
  ...shape,
  id: `virtual-${shape.suit}-${shape.rank}`,
})

const countTingWins = (hand: Tile[], opened: boolean): number => {
  if (hand.length !== 13) return 0
  let wins = 0
  for (const shape of ALL_TILE_TYPES) {
    if (canTingWithTileAdded(hand, makeVirtualTile(shape), opened)) {
      wins += 1
    }
  }
  return wins
}

export const chooseDiscard = (hand: Tile[], opened = false): Tile => {
  let best = hand[0]
  let bestScore = -1

  for (const tile of hand) {
    const nextHand = hand.filter((candidate) => candidate.id !== tile.id)
    const score = countTingWins(nextHand, opened)
    if (score > bestScore) {
      best = tile
      bestScore = score
    }
  }

  return best
}

export const shouldClaim = (
  action: MeldType | 'win' | 'ting',
  hand: Tile[],
  discardedTile: Tile,
  opened = false,
): boolean => {
  if (action === 'win') {
    return meetsHarbinBasicHu([...hand, discardedTile], opened)
  }

  if (action === 'ting') {
    return canTingWithTileAdded(hand, discardedTile, true)
  }

  return true
}
