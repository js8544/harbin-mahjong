import {
  canDeclareConcealedKong,
  canWinWithStandardHand,
  claimPriorityScore,
  findChowPatterns,
  findDiscardClaimOptions,
  playerOrderDistance,
} from './rules'
import { cloneTile, createWall, shuffle, sortHand, tileCode, tileLabel } from './tiles'
import type {
  GameState,
  HarbinRuleAssumptions,
  Meld,
  PendingPrompt,
  PendingPromptAction,
  PlayerId,
  PlayerState,
  Tile,
} from './types'

const PLAYER_NAMES = ['You', 'AI East', 'AI South', 'AI West']
const WINDS: PlayerState['seatWind'][] = ['East', 'South', 'West', 'North']

export const DEFAULT_ASSUMPTIONS: HarbinRuleAssumptions = {
  winStructure: 'standard-4-melds-1-pair',
  chowRestriction: 'only-next-player-on-discard',
  claimPriority: ['win', 'kong', 'pong', 'chow'],
  flowersUsed: false,
  scoringModel: 'simplified-flat-win-without-fan-counting',
  handSize: 13,
  wallTileCount: 136,
}

const makePlayers = (): PlayerState[] =>
  ([0, 1, 2, 3] as const).map((id) => ({
    id,
    name: PLAYER_NAMES[id],
    isHuman: id === 0,
    hand: [],
    melds: [],
    discards: [],
    seatWind: WINDS[id],
    hasWon: false,
  }))

const nextPlayerId = (id: PlayerId): PlayerId => (((id + 1) % 4) as PlayerId)

const removeTilesByCode = (hand: Tile[], code: string, count: number): Tile[] => {
  const result: Tile[] = []
  let removed = 0
  for (const tile of hand) {
    if (tileCode(tile) === code && removed < count) {
      removed += 1
      continue
    }
    result.push(tile)
  }
  return result
}

const clonePlayers = (players: PlayerState[]): PlayerState[] =>
  players.map((player) => ({
    ...player,
    hand: [...player.hand],
    melds: player.melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
    discards: [...player.discards],
  }))

const addLog = (state: GameState, entry: string): GameState => ({
  ...state,
  log: [`T${state.turnNumber}: ${entry}`, ...state.log].slice(0, 80),
})

const bestActionRank = (prompt: PendingPrompt): number => {
  const topAction = prompt.actions.reduce<PendingPromptAction>(
    (best, current) =>
      claimPriorityScore(current) > claimPriorityScore(best) ? current : best,
    'pass',
  )

  return claimPriorityScore(topAction)
}

const resolveNextDealer = (prev: GameState): PlayerId => {
  if (prev.roundNumber === 0) {
    return prev.dealerId
  }

  if (prev.winner?.winnerId === prev.dealerId) {
    return prev.dealerId
  }

  return nextPlayerId(prev.dealerId)
}

export const createInitialGameState = (): GameState => ({
  players: makePlayers(),
  wall: [],
  currentPlayerId: 0,
  dealerId: 0,
  phase: 'notStarted',
  currentDrawnTile: null,
  currentPrompt: null,
  claimQueue: [],
  lastDiscard: null,
  roundNumber: 0,
  turnNumber: 0,
  log: [],
  winner: null,
  assumptions: DEFAULT_ASSUMPTIONS,
})

export const startRound = (prev: GameState): GameState => {
  const wall = shuffle(createWall())
  const players = makePlayers()
  const nextDealerId = resolveNextDealer(prev)

  for (let pass = 0; pass < DEFAULT_ASSUMPTIONS.handSize; pass += 1) {
    for (let pid = 0; pid < players.length; pid += 1) {
      const tile = wall.pop()
      if (!tile) {
        throw new Error('Wall exhausted while dealing')
      }
      players[pid].hand.push(tile)
    }
  }

  for (const player of players) {
    player.hand = sortHand(player.hand)
  }

  const roundNumber = prev.roundNumber + 1

  return {
    ...prev,
    players,
    wall,
    currentPlayerId: nextDealerId,
    dealerId: nextDealerId,
    phase: 'draw',
    currentDrawnTile: null,
    currentPrompt: null,
    claimQueue: [],
    lastDiscard: null,
    roundNumber,
    turnNumber: 1,
    winner: null,
    log: [`Round ${roundNumber} started. ${players[nextDealerId].name} is dealer.`],
  }
}

