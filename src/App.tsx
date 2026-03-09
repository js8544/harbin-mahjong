import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { chooseDiscard, shouldClaim } from './game/ai'
import {
  createInitialGameState,
  declareConcealedKong,
  declareSelfDrawWin,
  discardTile,
  drawTile,
  resolveClaim,
  restartGame,
  startRound,
} from './game/engine'
import { tileLabel, tileVisual } from './game/tiles'
import type { PendingPromptAction, Tile } from './game/types'

const AI_DELAY_MS = 450

function App() {
  const [game, setGame] = useState(() => createInitialGameState())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)

  const currentPlayer = game.players[game.currentPlayerId]
  const human = game.players[0]
  const humanPrompt =
    game.currentPrompt && game.currentPrompt.playerId === human.id ? game.currentPrompt : null

  const waitingTiles = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tile of human.hand) {
      const key = `${tile.suit}-${tile.rank}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([code]) => code)
  }, [human.hand])

  const selectedTile = useMemo(
    () => human.hand.find((tile) => tile.id === selectedTileId) ?? null,
    [human.hand, selectedTileId],
  )

  const statusText = useMemo(() => {
    if (game.phase === 'notStarted') return 'Ready. Start a round to deal 13 tiles each.'
    if (game.winner) {
      const winner = game.players[game.winner.winnerId]
      const sourceText =
        game.winner.source === 'self-draw'
          ? 'by self-draw'
          : `on discard from ${game.players[game.winner.sourcePlayerId ?? 0].name}`
      return `${winner.name} won ${sourceText}.`
    }
    if (game.phase === 'roundOver') return 'Round ended in draw. Start next round.'
    return `${currentPlayer.name} to act (${game.phase}).`
  }, [game, currentPlayer])

  const nextStepHint = useMemo(() => {
    if (game.phase === 'notStarted') return 'Press Start Round.'
    if (game.winner || game.phase === 'roundOver') return 'Press Start Next Round to continue.'
    if (humanPrompt) return game.phase === 'claimPrompt' ? 'Respond to the discard claim prompt.' : 'Choose WIN / KONG / PASS.'
    if (game.phase === 'draw' && currentPlayer.id === human.id) return 'Press Draw Tile.'
    if (game.phase === 'discard' && currentPlayer.id === human.id) return 'Select a tile, then discard it.'
    return 'AI is deciding.'
  }, [game, currentPlayer, human.id, humanPrompt])

  const doStartRound = () => {
    setSelectedTileId(null)
    setGame((prev) => startRound(prev))
  }

  const doRestart = () => {
    setSelectedTileId(null)
    setGame(restartGame())
  }

  const doDraw = () => setGame((prev) => drawTile(prev))
  const doDiscard = (tileId: string) => {
    setSelectedTileId(null)
    setGame((prev) => discardTile(prev, tileId))
  }

  const doResolvePrompt = (action: PendingPromptAction) => {
    if (game.phase === 'claimPrompt') {
      setGame((prev) => resolveClaim(prev, action))
      return
    }
    if (action === 'win') {
      setGame((prev) => declareSelfDrawWin(prev))
      return
    }
    if (action === 'kong') {
      setGame((prev) => declareConcealedKong(prev))
      return
    }
    if (action === 'pass') {
      setGame((prev) => ({ ...prev, currentPrompt: null }))
    }
  }

  useEffect(() => {
    if (game.phase === 'notStarted' || game.phase === 'roundOver' || game.winner) return
    if (currentPlayer.isHuman) return

    const timer = window.setTimeout(() => {
      if (game.phase === 'draw') {
        setGame((prev) => drawTile(prev))
        return
      }

      if (game.phase === 'discard') {
        if (game.currentPrompt?.playerId === currentPlayer.id) {
          if (game.currentPrompt.actions.includes('win')) {
            setGame((prev) => declareSelfDrawWin(prev))
            return
          }
          if (game.currentPrompt.actions.includes('kong')) {
            setGame((prev) => declareConcealedKong(prev))
            return
          }
        }
        const tile = chooseDiscard(currentPlayer.hand)
        setGame((prev) => discardTile(prev, tile.id))
        return
      }

      if (game.phase === 'claimPrompt' && game.currentPrompt) {
        const { actions, tile } = game.currentPrompt
        const ordered: PendingPromptAction[] = ['win', 'kong', 'pong', 'chow', 'pass']
        for (const action of ordered) {
          if (!actions.includes(action)) continue
          if (action === 'pass') {
            setGame((prev) => resolveClaim(prev, 'pass'))
            return
          }
          if (shouldClaim(action, currentPlayer.hand, tile)) {
            setGame((prev) => resolveClaim(prev, action))
            return
          }
        }
      }
    }, AI_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [game, currentPlayer])

  const canHumanDraw = game.phase === 'draw' && currentPlayer.id === human.id && !game.winner
  const humanTurnToDiscard = game.phase === 'discard' && currentPlayer.id === human.id
  const selectedTileLabel = selectedTile ? tileLabel(selectedTile) : 'None'

  const renderMiniHand = (tiles: Tile[]) => (
    <div className="discard-row compact">
      {tiles.map((tile) => (
        <span key={`mini-${tile.id}`} className="discard-pill" title={tileLabel(tile)}>
          {tileVisual(tile)}
        </span>
      ))}
    </div>
  )

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Harbin Mahjong</h1>
          <p className="subtitle">Single-player table vs 3 AI opponents</p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={doStartRound}>
            {game.phase === 'notStarted' ? 'Start Round' : 'Start Next Round'}
          </button>
          <button onClick={doRestart}>Restart Session</button>
        </div>
      </header>

      <section className="status-bar">
        <div><strong>Status:</strong> {statusText}</div>
        <div><strong>Hint:</strong> {nextStepHint}</div>
        <div><strong>Round:</strong> {game.roundNumber}</div>
        <div><strong>Turn:</strong> {game.turnNumber}</div>
        <div><strong>Dealer:</strong> {game.players[game.dealerId].name}</div>
        <div><strong>Wall:</strong> {game.wall.length} / 136</div>
        <div><strong>Selected:</strong> {selectedTileLabel}</div>
        <div><strong>Likely pairs:</strong> {waitingTiles.length}</div>
        <div><strong>Total score:</strong> You {game.scores[0]} / AI East {game.scores[1]} / AI South {game.scores[2]} / AI West {game.scores[3]}</div>
      </section>

      <main className="table-grid">
        <section className="players-panel">
          {game.players.map((player) => (
            <article key={player.id} className={`player-card ${player.id === game.currentPlayerId ? 'active' : ''}`}>
              <div className="player-header">
                <h3>{player.name}</h3>
                <span>{player.seatWind}</span>
              </div>
              <p>Hand: {player.hand.length} tiles</p>
              <p>Melds: {player.melds.length}</p>
              <p>Discards: {player.discards.length}</p>
              <p>Score: {game.scores[player.id]}</p>
              <div className="meld-row">
                {player.melds.map((meld, idx) => (
                  <span key={`${player.id}-meld-${idx}`} className="meld-pill">
                    {meld.type.toUpperCase()} {meld.tiles.map((tile) => tileVisual(tile)).join(' ')}
                  </span>
                ))}
              </div>
              {player.discards.length > 0 && renderMiniHand(player.discards.slice(-10))}
            </article>
          ))}
        </section>

        <section className="center-panel">
          <div className="panel action-panel">
            <h2>Action Area</h2>
            {canHumanDraw && <button className="primary" onClick={doDraw}>Draw Tile</button>}
            {humanPrompt && (
              <div className="prompt-box">
                <p>Action required on <strong>{tileLabel(humanPrompt.tile)}</strong></p>
                <div className="prompt-actions">
                  {humanPrompt.actions.map((action) => (
                    <button key={action} onClick={() => doResolvePrompt(action)}>{action.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            )}
            {humanTurnToDiscard && selectedTile && (
              <div className="prompt-box">
                <p>Selected: <strong>{tileLabel(selectedTile)}</strong></p>
                <div className="prompt-actions">
                  <button className="primary" onClick={() => doDiscard(selectedTile.id)}>Discard Selected Tile</button>
                  <button onClick={() => setSelectedTileId(null)}>Clear Selection</button>
                </div>
              </div>
            )}
            {game.phase === 'claimPrompt' && !humanPrompt && <p className="passive-note">Waiting for AI claim resolution.</p>}
          </div>

          <div className="panel">
            <h2>Table Feed</h2>
            {game.lastDiscard ? (
              <p>Last discard: {game.players[game.lastDiscard.playerId].name} - {tileLabel(game.lastDiscard.tile)}</p>
            ) : (
              <p>No discard yet.</p>
            )}
            {game.currentPrompt && (
              <p>Pending prompt: {game.players[game.currentPrompt.playerId].name} on {tileLabel(game.currentPrompt.tile)}</p>
            )}
            {game.roundSettlement && (
              <div className="prompt-box">
                <p><strong>Round settlement</strong>: {game.roundSettlement.summary}</p>
                <ul>
                  {game.roundSettlement.breakdown.map((item) => (
                    <li key={item.label}>{item.label}: +{item.points}</li>
                  ))}
                </ul>
                <p>
                  {game.roundSettlement.deltas.map((item) => `${game.players[item.playerId].name} ${item.delta >= 0 ? '+' : ''}${item.delta}`).join(' | ')}
                </p>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Game Log</h2>
            <div className="log-list">
              {game.log.length === 0 && <p>No events yet.</p>}
              {game.log.map((entry, idx) => <p key={`log-${idx}`}>{entry}</p>)}
            </div>
          </div>
        </section>

        <section className="hand-panel">
          <h2>Your Hand</h2>
          <div className="tile-grid">
            {human.hand.map((tile) => (
              <button
                key={tile.id}
                className={`tile-button ${selectedTileId === tile.id ? 'selected' : ''}`}
                type="button"
                disabled={!humanTurnToDiscard}
                onClick={() => setSelectedTileId(tile.id)}
                title={tileLabel(tile)}
              >
                <span>{tileVisual(tile)}</span>
              </button>
            ))}
          </div>

          <div className="panel">
            <h3>Quick reading</h3>
            <p>Pairs in hand: {waitingTiles.length > 0 ? waitingTiles.join(', ') : 'none'}</p>
            <p>Current model: simplified Harbin-style local table with round settlement.</p>
          </div>
        </section>
      </main>

      <section className="assumptions">
        <h3>Current rule assumptions</h3>
        <ul>
          <li>Standard hand: 4 melds + 1 pair, plus seven-pairs support for settlement.</li>
          <li>Chow only from the next player; claim priority is win &gt; kong &gt; pong &gt; chow.</li>
          <li>Simplified round settlement: base win, self-draw, dealer, seven pairs, pure one suit, and pung/kong-heavy bonus.</li>
          <li>No flowers and no full Harbin local fan-counting yet.</li>
        </ul>
      </section>
    </div>
  )
}

export default App
