import type { MeldType, Tile } from './types'
import { canWinWithStandardHand } from './rules'
import { tileCode } from './tiles'

const tileValue = (tile: Tile, hand: Tile[]): number => {
  const sameTileCount = hand.filter((candidate) => tileCode(candidate) === tileCode(tile)).length
  const suitNeighbors = hand.filter(
    (candidate) =>
      candidate.suit === tile.suit &&
      (candidate.rank === tile.rank - 1 ||
        candidate.rank === tile.rank + 1 ||
        candidate.rank === tile.rank - 2 ||
        candidate.rank === tile.rank + 2),
  ).length

  const honorPenalty = tile.suit === 'wind' || tile.suit === 'dragon' ? -1 : 0

  return sameTileCount * 2 + suitNeighbors + honorPenalty
}

export const chooseDiscard = (hand: Tile[]): Tile => {
  let best = hand[0]
  let bestScore = Number.POSITIVE_INFINITY

  for (const tile of hand) {
    const score = tileValue(tile, hand)
    if (score < bestScore) {
      best = tile
      bestScore = score
    }
  }

  return best
}

export const shouldClaim = (
  action: MeldType | 'win',
  hand: Tile[],
  discardedTile: Tile,
): boolean => {
  if (action === 'win') {
    return canWinWithStandardHand([...hand, discardedTile])
  }

  if (action === 'kong') {
    return true
  }

  if (action === 'pong') {
    const pairCount = hand.filter((tile) => tileCode(tile) === tileCode(discardedTile)).length
    return pairCount >= 2
  }

  if (action === 'chow') {
    return true
  }

  return false
}
