export type Suit = 'dot' | 'bam' | 'char' | 'wind' | 'dragon'

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
}

export type PendingPromptAction = 'win' | 'kong' | 'pong' | 'chow' | 'pass'

export type PendingPrompt = {
  playerId: PlayerId
  sourcePlayerId: PlayerId
  tile: Tile
  actions: PendingPromptAction[]
}

export type TurnPhase =
  | 'notStarted'
  | 'draw'
  | 'discard'
  | 'claimPrompt'
  | 'roundOver'

export type WinInfo = {
  winnerId: PlayerId
  source: 'self-draw' | 'discard'
  winningTile: Tile
  sourcePlayerId?: PlayerId
}

export type HarbinRuleAssumptions = {
  winStructure: 'standard-4-melds-1-pair'
  chowRestriction: 'only-next-player-on-discard'
  claimPriority: ['win', 'kong', 'pong', 'chow']
  flowersUsed: false
  scoringModel: 'simplified-flat-win-without-fan-counting'
  handSize: 13
  wallTileCount: 136
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
  assumptions: HarbinRuleAssumptions
}
