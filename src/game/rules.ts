import type { MeldType, Tile } from './types'
import { isRedCenter, tileCode } from './tiles'

type TileCounts = Map<string, number>

type WinPattern = {
  pairCode: string
  melds: Array<
    | { type: 'pong'; code: string }
    | { type: 'chow'; suit: 'char' | 'bam' | 'dot'; start: number }
  >
}

const isSuited = (tile: Tile): boolean => tile.suit === 'char' || tile.suit === 'bam' || tile.suit === 'dot'

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

export const getTileCounts = (tiles: Tile[]): TileCounts => buildCounts(tiles)

const toSortedCodes = (counts: TileCounts): string[] =>
  [...counts.keys()].sort((a, b) => {
    const aa = parseCode(a)
    const bb = parseCode(b)
    const suitOrder: Record<Tile['suit'], number> = {
      char: 0,
      bam: 1,
      dot: 2,
      red: 3,
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

const countDistinctSuits = (tiles: Tile[]): number => {
  const suits = new Set(tiles.filter((t) => t.suit !== 'red').map((t) => t.suit))
  return suits.size
}

const isPureOneSuit = (tiles: Tile[]): boolean => {
  const suitedTiles = tiles.filter((tile) => tile.suit !== 'red')
  if (suitedTiles.length === 0) return false
  const suit = suitedTiles[0].suit
  return suitedTiles.every((tile) => tile.suit === suit)
}

export const hasYaoJiu = (tiles: Tile[]): boolean =>
  tiles.some((tile) => isRedCenter(tile) || (isSuited(tile) && (tile.rank === 1 || tile.rank === 9)))

const findWinningPatternsFromCounts = (counts: TileCounts): WinPattern[] => {
  const patterns: WinPattern[] = []

  const dfs = (current: TileCounts, melds: WinPattern['melds'], pairCode: string | null): void => {
    if (current.size === 0) {
      if (pairCode) patterns.push({ pairCode, melds: [...melds] })
      return
    }

    const firstCode = toSortedCodes(current)[0]
    const count = current.get(firstCode) ?? 0
    const { suit, rank } = parseCode(firstCode)

    if (!pairCode && count >= 2) {
      const next = cloneCounts(current)
      dec(next, firstCode, 2)
      dfs(next, melds, firstCode)
    }

    if (count >= 3) {
      const next = cloneCounts(current)
      dec(next, firstCode, 3)
      dfs(next, [...melds, { type: 'pong', code: firstCode }], pairCode)
    }

    if ((suit === 'char' || suit === 'bam' || suit === 'dot') && rank <= 7) {
      const c2 = `${suit}-${rank + 1}`
      const c3 = `${suit}-${rank + 2}`
      if ((current.get(c2) ?? 0) >= 1 && (current.get(c3) ?? 0) >= 1) {
        const next = cloneCounts(current)
        dec(next, firstCode)
        dec(next, c2)
        dec(next, c3)
        dfs(next, [...melds, { type: 'chow', suit, start: rank }], pairCode)
      }
    }
  }

  if (counts.size > 0) {
    dfs(counts, [], null)
  }

  return patterns
}

export const findWinningPatterns = (tiles: Tile[]): WinPattern[] => {
  if (tiles.length !== 14) return []
  return findWinningPatternsFromCounts(buildCounts(tiles))
}

export const canWinWithStandardHand = (tiles: Tile[]): boolean => findWinningPatterns(tiles).length > 0

export const meetsHarbinBasicHu = (tiles: Tile[], opened: boolean): boolean => {
  if (!opened) return false
  if (tiles.length !== 14) return false
  if (countDistinctSuits(tiles) < 2) return false
  if (!hasYaoJiu(tiles)) return false
  if (isPureOneSuit(tiles)) return false

  const patterns = findWinningPatterns(tiles)
  if (patterns.length === 0) return false

  return patterns.some((pattern) => {
    const hasPong = pattern.melds.some((meld) => meld.type === 'pong')
    const hasChow = pattern.melds.some((meld) => meld.type === 'chow')
    return hasPong && hasChow
  })
}

export const isJiaHuTile = (tiles: Tile[], winningTile: Tile): boolean => {
  const patterns = findWinningPatterns(tiles)
  return patterns.some((pattern) =>
    pattern.melds.some(
      (meld) => meld.type === 'chow' && meld.suit === winningTile.suit && meld.start + 1 === winningTile.rank,
    ),
  )
}

export const canTingWithTileAdded = (hand: Tile[], tile: Tile, opened: boolean): boolean =>
  meetsHarbinBasicHu([...hand, tile], opened)

export const findDiscardClaimOptions = (hand: Tile[], discardedTile: Tile, isNextPlayer: boolean): MeldType[] => {
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

  if (isNextPlayer && isSuited(discardedTile) && findChowPatterns(hand, discardedTile, true).length > 0) {
    options.push('chow')
  }

  return options
}

export const findChowPatterns = (
  hand: Tile[],
  discardedTile: Tile,
  isNextPlayer: boolean,
): Array<[Tile, Tile]> => {
  if (!isNextPlayer || !isSuited(discardedTile)) {
    return []
  }

  const possiblePatterns = [
    [discardedTile.rank - 2, discardedTile.rank - 1],
    [discardedTile.rank - 1, discardedTile.rank + 1],
    [discardedTile.rank + 1, discardedTile.rank + 2],
  ]

  const patterns: Array<[Tile, Tile]> = []
  for (const [a, b] of possiblePatterns) {
    if (a < 1 || b > 9) continue

    const ta = hand.find((tile) => tile.suit === discardedTile.suit && tile.rank === a)
    const tb = hand.find(
      (tile) => tile.suit === discardedTile.suit && tile.rank === b && tile.id !== ta?.id,
    )

    if (ta && tb) patterns.push([ta, tb])
  }

  return patterns
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

export const claimPriorityScore = (action: 'win' | 'ting' | 'kong' | 'pong' | 'chow' | 'pass'): number => {
  const scores: Record<typeof action, number> = {
    win: 5,
    ting: 4,
    kong: 3,
    pong: 2,
    chow: 1,
    pass: 0,
  }
  return scores[action]
}

export const playerOrderDistance = (fromPlayer: number, toPlayer: number): number => (toPlayer - fromPlayer + 4) % 4
