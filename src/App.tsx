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
import type { PendingPromptAction } from './game/types'

const AI_DELAY_MS = 500

function App() {
  const [game, setGame] = useState(() => createInitialGameState())

  const currentPlayer = game.players[game.currentPlayerId]
  const human = game.players[0]

  const statusText = useMemo(() => {
    if (game.phase === 'notStarted') {
      return 'Ready. Start a round to deal 13 tiles each.'
    }

    if (game.winner) {
      const winner = game.players[game.winner.winnerId]
      const sourceText =
        game.winner.source === 'self-draw'
          ? 'by self-draw'
          : `on discard from ${game.players[game.winner.sourcePlayerId ?? 0].name}`
      return `${winner.name} won ${sourceText}.`
    }

    if (game.phase === 'roundOver') {
      return 'Round ended in draw. Start next round to continue.'
    }

    return `${currentPlayer.name} to act (${game.phase}).`
  }, [game, currentPlayer])

  const nextStepHint = useMemo(() => {
    if (game.phase === 'notStarted') {
      return 'Press Start Round.'
    }

    if (game.winner || game.phase === 'roundOver') {
      return 'Press Start Next Round to continue table rotation.'
    }

    if (game.currentPrompt?.playerId === human.id) {
      if (game.phase === 'claimPrompt') {
        return 'Respond to the discard claim prompt.'
      }

      return 'Choose WIN/KONG/PASS for your draw prompt.'
    }

    if (game.phase === 'draw' && currentPlayer.id === human.id) {
      return 'Press Draw Tile.'
    }

    if (game.phase === 'discard' && currentPlayer.id === human.id) {
      return 'Select one tile from your hand to discard.'
    }

    return 'AI is deciding.'
  }, [game, currentPlayer, human.id])

  const doStartRound = () => {
    setGame((prev) => startRound(prev))
  }

  const doRestart = () => {
    setGame(restartGame())
  }

  const doDraw = () => {
    setGame((prev) => drawTile(prev))
  }

  const doDiscard = (tileId: string) => {
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
    if (game.phase === 'notStarted' || game.phase === 'roundOver' || game.winner) {
      return
    }

    if (currentPlayer.isHuman) {
      return
    }

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
          if (!actions.includes(action)) {
            continue
          }

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
  const humanPrompt =
    game.currentPrompt && game.currentPrompt.playerId === human.id ? game.currentPrompt : null

  const mainCtaLabel = game.phase === 'notStarted' ? 'Start Round' : 'Start Next Round'

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Harbin Mahjong</h1>
          <p className="subtitle">Single-player table vs 3 AI opponents</p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={doStartRound}>
            {mainCtaLabel}
          </button>
          <button onClick={doRestart}>Restart Session</button>
        </div>
      </header>

      <section className="status-bar">
        <div>
          <strong>Status:</strong> {statusText}
        </div>
        <div>
          <strong>Hint:</strong> {nextStepHint}
        </div>
        <div>
          <strong>Round:</strong> {game.roundNumber}
        </div>
        <div>
          <strong>Turn:</strong> {game.turnNumber}
        </div>
        <div>
          <strong>Dealer:</strong> {game.players[game.dealerId].name}
        </div>
        <div>
          <strong>Wall:</strong> {game.wall.length} / 136
        </div>
      </section>

      <main className="table-grid">
        <section className="players-panel">
          {game.players.map((player) => (
            <article
              key={player.id}
              className={`player-card ${player.id === game.currentPlayerId ? 'active' : ''}`}
            >
              <div className="player-header">
                <h3>{player.name}</h3>
                <span>{player.seatWind}</span>
              </div>
              <p>Hand: {player.hand.length} tiles</p>
              <p>Melds: {player.melds.length}</p>
              <p>Discards: {player.discards.length}</p>
              <div className="meld-row">
                {player.melds.map((meld, idx) => (
                  <span key={`${player.id}-meld-${idx}`} className="meld-pill">
                    {meld.type.toUpperCase()}
                  </span>
                ))}
              </div>
              {player.discards.length > 0 && (
                <div className="discard-row compact">
                  {player.discards.slice(-8).map((tile) => (
                    <span key={`pd-${tile.id}`} className="discard-pill" title={tileLabel(tile)}>
                      {tileVisual(tile)}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="center-panel">
          <div className="panel action-panel">
            <h2>Action Area</h2>
            {canHumanDraw && (
              <button className="primary" onClick={doDraw}>
                Draw Tile
              </button>
            )}

            {humanPrompt && (
              <div className="prompt-box">
                <p>
                  Action required on <strong>{tileLabel(humanPrompt.tile)}</strong>
                </p>
                <div className="prompt-actions">
                  {humanPrompt.actions.map((action) => (
                    <button key={action} onClick={() => doResolvePrompt(action)}>
                      {action.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {game.phase === 'claimPrompt' && !humanPrompt && (
              <p className="passive-note">Waiting for AI claim resolution.</p>
            )}

            {humanTurnToDiscard && <p>Select a tile in your hand to discard.</p>}
          </div>

          <div className="panel">
            <h2>Table Feed</h2>
            {game.lastDiscard ? (
              <p>
                Last discard: {game.players[game.lastDiscard.playerId].name} -{' '}
                {tileLabel(game.lastDiscard.tile)}
              </p>
            ) : (
              <p>No discard yet.</p>
            )}
            {game.currentPrompt && (
              <p>
                Pending prompt: {game.players[game.currentPrompt.playerId].name} on{' '}
                {tileLabel(game.currentPrompt.tile)}
              </p>
            )}
          </div>

          <div className="panel">
            <h2>Game Log</h2>
            <div className="log-list">
              {game.log.length === 0 && <p>No events yet.</p>}
              {game.log.map((entry, idx) => (
                <p key={`log-${idx}`}>{entry}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="hand-panel">
          <h2>Your Hand</h2>
          <div className="tile-grid">
            {human.hand.map((tile) => (
              <button
                key={tile.id}
                className="tile-button"
                type="button"
                disabled={!humanTurnToDiscard}
                onClick={() => doDiscard(tile.id)}
                title={tileLabel(tile)}
              >
                <span>{tileVisual(tile)}</span>
              </button>
            ))}
          </div>

          {human.discards.length > 0 && (
            <div>
              <h3>Your Discards</h3>
              <div className="discard-row">
                {human.discards.map((tile) => (
                  <span key={`d-${tile.id}`} className="discard-pill">
                    {tileVisual(tile)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="assumptions">
        <h3>Current Rule Model</h3>
        <ul>
          <li>Standard hand win: 4 melds + 1 pair</li>
          <li>No flower tiles; 136-tile wall</li>
          <li>Discard claims resolve in priority order: Win &gt; Kong &gt; Pong &gt; Chow</li>
          <li>Chow only from the next player</li>
          <li>Dealer keeps seat if dealer wins; otherwise seat rotates clockwise</li>
          <li>Simplified result model with no fan/point settlement table</li>
        </ul>
      </footer>
    </div>
  )
}

export default App
