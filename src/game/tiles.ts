import type { Tile } from './types'

const WIND_LABELS: Record<number, string> = {
  1: '东',
  2: '南',
  3: '西',
  4: '北',
}

const DRAGON_LABELS: Record<number, string> = {
  1: '中',
  2: '发',
  3: '白',
}

let tileCounter = 0

const makeTile = (suit: Tile['suit'], rank: number): Tile => ({
  id: `${suit}-${rank}-${tileCounter++}`,
  suit,
  rank,
})

export const createWall = (): Tile[] => {
  tileCounter = 0
  const wall: Tile[] = []

  ;(['dot', 'bam', 'char'] as const).forEach((suit) => {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push(makeTile(suit, rank))
      }
    }
  })

  ;(['wind', 'dragon'] as const).forEach((suit) => {
    const maxRank = suit === 'wind' ? 4 : 3
    for (let rank = 1; rank <= maxRank; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push(makeTile(suit, rank))
      }
    }
  })

  return wall
}

export const tileCode = (tile: Tile): string => `${tile.suit}-${tile.rank}`

export const compareTiles = (a: Tile, b: Tile): number => {
  const suitOrder: Record<Tile['suit'], number> = {
    char: 0,
    bam: 1,
    dot: 2,
    wind: 3,
    dragon: 4,
  }

  if (suitOrder[a.suit] !== suitOrder[b.suit]) {
    return suitOrder[a.suit] - suitOrder[b.suit]
  }

  if (a.rank !== b.rank) {
    return a.rank - b.rank
  }

  return a.id.localeCompare(b.id)
}

export const sortHand = (tiles: Tile[]): Tile[] => [...tiles].sort(compareTiles)

export const tileLabel = (tile: Tile): string => {
  if (tile.suit === 'wind') {
    return WIND_LABELS[tile.rank]
  }

  if (tile.suit === 'dragon') {
    return DRAGON_LABELS[tile.rank]
  }

  if (tile.suit === 'char') return `${tile.rank}万`
  if (tile.suit === 'bam') return `${tile.rank}条`
  return `${tile.rank}筒`
}

export const tileVisual = (tile: Tile): string => {
  if (tile.suit === 'wind' || tile.suit === 'dragon') {
    return tileLabel(tile)
  }

  return `${tile.rank}${tile.suit === 'char' ? '万' : tile.suit === 'bam' ? '条' : '筒'}`
}

export const tileSuitBadge = (tile: Tile): string => {
  if (tile.suit === 'char') return '萬'
  if (tile.suit === 'bam') return '條'
  if (tile.suit === 'dot') return '筒'
  return ''
}

export const cloneTile = (tile: Tile): Tile => ({ ...tile })

export const shuffle = <T,>(input: T[]): T[] => {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
