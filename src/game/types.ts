export type Suit = 'dot' | 'bam' | 'char' | 'red'

export type Tile = {
  id: string
  suit: Suit
  rank: number
}

export type PlayerId = 0 | 1 | 2 | 3

export type MeldType = 'chow' | 'pong' | 'kong'

export type Meld = {
  type: MeldType
  tiles: Tile[]
  fromPlayer: PlayerId
  concealed?: boolean
}

export type PlayerState = {
  id: PlayerId
  name: string
  isHuman: boolean
  hand: Tile[]
  melds: Meld[]
  discards: Tile[]
  seatWind: 'East' | 'South' | 'West' | 'North'
  hasWon: boolean
  ting: boolean
  opened: boolean
}

export type PendingPromptAction = 'win' | 'kong' | 'pong' | 'chow' | 'ting' | 'pass'

export type PendingPrompt = {
  playerId: PlayerId
  sourcePlayerId: PlayerId
  tile: Tile
  actions: PendingPromptAction[]
  tingDiscardOptions?: string[]
  winningDraws?: Tile[]
}

export type TurnPhase = 'notStarted' | 'draw' | 'discard' | 'claimPrompt' | 'roundOver'

export type WinType = 'pinghu' | 'self-draw' | 'touch-bao' | 'bao-zhong-bao' | 'qiang-gang'

export type WinInfo = {
  winnerId: PlayerId
  source: 'self-draw' | 'discard'
  winningTile: Tile
  sourcePlayerId?: PlayerId
  winType: WinType
  isJiaHu: boolean
  usedBao: boolean
}

export type ScoreDelta = {
  playerId: PlayerId
  delta: number
}

export type RoundSettlement = {
  winnerId: PlayerId
  deltas: ScoreDelta[]
  totalPoints: number
  breakdown: Array<{
    label: string
    points: number
  }>
  summary: string
}

export type HarbinRuleAssumptions = {
  winStructure: 'harbin-open-hand'
  chowRestriction: 'only-next-player-on-discard'
  claimPriority: ['win', 'ting', 'kong', 'pong', 'chow']
  flowersUsed: false
  scoringModel: 'harbin-a-single-hidden-bao'
  handSize: 13
  wallTileCount: 112
  baoCount: 1
  requiresOpenBeforeTing: true
  requiresYaoJiu: true
  requiresSequence: true
  requiresTriplet: true
  forbidsPureOneSuit: true
  forbidsSevenPairs: true
  forbidsShouBaYi: true
}

export type GameState = {
  players: PlayerState[]
  wall: Tile[]
  currentPlayerId: PlayerId
  dealerId: PlayerId
  phase: TurnPhase
  currentDrawnTile: Tile | null
  currentPrompt: PendingPrompt | null
  claimQueue: PendingPrompt[]
  lastDiscard: {
    tile: Tile
    playerId: PlayerId
  } | null
  roundNumber: number
  turnNumber: number
  log: string[]
  winner: WinInfo | null
  roundSettlement: RoundSettlement | null
  scores: number[]
  assumptions: HarbinRuleAssumptions
  hiddenBaoTile: Tile | null
  justDrawnTileId: string | null
}
