import type { MeldType, PlayerId, Tile } from './types'
import { tileCode } from './tiles'

type TileCounts = Map<string, number>

const isSuited = (tile: Tile): boolean =>
  tile.suit === 'char' || tile.suit === 'bam' || tile.suit === 'dot'

const parseCode = (code: string): { suit: Tile['suit']; rank: number } => {
  const [suit, rank] = code.split('-')
  return { suit: suit as Tile['suit'], rank: Number(rank) }
}

const buildCounts = (tiles: Tile[]): TileCounts => {
  const counts: TileCounts = new Map()
  for (const tile of tiles) {
    const code = tileCode(tile)
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return counts
}

const toSortedCodes = (counts: TileCounts): string[] =>
  [...counts.keys()].sort((a, b) => {
    const aa = parseCode(a)
    const bb = parseCode(b)
    const suitOrder: Record<Tile['suit'], number> = {
      char: 0,
      bam: 1,
      dot: 2,
      wind: 3,
      dragon: 4,
    }
    if (aa.suit !== bb.suit) {
      return suitOrder[aa.suit] - suitOrder[bb.suit]
    }
    return aa.rank - bb.rank
  })

const cloneCounts = (counts: TileCounts): TileCounts => new Map(counts)

const dec = (counts: TileCounts, code: string, amount = 1): void => {
  const next = (counts.get(code) ?? 0) - amount
  if (next <= 0) {
    counts.delete(code)
    return
  }
  counts.set(code, next)
}

const canFormMelds = (counts: TileCounts): boolean => {
  if (counts.size === 0) {
    return true
  }

  const firstCode = toSortedCodes(counts)[0]
  const count = counts.get(firstCode) ?? 0

  if (count >= 3) {
    const tryPong = cloneCounts(counts)
    dec(tryPong, firstCode, 3)
    if (canFormMelds(tryPong)) {
      return true
    }
  }

  const { suit, rank } = parseCode(firstCode)
  if (suit === 'char' || suit === 'bam' || suit === 'dot') {
    const c2 = `${suit}-${rank + 1}`
    const c3 = `${suit}-${rank + 2}`
    if ((counts.get(c2) ?? 0) >= 1 && (counts.get(c3) ?? 0) >= 1) {
      const tryChow = cloneCounts(counts)
      dec(tryChow, firstCode)
      dec(tryChow, c2)
      dec(tryChow, c3)
      if (canFormMelds(tryChow)) {
        return true
      }
    }
  }

  return false
}

export const canWinWithStandardHand = (tiles: Tile[]): boolean => {
  if (tiles.length !== 14) {
    return false
  }

  const counts = buildCounts(tiles)
  const uniqueCodes = toSortedCodes(counts)

  for (const code of uniqueCodes) {
    if ((counts.get(code) ?? 0) < 2) {
      continue
    }

    const remaining = cloneCounts(counts)
    dec(remaining, code, 2)
    if (canFormMelds(remaining)) {
      return true
    }
  }

  return false
}

export const findDiscardClaimOptions = (
  hand: Tile[],
  discardedTile: Tile,
  isNextPlayer: boolean,
): MeldType[] => {
  const merged = [...hand, discardedTile]
  const counts = buildCounts(merged)
  const code = tileCode(discardedTile)
  const options: MeldType[] = []

  if ((counts.get(code) ?? 0) >= 3) {
    options.push('pong')
  }

  if ((counts.get(code) ?? 0) >= 4) {
    options.push('kong')
  }

  if (isNextPlayer && isSuited(discardedTile)) {
    const needed = [
      [discardedTile.rank - 2, discardedTile.rank - 1],
      [discardedTile.rank - 1, discardedTile.rank + 1],
      [discardedTile.rank + 1, discardedTile.rank + 2],
    ]

    for (const [a, b] of needed) {
      if (a < 1 || b > 9) {
        continue
      }
      const ca = `${discardedTile.suit}-${a}`
      const cb = `${discardedTile.suit}-${b}`
      if ((counts.get(ca) ?? 0) >= 1 && (counts.get(cb) ?? 0) >= 1) {
        options.push('chow')
        break
      }
    }
  }

  return options
}

export const canDeclareConcealedKong = (hand: Tile[]): Tile | null => {
  const counts = buildCounts(hand)
  for (const [code, count] of counts.entries()) {
    if (count >= 4) {
      const [match] = hand.filter((tile) => tileCode(tile) === code)
      return match ?? null
    }
  }
  return null
}

export const claimPriorityScore = (
  action: 'win' | 'kong' | 'pong' | 'chow' | 'pass',
): number => {
  const scores: Record<typeof action, number> = {
    win: 4,
    kong: 3,
    pong: 2,
    chow: 1,
    pass: 0,
  }
  return scores[action]
}

export const playerOrderDistance = (
  fromPlayer: PlayerId,
  toPlayer: PlayerId,
): number => (toPlayer - fromPlayer + 4) % 4