export const drawTile = (state: GameState): GameState => {
  if (state.phase !== 'draw' || state.winner) {
    return state
  }

  const wall = [...state.wall]
  const draw = wall.pop()
  if (!draw) {
    return {
      ...state,
      wall,
      phase: 'roundOver',
      winner: null,
      currentPrompt: null,
      claimQueue: [],
      log: ['Round ended in draw (wall exhausted).', ...state.log],
    }
  }

  const players = clonePlayers(state.players)
  const currentPlayer = players[state.currentPlayerId]
  currentPlayer.hand = sortHand([...currentPlayer.hand, draw])

  let nextState: GameState = {
    ...state,
    players,
    wall,
    currentDrawnTile: draw,
    phase: 'discard',
    currentPrompt: null,
    claimQueue: [],
  }

  nextState = addLog(nextState, `${currentPlayer.name} drew ${tileLabel(draw)}.`)

  if (canWinWithStandardHand(currentPlayer.hand)) {
    nextState.currentPrompt = {
      playerId: currentPlayer.id,
      sourcePlayerId: currentPlayer.id,
      tile: draw,
      actions: ['win', 'pass'],
    }
  } else {
    const kongTile = canDeclareConcealedKong(currentPlayer.hand)
    if (kongTile) {
      nextState.currentPrompt = {
        playerId: currentPlayer.id,
        sourcePlayerId: currentPlayer.id,
        tile: kongTile,
        actions: ['kong', 'pass'],
      }
    }
  }

  return nextState
}

export const declareSelfDrawWin = (state: GameState): GameState => {
  if (!state.currentPrompt || state.currentPrompt.playerId !== state.currentPlayerId) {
    return state
  }

  if (!state.currentPrompt.actions.includes('win')) {
    return state
  }

  return {
    ...state,
    phase: 'roundOver',
    winner: {
      winnerId: state.currentPlayerId,
      source: 'self-draw',
      winningTile: state.currentPrompt.tile,
    },
    claimQueue: [],
    log: [`${state.players[state.currentPlayerId].name} wins by self-draw!`, ...state.log],
  }
}

export const declareConcealedKong = (state: GameState): GameState => {
  if (!state.currentPrompt || !state.currentPrompt.actions.includes('kong')) {
    return state
  }

  const targetPlayerId = state.currentPrompt.playerId
  const tile = state.currentPrompt.tile
  const code = tileCode(tile)
  const players = clonePlayers(state.players)
  const player = players[targetPlayerId]

  player.hand = removeTilesByCode(player.hand, code, 4)
  const kongTiles = state.players[targetPlayerId].hand
    .filter((candidate) => tileCode(candidate) === code)
    .slice(0, 4)
    .map(cloneTile)

  const meld: Meld = {
    type: 'kong',
    tiles: kongTiles,
    fromPlayer: targetPlayerId,
  }
  player.melds = [...player.melds, meld]

  return addLog(
    {
      ...state,
      players,
      phase: 'draw',
      currentDrawnTile: null,
      currentPrompt: null,
      claimQueue: [],
    },
    `${player.name} declared concealed kong (${tileLabel(tile)}).`,
  )
}

const buildDiscardClaimQueue = (
  state: GameState,
  discardedTile: Tile,
  discarderId: PlayerId,
): PendingPrompt[] => {
  const candidates: PendingPrompt[] = []

  for (const player of state.players) {
    if (player.id === discarderId) {
      continue
    }

    const isNext = playerOrderDistance(discarderId, player.id) === 1
    const meldOptions = findDiscardClaimOptions(player.hand, discardedTile, isNext)

    const actions: PendingPromptAction[] = []
    if (canWinWithStandardHand([...player.hand, discardedTile])) {
      actions.push('win')
    }

    if (meldOptions.includes('kong')) {
      actions.push('kong')
    }
    if (meldOptions.includes('pong')) {
      actions.push('pong')
    }
    if (meldOptions.includes('chow')) {
      actions.push('chow')
    }

    if (actions.length === 0) {
      continue
    }

    actions.push('pass')

    candidates.push({
      playerId: player.id,
      sourcePlayerId: discarderId,
      tile: discardedTile,
      actions,
    })
  }

  candidates.sort((a, b) => {
    const scoreDiff = bestActionRank(b) - bestActionRank(a)
    if (scoreDiff !== 0) {
      return scoreDiff
    }

    const distA = playerOrderDistance(discarderId, a.playerId)
    const distB = playerOrderDistance(discarderId, b.playerId)
    return distA - distB
  })

  return candidates
}

