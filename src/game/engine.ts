import {
  canDeclareConcealedKong,
  claimPriorityScore,
  findChowPatterns,
  findDiscardClaimOptions,
  isJiaHuTile,
  meetsHarbinBasicHu,
  playerOrderDistance,
} from './rules'
import { actionLabel, playerName, seatWindLabel } from './i18n'
import { cloneTile, createWall, shuffle, sortHand, tileCode, tileLabel } from './tiles'
import { buildSettlement } from './scoring'
import type {
  GameState,
  HarbinRuleAssumptions,
  Meld,
  PendingPrompt,
  PendingPromptAction,
  PlayerId,
  PlayerState,
  Tile,
  WinInfo,
} from './types'

const PLAYER_NAMES = ['你', '左家', '对家', '右家']
const WINDS: PlayerState['seatWind'][] = ['East', 'South', 'West', 'North']

export const DEFAULT_ASSUMPTIONS: HarbinRuleAssumptions = {
  winStructure: 'harbin-open-hand',
  chowRestriction: 'only-next-player-on-discard',
  claimPriority: ['win', 'ting', 'kong', 'pong', 'chow'],
  flowersUsed: false,
  scoringModel: 'harbin-a-single-hidden-bao',
  handSize: 13,
  wallTileCount: 112,
  baoCount: 1,
  requiresOpenBeforeTing: true,
  requiresYaoJiu: true,
  requiresSequence: true,
  requiresTriplet: true,
  forbidsPureOneSuit: true,
  forbidsSevenPairs: true,
  forbidsShouBaYi: true,
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
    ting: false,
    opened: false,
  }))

const nextPlayerId = (id: PlayerId): PlayerId => (((id + 1) % 4) as PlayerId)

const clonePlayers = (players: PlayerState[]): PlayerState[] =>
  players.map((player) => ({
    ...player,
    hand: [...player.hand],
    melds: player.melds.map((meld) => ({ ...meld, tiles: [...meld.tiles] })),
    discards: [...player.discards],
  }))

const addLog = (state: GameState, entry: string): GameState => ({
  ...state,
  log: [`第${state.turnNumber}手：${entry}`, ...state.log].slice(0, 80),
})

const bestActionRank = (prompt: PendingPrompt): number => {
  const topAction = prompt.actions.reduce<PendingPromptAction>(
    (best, current) => (claimPriorityScore(current) > claimPriorityScore(best) ? current : best),
    'pass',
  )
  return claimPriorityScore(topAction)
}

const resolveNextDealer = (prev: GameState): PlayerId => {
  if (prev.roundNumber === 0) return prev.dealerId
  if (prev.winner?.winnerId === prev.dealerId) return prev.dealerId
  return nextPlayerId(prev.dealerId)
}

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

const settleWin = (state: GameState, winInfo: WinInfo, logText: string): GameState => {
  const settlement = buildSettlement(state, winInfo)
  const scores = [...state.scores]
  settlement.deltas.forEach((item) => {
    scores[item.playerId] += item.delta
  })

  return {
    ...state,
    phase: 'roundOver',
    winner: winInfo,
    roundSettlement: settlement,
    scores,
    currentPrompt: null,
    claimQueue: [],
    log: [logText, ...state.log],
  }
}

const buildDiscardClaimQueue = (state: GameState, discardedTile: Tile, discarderId: PlayerId): PendingPrompt[] => {
  const candidates: PendingPrompt[] = []

  for (const player of state.players) {
    if (player.id === discarderId) continue

    const isNext = playerOrderDistance(discarderId, player.id) === 1
    const meldOptions = findDiscardClaimOptions(player.hand, discardedTile, isNext)
    const actions: PendingPromptAction[] = []

    if (player.ting && meetsHarbinBasicHu([...player.hand, discardedTile], player.opened)) {
      actions.push('win')
    }

    if (!player.ting && player.opened && meetsHarbinBasicHu([...player.hand, discardedTile], true)) {
      actions.push('ting')
      actions.push('win')
    }

    if (!player.ting) {
      if (meldOptions.includes('kong')) actions.push('kong')
      if (meldOptions.includes('pong')) actions.push('pong')
      if (meldOptions.includes('chow')) actions.push('chow')
    }

    if (actions.length === 0) continue
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
    if (scoreDiff !== 0) return scoreDiff
    return playerOrderDistance(discarderId, a.playerId) - playerOrderDistance(discarderId, b.playerId)
  })

  return candidates
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
  roundSettlement: null,
  scores: [0, 0, 0, 0],
  assumptions: DEFAULT_ASSUMPTIONS,
  hiddenBaoTile: null,
})

