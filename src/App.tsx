import { useEffect, useMemo, useState } from 'react'
/* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */
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
import { actionLabel, meldTypeLabel, seatWindLabel } from './game/i18n'
import { tileLabel, tileSuitBadge, tileVisual } from './game/tiles'
import type { PendingPromptAction, PlayerState } from './game/types'

const AI_DELAY_MS = 450

function App() {
  const [game, setGame] = useState(() => createInitialGameState())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [logExpanded, setLogExpanded] = useState(false)
  const [rulesExpanded, setRulesExpanded] = useState(false)

  const currentPlayer = game.players[game.currentPlayerId]
  const human = game.players[0]
  const topPlayer = game.players[2]
  const leftPlayer = game.players[1]
  const rightPlayer = game.players[3]
  const humanPrompt =
    game.currentPrompt && game.currentPrompt.playerId === human.id ? game.currentPrompt : null

  const selectedTile = useMemo(
    () => human.hand.find((tile) => tile.id === selectedTileId) ?? null,
    [human.hand, selectedTileId],
  )

  const selectedTileLabel = selectedTile ? tileLabel(selectedTile) : ''
  const canHumanDraw = game.phase === 'draw' && currentPlayer.id === human.id && !game.winner
  const humanTurnToDiscard = game.phase === 'discard' && currentPlayer.id === human.id

  const bannerText = useMemo(() => {
    if (game.phase === 'notStarted') return '准备开始新一局，点击“开始对局”即可发牌。'
    if (game.winner) {
      const winner = game.players[game.winner.winnerId]
      if (game.winner.source === 'self-draw') return `${winner.name} 自摸胡牌。`
      return `${winner.name} 接 ${game.players[game.winner.sourcePlayerId ?? 0].name} 的弃牌胡牌。`
    }
    if (game.phase === 'roundOver') return '本局流局，点击“下一局”继续。'
    if (humanPrompt?.actions.includes('win') && game.phase === 'claimPrompt') {
      return `你可以胡 ${tileLabel(humanPrompt.tile)}。`
    }
    if (humanPrompt?.actions.includes('kong') && game.phase === 'discard') {
      return `你可以选择杠 ${tileLabel(humanPrompt.tile)}，也可以直接出牌。`
    }
    if (humanPrompt && game.phase === 'claimPrompt') {
      return `你可以对 ${tileLabel(humanPrompt.tile)} 进行操作：${humanPrompt.actions
        .map((action) => actionLabel(action))
        .join(' / ')}。`
    }
    if (canHumanDraw) return '你的回合，请摸牌。'
    if (humanTurnToDiscard) return selectedTile ? `已选中 ${selectedTileLabel}，点击主按钮即可出牌。` : '请选择一张手牌后出牌。'
    if (game.phase === 'claimPrompt') return '其他玩家正在响应这张弃牌。'
    return `${currentPlayer.name} 回合，请稍候。`
  }, [game, currentPlayer, humanPrompt, canHumanDraw, humanTurnToDiscard, selectedTile, selectedTileLabel])

  const primaryAction = useMemo(() => {
    if (game.phase === 'notStarted') {
      return { label: '开始对局', disabled: false, onClick: () => doStartRound() }
    }
    if (game.winner || game.phase === 'roundOver') {
      return { label: '下一局', disabled: false, onClick: () => doStartRound() }
    }
    if (canHumanDraw) {
      return { label: '摸牌', disabled: false, onClick: () => doDraw() }
    }
    if (humanTurnToDiscard) {
      return {
        label: selectedTile ? `打出 ${selectedTileLabel}` : '请选择一张手牌',
        disabled: !selectedTile,
        onClick: () => selectedTile && doDiscard(selectedTile.id),
      }
    }
    return { label: '等待其他玩家', disabled: true, onClick: () => undefined }
  }, [game.phase, game.winner, canHumanDraw, humanTurnToDiscard, selectedTile, selectedTileLabel])

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
    if (selectedTileId && !human.hand.some((tile) => tile.id === selectedTileId)) {
      setSelectedTileId(null)
    }
  }, [human.hand, selectedTileId])

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
        const { actions } = game.currentPrompt
        const ordered: PendingPromptAction[] = ['win', 'kong', 'pong', 'chow', 'pass']
        for (const action of ordered) {
          if (!actions.includes(action)) continue
          if (action === 'pass') {
            setGame((prev) => resolveClaim(prev, 'pass'))
            return
          }
          if (shouldClaim(action, currentPlayer.hand, game.currentPrompt.tile)) {
            setGame((prev) => resolveClaim(prev, action))
            return
          }
        }
      }
    }, AI_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [game, currentPlayer])

  const renderMelds = (player: PlayerState) => {
    if (player.melds.length === 0) return <div className="seat-subtle">暂无副露</div>
    return (
      <div className="meld-row">
        {player.melds.map((meld, idx) => (
          <span key={`${player.id}-meld-${idx}`} className="meld-pill">
            <span className="meld-type">{meldTypeLabel(meld.type)}</span>
            <span>{meld.tiles.map((tile) => tileVisual(tile)).join(' ')}</span>
          </span>
        ))}
      </div>
    )
  }

  const renderDiscards = (player: PlayerState) => (
    <div className="discard-grid">
      {player.discards.length === 0 ? (
        <span className="seat-subtle">暂无弃牌</span>
      ) : (
        player.discards.map((tile) => (
          <span key={`${player.id}-${tile.id}`} className="discard-tile" title={tileLabel(tile)}>
            {tileVisual(tile)}
          </span>
        ))
      )}
    </div>
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>哈尔滨麻将</h1>
          <p className="subtitle">单机牌桌 · 你与三家 AI 对战</p>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => setRulesExpanded((v) => !v)}>
            {rulesExpanded ? '收起规则' : '规则说明'}
          </button>
          <button className="ghost" onClick={() => setLogExpanded((v) => !v)}>
            {logExpanded ? '收起牌局记录' : '牌局记录'}
          </button>
          <button onClick={doRestart}>重新开始</button>
        </div>
      </header>

      <section className="hud-strip">
        <div className="banner-line">{bannerText}</div>
        <div className="hud-stats">
          <span>第 {game.roundNumber || 1} 局</span>
          <span>庄家：{game.players[game.dealerId].name}</span>
          <span>轮到：{currentPlayer.name}</span>
          <span>牌墙：{game.wall.length} / 136</span>
          <span>总分：你 {game.scores[0]} · 左家 {game.scores[1]} · 对家 {game.scores[2]} · 右家 {game.scores[3]}</span>
        </div>
      </section>

      <main className="mahjong-layout">
        <section className="table-stage">
          <div className="seat-top seat-block">
            <SeatPanel player={topPlayer} active={topPlayer.id === game.currentPlayerId} side="top" score={game.scores[topPlayer.id]}>
              {renderMelds(topPlayer)}
              <div className="river-label">对家牌河</div>
              {renderDiscards(topPlayer)}
            </SeatPanel>
          </div>

          <div className="seat-left seat-block">
            <SeatPanel player={leftPlayer} active={leftPlayer.id === game.currentPlayerId} side="left" score={game.scores[leftPlayer.id]}>
              {renderMelds(leftPlayer)}
              <div className="river-label">左家牌河</div>
              {renderDiscards(leftPlayer)}
            </SeatPanel>
          </div>

          <div className="seat-right seat-block">
            <SeatPanel player={rightPlayer} active={rightPlayer.id === game.currentPlayerId} side="right" score={game.scores[rightPlayer.id]}>
              {renderMelds(rightPlayer)}
              <div className="river-label">右家牌河</div>
              {renderDiscards(rightPlayer)}
            </SeatPanel>
          </div>

          <div className="center-zone">
            <div className="table-felt">
              <div className="wind-marker wind-top">对家</div>
              <div className="wind-marker wind-left">左家</div>
              <div className="wind-marker wind-right">右家</div>
              <div className="wind-marker wind-bottom">你</div>

              <div className="center-status-card">
                <div className="center-title">牌桌状态</div>
                <div className="center-text">{bannerText}</div>
              </div>

              <div className="center-grid">
                <div className="center-card">
                  <div className="center-title">最近弃牌</div>
                  {game.lastDiscard ? (
                    <>
                      <div className="featured-tile">{tileVisual(game.lastDiscard.tile)}</div>
                      <div className="center-caption">
                        {game.players[game.lastDiscard.playerId].name} 打出 {tileLabel(game.lastDiscard.tile)}
                      </div>
                    </>
                  ) : (
                    <div className="center-caption">本局尚未出现弃牌</div>
                  )}
                </div>

                <div className="center-card">
                  <div className="center-title">当前操作</div>
                  <div className="operation-summary">
                    {canHumanDraw && '摸牌'}
                    {humanTurnToDiscard && (selectedTile ? `打出 ${selectedTileLabel}` : '选择手牌')}
                    {!canHumanDraw && !humanTurnToDiscard && !humanPrompt && '等待中'}
                    {humanPrompt && humanPrompt.actions.map((action) => actionLabel(action)).join(' / ')}
                  </div>
                  <div className="center-caption">
                    {humanTurnToDiscard
                      ? '主按钮固定在底部操作区'
                      : humanPrompt
                        ? '可在底部响应区直接操作'
                        : '请关注牌桌中央提示'}
                  </div>
                </div>
              </div>

              {game.roundSettlement && (
                <div className="settlement-box">
                  <strong>本局结算</strong>
                  <p>{game.roundSettlement.summary}</p>
                  <p>
                    {game.roundSettlement.deltas
                      .map((item) => `${game.players[item.playerId].name} ${item.delta >= 0 ? '+' : ''}${item.delta}`)
                      .join(' · ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bottom-dock">
          <div className={`self-panel ${human.id === game.currentPlayerId ? 'active' : ''}`}>
            <div className="self-header">
              <div>
                <div className="self-title">你的手牌</div>
                <div className="self-meta">{seatWindLabel(human.seatWind)}位 · 手牌 {human.hand.length} 张 · 分数 {game.scores[human.id]}</div>
              </div>
              <div className="self-melds">
                <span className="river-label">你的副露</span>
                {renderMelds(human)}
              </div>
            </div>

            <div className="river-section">
              <div className="river-label">你的牌河</div>
              {renderDiscards(human)}
            </div>

            <div className="hand-area">
              {human.hand.map((tile) => (
                <button
                  key={tile.id}
                  className={`mahjong-tile ${selectedTileId === tile.id ? 'selected' : ''}`}
                  type="button"
                  disabled={!humanTurnToDiscard}
                  onClick={() => setSelectedTileId(tile.id)}
                  title={tileLabel(tile)}
                >
                  <span className="tile-corner">{tileSuitBadge(tile)}</span>
                  <span className="tile-face">{tileVisual(tile)}</span>
                  <span className="tile-name">{tileLabel(tile)}</span>
                </button>
              ))}
            </div>

            <div className="action-dock">
              <button className="primary action-main" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.label}
              </button>
              {humanTurnToDiscard && selectedTile && (
                <button className="ghost" onClick={() => setSelectedTileId(null)}>
                  取消选择
                </button>
              )}
            </div>

            {humanPrompt && (
              <div className="claim-bar">
                <div className="claim-title">可执行操作</div>
                <div className="claim-actions">
                  {humanPrompt.actions.map((action) => (
                    <button
                      key={action}
                      className={action === 'win' ? 'danger' : action === 'pass' ? 'ghost' : ''}
                      onClick={() => doResolvePrompt(action)}
                    >
                      {actionLabel(action)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {logExpanded && (
        <section className="drawer-panel">
          <h2>牌局记录</h2>
          <div className="log-list">
            {game.log.length === 0 ? <p>暂无记录。</p> : game.log.map((entry, idx) => <p key={`log-${idx}`}>{entry}</p>)}
          </div>
        </section>
      )}

      {rulesExpanded && (
        <section className="drawer-panel rules-panel">
          <h2>规则说明</h2>
          <ul>
            <li>当前为单机简化哈尔滨麻将牌桌，重点先保证可玩与界面清晰。</li>
            <li>基础和牌结构为 4 组面子 + 1 对将，也支持七对结算。</li>
            <li>吃牌仅限上家弃牌；响应优先级为：胡 ＞ 杠 ＞ 碰 ＞ 吃。</li>
            <li>日志与规则默认收起，主界面只保留关键牌桌信息。</li>
          </ul>
        </section>
      )}
    </div>
  )
}

function SeatPanel({
  player,
  active,
  side,
  score,
  children,
}: {
  player: PlayerState
  active: boolean
  side: 'top' | 'left' | 'right'
  score: number
  children: React.ReactNode
}) {
  return (
    <div className={`seat-panel ${side} ${active ? 'active' : ''}`}>
      <div className="seat-head">
        <strong>{seatName(side)}</strong>
        <span>
          {player.name} · {seatWindLabel(player.seatWind)}位
        </span>
      </div>
      <div className="seat-meta">手牌 {player.hand.length} · 分数 {score}</div>
      {children}
    </div>
  )
}

function seatName(side: 'top' | 'left' | 'right') {
  if (side === 'top') return '对家'
  if (side === 'left') return '左家'
  return '右家'
}

export default App