export const discardTile = (state: GameState, tileId: string): GameState => {
  if (state.phase !== 'discard' || state.winner) {
    return state
  }

  const players = clonePlayers(state.players)
  const currentPlayer = players[state.currentPlayerId]
  const tile = currentPlayer.hand.find((candidate) => candidate.id === tileId)

  if (!tile) {
    return state
  }

  currentPlayer.hand = sortHand(
    currentPlayer.hand.filter((candidate) => candidate.id !== tileId),
  )
  currentPlayer.discards = [...currentPlayer.discards, tile]

  const claimQueue = buildDiscardClaimQueue(state, tile, state.currentPlayerId)
  const prompt = claimQueue[0] ?? null

  let nextState: GameState = {
    ...state,
    players,
    lastDiscard: {
      tile,
      playerId: state.currentPlayerId,
    },
    currentDrawnTile: null,
    currentPrompt: prompt,
    claimQueue: prompt ? claimQueue.slice(1) : [],
    phase: prompt ? 'claimPrompt' : 'draw',
    currentPlayerId: prompt ? prompt.playerId : nextPlayerId(state.currentPlayerId),
    turnNumber: state.turnNumber + 1,
  }

  nextState = addLog(nextState, `${currentPlayer.name} discarded ${tileLabel(tile)}.`)

  if (prompt) {
    const topAction = prompt.actions.reduce<PendingPromptAction>(
      (best, current) =>
        claimPriorityScore(current) > claimPriorityScore(best) ? current : best,
      'pass',
    )

    nextState = addLog(
      nextState,
      `${state.players[prompt.playerId].name} may claim (${topAction.toUpperCase()}) on ${tileLabel(tile)}.`,
    )
  }

  return nextState
}

const claimTilesForMeld = (
  hand: Tile[],
  discardedTile: Tile,
  type: 'pong' | 'kong' | 'chow',
): { tiles: Tile[]; nextHand: Tile[] } => {
  if (type === 'pong' || type === 'kong') {
    const neededCount = type === 'pong' ? 2 : 3
    const code = tileCode(discardedTile)
    const taken = hand.filter((tile) => tileCode(tile) === code).slice(0, neededCount)
    return {
      tiles: [...taken, discardedTile],
      nextHand: removeTilesByCode(hand, code, neededCount),
    }
  }

  const [pattern] = findChowPatterns(hand, discardedTile, true)
  if (pattern) {
    const [ta, tb] = pattern
    const remaining = hand.filter((tile) => tile.id !== ta.id && tile.id !== tb.id)
    return {
      tiles: [ta, discardedTile, tb],
      nextHand: remaining,
    }
  }

  return {
    tiles: [discardedTile],
    nextHand: hand,
  }
}

export const resolveClaim = (
  state: GameState,
  action: 'win' | 'pong' | 'kong' | 'chow' | 'pass',
): GameState => {
  if (state.phase !== 'claimPrompt' || !state.currentPrompt || !state.lastDiscard) {
    return state
  }

  const prompt = state.currentPrompt
  const claimerId = prompt.playerId
  const sourcePlayerId = prompt.sourcePlayerId
  const discardedTile = state.lastDiscard.tile

  if (!prompt.actions.includes(action)) {
    return state
  }

  if (action === 'pass') {
    if (state.claimQueue.length > 0) {
      const [nextPrompt, ...restQueue] = state.claimQueue

      return addLog(
        {
          ...state,
          currentPrompt: nextPrompt,
          claimQueue: restQueue,
          currentPlayerId: nextPrompt.playerId,
        },
        `${state.players[claimerId].name} passed on ${tileLabel(discardedTile)}.`,
      )
    }

    return addLog(
      {
        ...state,
        currentPrompt: null,
        claimQueue: [],
        phase: 'draw',
        currentPlayerId: nextPlayerId(sourcePlayerId),
      },
      `${state.players[claimerId].name} passed on ${tileLabel(discardedTile)}.`,
    )
  }

  if (action === 'win') {
    return {
      ...state,
      phase: 'roundOver',
      winner: {
        winnerId: claimerId,
        source: 'discard',
        winningTile: discardedTile,
        sourcePlayerId,
      },
      currentPrompt: null,
      claimQueue: [],
      log: [
        `${state.players[claimerId].name} won on discard from ${state.players[sourcePlayerId].name}!`,
        ...state.log,
      ],
    }
  }

  const players = clonePlayers(state.players)
  const claimer = players[claimerId]
  const claimed = claimTilesForMeld(claimer.hand, discardedTile, action)
  claimer.hand = sortHand(claimed.nextHand)

  const meld: Meld = {
    type: action,
    tiles: claimed.tiles,
    fromPlayer: sourcePlayerId,
  }
  claimer.melds = [...claimer.melds, meld]

  return addLog(
    {
      ...state,
      players,
      currentPrompt: null,
      claimQueue: [],
      currentPlayerId: claimerId,
      phase: action === 'kong' ? 'draw' : 'discard',
      currentDrawnTile: null,
    },
    `${claimer.name} claimed ${action.toUpperCase()} on ${tileLabel(discardedTile)}.`,
  )
}

export const restartGame = (): GameState => createInitialGameState()