export const restartGame = (): GameState => createInitialGameState()

export const startRound = (prev: GameState): GameState => {
  const wall = shuffle(createWall())
  const hiddenBaoTile = wall.pop() ?? null
  const players = makePlayers()
  const nextDealerId = resolveNextDealer(prev)

  for (let pass = 0; pass < DEFAULT_ASSUMPTIONS.handSize; pass += 1) {
    for (let pid = 0; pid < players.length; pid += 1) {
      const tile = wall.pop()
      if (!tile) throw new Error('Wall exhausted while dealing')
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
    roundSettlement: null,
    assumptions: DEFAULT_ASSUMPTIONS,
    hiddenBaoTile,
    log: [
      `第 ${roundNumber} 局开始，${playerName(nextDealerId)}坐庄（${seatWindLabel(players[nextDealerId].seatWind)}位）。`,
      '本局采用 A 版规则：只有一张暗宝，必须开门后报听，听牌后才能胡。',
    ],
  }
}

export const drawTile = (state: GameState): GameState => {
  if (state.phase !== 'draw' || state.winner) return state

  const wall = [...state.wall]
  const draw = wall.pop()
  if (!draw) {
    return {
      ...state,
      wall,
      phase: 'roundOver',
      winner: null,
      roundSettlement: null,
      currentPrompt: null,
      claimQueue: [],
      log: ['本局流局（牌墙已摸完）。', ...state.log],
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
    currentPrompt: null,
    claimQueue: [],
    phase: 'discard',
  }

  nextState = addLog(nextState, `${currentPlayer.name}摸到 ${tileLabel(draw)}。`)

  if (currentPlayer.ting && meetsHarbinBasicHu(currentPlayer.hand, currentPlayer.opened)) {
    nextState.currentPrompt = {
      playerId: currentPlayer.id,
      sourcePlayerId: currentPlayer.id,
      tile: draw,
      actions: ['win', 'pass'],
    }
    return nextState
  }

  if (!currentPlayer.ting && currentPlayer.opened && meetsHarbinBasicHu(currentPlayer.hand, true)) {
    nextState.currentPrompt = {
      playerId: currentPlayer.id,
      sourcePlayerId: currentPlayer.id,
      tile: draw,
      actions: ['ting', 'pass'],
    }
    return nextState
  }

  if (!currentPlayer.ting) {
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
  if (!state.currentPrompt || state.currentPrompt.playerId !== state.currentPlayerId) return state
  if (!state.currentPrompt.actions.includes('win')) return state

  const currentPlayer = state.players[state.currentPlayerId]
  const winningTile = state.currentPrompt.tile
  const usedBao = state.hiddenBaoTile ? tileCode(winningTile) === tileCode(state.hiddenBaoTile) : false
  const winType = usedBao && state.currentDrawnTile && tileCode(state.currentDrawnTile) === tileCode(winningTile)
    ? 'bao-zhong-bao'
    : usedBao
      ? 'touch-bao'
      : 'self-draw'

  return settleWin(
    state,
    {
      winnerId: state.currentPlayerId,
      source: 'self-draw',
      winningTile,
      winType,
      isJiaHu: isJiaHuTile(currentPlayer.hand, winningTile),
      usedBao,
    },
    `${currentPlayer.name}${usedBao ? '摸到暗宝自摸胡牌！' : '自摸胡牌！'}`,
  )
}

export const declareConcealedKong = (state: GameState): GameState => {
  if (!state.currentPrompt || !state.currentPrompt.actions.includes('kong')) return state

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
    concealed: true,
  }
  player.melds = [...player.melds, meld]
  player.opened = true

  return addLog(
    {
      ...state,
      players,
      phase: 'draw',
      currentDrawnTile: null,
      currentPrompt: null,
      claimQueue: [],
    },
    `${player.name}暗杠 ${tileLabel(tile)}。`,
  )
}

export const discardTile = (state: GameState, tileId: string): GameState => {
  if (state.phase !== 'discard' || state.winner) return state

  const players = clonePlayers(state.players)
  const currentPlayer = players[state.currentPlayerId]
  const tile = currentPlayer.hand.find((candidate) => candidate.id === tileId)
  if (!tile) return state

  currentPlayer.hand = sortHand(currentPlayer.hand.filter((candidate) => candidate.id !== tile.id))
  currentPlayer.discards = [...currentPlayer.discards, tile]

  const claimQueue = buildDiscardClaimQueue({ ...state, players }, tile, state.currentPlayerId)
  const [prompt, ...restQueue] = claimQueue

  let nextState: GameState = {
    ...state,
    players,
    lastDiscard: { tile, playerId: state.currentPlayerId },
    currentDrawnTile: null,
    currentPrompt: prompt ?? null,
    claimQueue: prompt ? restQueue : [],
    phase: prompt ? 'claimPrompt' : 'draw',
    currentPlayerId: prompt ? prompt.playerId : nextPlayerId(state.currentPlayerId),
    turnNumber: state.turnNumber + 1,
  }

  nextState = addLog(nextState, `${currentPlayer.name}打出 ${tileLabel(tile)}。`)
  if (prompt) {
    const topAction = prompt.actions.reduce<PendingPromptAction>(
      (best, current) => (claimPriorityScore(current) > claimPriorityScore(best) ? current : best),
      'pass',
    )
    nextState = addLog(nextState, `${state.players[prompt.playerId].name}可对 ${tileLabel(tile)} 执行${actionLabel(topAction)}。`)
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
  if (!pattern) {
    return { tiles: [discardedTile], nextHand: hand }
  }
  const [ta, tb] = pattern
  return {
    tiles: [ta, discardedTile, tb],
    nextHand: hand.filter((tile) => tile.id !== ta.id && tile.id !== tb.id),
  }
}

export const resolveClaim = (
  state: GameState,
  action: 'win' | 'pong' | 'kong' | 'chow' | 'ting' | 'pass',
): GameState => {
  if (state.phase !== 'claimPrompt' || !state.currentPrompt || !state.lastDiscard) return state

  const prompt = state.currentPrompt
  const claimerId = prompt.playerId
  const sourcePlayerId = prompt.sourcePlayerId
  const discardedTile = state.lastDiscard.tile

  if (!prompt.actions.includes(action)) return state

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
        `${state.players[claimerId].name}选择过 ${tileLabel(discardedTile)}。`,
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
      `${state.players[claimerId].name}选择过 ${tileLabel(discardedTile)}。`,
    )
  }

  if (action === 'win') {
    return settleWin(
      state,
      {
        winnerId: claimerId,
        source: 'discard',
        sourcePlayerId,
        winningTile: discardedTile,
        winType: 'pinghu',
        isJiaHu: isJiaHuTile([...state.players[claimerId].hand, discardedTile], discardedTile),
        usedBao: state.hiddenBaoTile ? tileCode(discardedTile) === tileCode(state.hiddenBaoTile) : false,
      },
      `${state.players[claimerId].name}接 ${state.players[sourcePlayerId].name} 的弃牌胡牌！`,
    )
  }

  if (action === 'ting') {
    const players = clonePlayers(state.players)
    const claimer = players[claimerId]
    claimer.hand = sortHand([...claimer.hand, discardedTile])
    claimer.ting = true
    claimer.opened = true
    return addLog(
      {
        ...state,
        players,
        currentPrompt: null,
        claimQueue: [],
        currentPlayerId: claimerId,
        phase: 'discard',
      },
      `${claimer.name}报听 ${tileLabel(discardedTile)}。`,
    )
  }

  const players = clonePlayers(state.players)
  const claimer = players[claimerId]
  const claimed = claimTilesForMeld(claimer.hand, discardedTile, action)
  claimer.hand = sortHand(claimed.nextHand)
  claimer.melds = [
    ...claimer.melds,
    {
      type: action,
      tiles: claimed.tiles,
      fromPlayer: sourcePlayerId,
      concealed: false,
    },
  ]
  claimer.opened = true

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
    `${claimer.name}${actionLabel(action)}了 ${tileLabel(discardedTile)}。`,
  )
}
