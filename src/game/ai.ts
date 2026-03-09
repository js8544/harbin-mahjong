import { canWinWithStandardHand, findChowPatterns } from './rules'
import { tileCode } from './tiles'
import type { MeldType, Tile } from './types'

type TileShape = Pick<Tile, 'suit' | 'rank'>

const ALL_TILE_TYPES: TileShape[] = [
  ...(['char', 'bam', 'dot'] as const).flatMap((suit) =>
    Array.from({ length: 9 }, (_, idx) => ({ suit, rank: idx + 1 })),
  ),
  ...Array.from({ length: 4 }, (_, idx) => ({ suit: 'wind' as const, rank: idx + 1 })),
  ...Array.from({ length: 3 }, (_, idx) => ({ suit: 'dragon' as const, rank: idx + 1 })),
]

const isHonor = (tile: Tile | TileShape): boolean =>
  tile.suit === 'wind' || tile.suit === 'dragon'

const makeVirtualTile = (shape: TileShape): Tile => ({
  ...shape,
  id: `virtual-${shape.suit}-${shape.rank}`,
})

const countWinningDraws = (hand: Tile[]): number => {
  if (hand.length !== 13) {
    return 0
  }

  let wins = 0
  for (const shape of ALL_TILE_TYPES) {
    if (canWinWithStandardHand([...hand, makeVirtualTile(shape)])) {
      wins += 1
    }
  }

  return wins
}

const structuralScore = (hand: Tile[]): number => {
  const counts = new Map<string, number>()
  for (const tile of hand) {
    const code = tileCode(tile)
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  let score = 0
  for (const tile of hand) {
    const same = counts.get(tileCode(tile)) ?? 0
    const pairPoints = same >= 2 ? 2 : 0
    const tripletPoints = same >= 3 ? 2 : 0

    let neighborPoints = 0
    if (!isHonor(tile)) {
      for (const delta of [-2, -1, 1, 2]) {
        const rank = tile.rank + delta
        if (rank < 1 || rank > 9) {
          continue
        }

        const neighborCode = `${tile.suit}-${rank}`
        if ((counts.get(neighborCode) ?? 0) > 0) {
          neighborPoints += Math.abs(delta) === 1 ? 2 : 1
        }
      }
    }

    const isolatedPenalty = !isHonor(tile) && pairPoints === 0 && neighborPoints === 0 ? -2 : 0
    const deadHonorPenalty = isHonor(tile) && same === 1 ? -2 : 0

    score += pairPoints + tripletPoints + neighborPoints + isolatedPenalty + deadHonorPenalty
  }

  return score
}

const simulatePongHand = (hand: Tile[], discardedTile: Tile): Tile[] | null => {
  const code = tileCode(discardedTile)
  const matching = hand.filter((tile) => tileCode(tile) === code)
  if (matching.length < 2) {
    return null
  }

  const [a, b] = matching
  return hand.filter((tile) => tile.id !== a.id && tile.id !== b.id)
}

const simulateKongHand = (hand: Tile[], discardedTile: Tile): Tile[] | null => {
  const code = tileCode(discardedTile)
  const matching = hand.filter((tile) => tileCode(tile) === code)
  if (matching.length < 3) {
    return null
  }

  const [a, b, c] = matching
  return hand.filter((tile) => tile.id !== a.id && tile.id !== b.id && tile.id !== c.id)
}

const simulateBestChowHand = (hand: Tile[], discardedTile: Tile): Tile[] | null => {
  const patterns = findChowPatterns(hand, discardedTile, true)
  if (patterns.length === 0) {
    return null
  }

  let best: Tile[] | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const [a, b] of patterns) {
    const next = hand.filter((tile) => tile.id !== a.id && tile.id !== b.id)
    const score = structuralScore(next)
    if (score > bestScore) {
      best = next
      bestScore = score
    }
  }

  return best
}

export const chooseDiscard = (hand: Tile[]): Tile => {
  let best = hand[0]
  let bestWaits = Number.NEGATIVE_INFINITY
  let bestStructure = Number.NEGATIVE_INFINITY

  for (const tile of hand) {
    const nextHand = hand.filter((candidate) => candidate.id !== tile.id)
    const waits = countWinningDraws(nextHand)
    const structure = structuralScore(nextHand)

    if (
      waits > bestWaits ||
      (waits === bestWaits && structure > bestStructure) ||
      (waits === bestWaits &&
        structure === bestStructure &&
        isHonor(tile) &&
        !isHonor(best))
    ) {
      best = tile
      bestWaits = waits
      bestStructure = structure
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

  const baseline = structuralScore(hand)
  const waits = countWinningDraws(hand)

  if (action === 'kong') {
    const post = simulateKongHand(hand, discardedTile)
    if (!post) {
      return false
    }

    const postScore = structuralScore(post) + 8
    return postScore >= baseline || isHonor(discardedTile)
  }

  if (action === 'pong') {
    const post = simulatePongHand(hand, discardedTile)
    if (!post) {
      return false
    }

    const postScore = structuralScore(post) + 5
    if (isHonor(discardedTile)) {
      return true
    }

    return postScore >= baseline + 1 && waits < 7
  }

  if (action === 'chow') {
    const post = simulateBestChowHand(hand, discardedTile)
    if (!post) {
      return false
    }

    const postScore = structuralScore(post) + 3
    return postScore >= baseline + 1 && waits < 6
  }

  return false
}
