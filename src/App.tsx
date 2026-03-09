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

const AI_DELAY_MS = 550

function App() {
  const [game, setGame] = useState(() => createInitialGameState())

  const currentPlayer = game.players[game.currentPlayerId]
  const human = game.players[0]

  const statusText = useMemo(() => {
    if (game.phase === 'notStarted') {
      return 'Ready to start a Harbin Mahjong round.'
    }
    if (game.winner) {
      const winner = game.players[game.winner.winnerId]
      return `${winner.name} won by ${game.winner.source}.`
    }
    if (game.phase === 'roundOver') {
      return 'Round ended in draw.'
    }
    return `${currentPlayer.name} to act (${game.phase}).`
  }, [game, currentPlayer])

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

  const canHumanDraw =
    game.phase === 'draw' &&
    currentPlayer.id === human.id &&
    !game.winner

  const humanTurnToDiscard = game.phase === 'discard' && currentPlayer.id === human.id
  const humanPrompt =
    game.currentPrompt && game.currentPrompt.playerId === human.id ? game.currentPrompt : null

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Harbin Mahjong</h1>
          <p className="subtitle">Local single-player table with 3 AI opponents</p>
        </div>
        <div className="header-actions">
          <button className="primary" onClick={doStartRound}>
            {game.phase === 'notStarted' ? 'Start Game' : 'Start New Round'}
          </button>
          <button onClick={doRestart}>Restart Session</button>
        </div>
      </header>

      <section className="status-bar">
        <div>
          <strong>Status:</strong> {statusText}
        </div>
        <div>
          <strong>Round:</strong> {game.roundNumber}
        </div>
        <div>
          <strong>Turn:</strong> {game.turnNumber}
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
              <p>Hand: {player.isHuman ? player.hand.length : `${player.hand.length} tiles`}</p>
              <p>Melds: {player.melds.length}</p>
              <p>Discards: {player.discards.length}</p>
              <div className="meld-row">
                {player.melds.map((meld, idx) => (
                  <span key={`${player.id}-meld-${idx}`} className="meld-pill">
                    {meld.type.toUpperCase()}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="center-panel">
          <div className="panel">
            <h2>Action Area</h2>
            {canHumanDraw && (
              <button className="primary" onClick={doDraw}>
                Draw Tile
              </button>
            )}

            {humanPrompt && (
              <div className="prompt-box">
                <p>
                  Prompt: claim <strong>{tileLabel(humanPrompt.tile)}</strong>
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

            {humanTurnToDiscard && <p>Select a tile in your hand to discard.</p>}
          </div>

          <div className="panel">
            <h2>Last Discard</h2>
            {game.lastDiscard ? (
              <p>
                {game.players[game.lastDiscard.playerId].name}: {tileLabel(game.lastDiscard.tile)}
              </p>
            ) : (
              <p>None</p>
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
        <h3>Rule Assumptions</h3>
        <ul>
          <li>Win structure: 4 melds + 1 pair</li>
          <li>No flower tiles</li>
          <li>Chow only from next player's discard</li>
          <li>Claim priority: Win &gt; Kong &gt; Pong &gt; Chow</li>
          <li>Simplified result model (win/draw, no fan scoring table)</li>
        </ul>
      </footer>
    </div>
  )
}

export default App
