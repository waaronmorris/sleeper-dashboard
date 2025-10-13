<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Trade Postmortem
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Trade History & Performance Analysis
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Review all completed trades and see how the traded players have performed since the trade. Compare actual fantasy points scored to determine who really won each deal.
  </p>
</div>

```js
// Load data
const trades = await FileAttachment("data/trades.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
const league = await FileAttachment("data/league.json").json();
const matchupsData = await FileAttachment("data/matchups.json").json();
const draftData = await FileAttachment("data/draft-picks.json").json();

// Debug: Log data loaded
console.log('Trades loaded:', trades.length, 'trades');
console.log('Draft data seasons:', Object.keys(draftData));
console.log('Sample trade:', trades[0]);
console.log('Sample trade season:', trades[0]?.season);
console.log('Sample trade week:', trades[0]?.week);
```

```js
// Helper function to get user by roster ID
function getUserByRosterId(rosterId) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return null;
  return users.find(u => u.user_id === roster.owner_id);
}

// Helper function to get player name
function getPlayerName(playerId) {
  const player = players[playerId];
  if (!player) return playerId;
  return `${player.first_name} ${player.last_name}`;
}

// Helper function to get player position
function getPlayerPosition(playerId) {
  const player = players[playerId];
  return player?.position || 'N/A';
}

// Helper function to look up what player was selected with a draft pick
function getDraftPickPlayer(round, season, originalRosterId) {
  // Check if we have draft data for this season
  const yearData = draftData[season];
  if (!yearData || !yearData.picks) {
    return null;
  }

  // Find the pick by round and roster_id (original owner)
  const pick = yearData.picks.find(p =>
    p.round === round && p.roster_id === originalRosterId
  );

  return pick ? {
    player_id: pick.player_id,
    pick_no: pick.pick_no,
    round: pick.round
  } : null;
}

// Helper function to get player stats after trade week
function getPlayerStatsAfterTrade(playerId, tradeWeek) {
  const stats = {
    gamesPlayed: 0,
    totalPoints: 0,
    averagePoints: 0,
    bestWeek: 0,
    worstWeek: Infinity,
    weeks: []
  };

  // Look through all weeks after the trade
  matchupsData.forEach(weekData => {
    if (weekData.week > tradeWeek) {
      // Find any matchup where this player appeared
      weekData.matchups.forEach(matchup => {
        if (matchup.players_points && matchup.players_points[playerId] !== undefined) {
          const points = matchup.players_points[playerId] || 0;
          stats.gamesPlayed++;
          stats.totalPoints += points;
          stats.bestWeek = Math.max(stats.bestWeek, points);
          stats.worstWeek = Math.min(stats.worstWeek, points);
          stats.weeks.push({ week: weekData.week, points });
        }
      });
    }
  });

  if (stats.gamesPlayed > 0) {
    stats.averagePoints = stats.totalPoints / stats.gamesPlayed;
  }
  if (stats.worstWeek === Infinity) stats.worstWeek = 0;

  return stats;
}

// Get available seasons from draft data
const availableSeasons = Object.keys(draftData).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
```

```js
// Create season selector
const selectedSeason = view(Inputs.select(
  ["All Seasons", ...availableSeasons],
  {
    label: "Filter by Season",
    value: "All Seasons"
  }
));
```

```js
// Process trade data with performance stats
const processedTrades = trades.map(trade => {
  // Get roster IDs from adds/drops instead of consenter_ids to find actual teams involved
  const rosterIdsFromAdds = trade.adds ? Object.values(trade.adds).filter(id => id !== 0) : [];
  const rosterIdsFromDrops = trade.drops ? Object.values(trade.drops).filter(id => id !== 0) : [];
  const allRosterIds = [...new Set([...rosterIdsFromAdds, ...rosterIdsFromDrops])];

  // Build roster movements
  const rosterMoves = {};
  allRosterIds.forEach(rosterId => {
    rosterMoves[rosterId] = {
      added: [],
      dropped: [],
      draftPicksGained: [],
      draftPicksLost: []
    };
  });

  // Map adds to rosters (skip roster_id 0)
  if (trade.adds) {
    Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
      if (rosterId !== 0 && rosterMoves[rosterId]) {
        rosterMoves[rosterId].added.push(playerId);
      }
    });
  }

  // Map drops to rosters (skip roster_id 0)
  if (trade.drops) {
    Object.entries(trade.drops).forEach(([playerId, rosterId]) => {
      if (rosterId !== 0 && rosterMoves[rosterId]) {
        rosterMoves[rosterId].dropped.push(playerId);
      }
    });
  }

  // Process draft picks in the trade
  if (trade.draft_picks && trade.draft_picks.length > 0) {
    trade.draft_picks.forEach(pick => {
      const newOwner = pick.owner_id;
      const previousOwner = pick.previous_owner_id;

      // Look up who was drafted with this pick
      // Use owner_id (who received it) instead of roster_id (original owner)
      // because the team that receives the pick is the one who uses it in the draft
      const draftInfo = getDraftPickPlayer(pick.round, pick.season, pick.owner_id);
      const enrichedPick = {
        ...pick,
        draftedPlayer: draftInfo,
        // Calculate stats for the drafted player (from draft year onwards, not from trade week)
        draftedPlayerStats: draftInfo ? getPlayerStatsAfterTrade(draftInfo.player_id, 0) : null
      };

      // Add to new owner's gained picks
      if (newOwner && rosterMoves[newOwner]) {
        rosterMoves[newOwner].draftPicksGained.push(enrichedPick);
      }

      // Add to previous owner's lost picks
      if (previousOwner && rosterMoves[previousOwner]) {
        rosterMoves[previousOwner].draftPicksLost.push(enrichedPick);
      }
    });
  }

  // Calculate performance for each side
  const sides = allRosterIds.map(rosterId => {
    const user = getUserByRosterId(rosterId);
    const moves = rosterMoves[rosterId];

    // Get performance stats for players acquired
    const acquiredStats = moves.added.map(playerId => ({
      playerId,
      name: getPlayerName(playerId),
      position: getPlayerPosition(playerId),
      stats: getPlayerStatsAfterTrade(playerId, trade.week)
    }));

    // Get performance stats for players given up
    const givenUpStats = moves.dropped.map(playerId => ({
      playerId,
      name: getPlayerName(playerId),
      position: getPlayerPosition(playerId),
      stats: getPlayerStatsAfterTrade(playerId, trade.week)
    }));

    // Calculate total points including drafted players from gained picks
    const draftPickPoints = moves.draftPicksGained.reduce((sum, pick) => {
      return sum + (pick.draftedPlayerStats?.totalPoints || 0);
    }, 0);
    const draftPickPointsLost = moves.draftPicksLost.reduce((sum, pick) => {
      return sum + (pick.draftedPlayerStats?.totalPoints || 0);
    }, 0);

    const acquiredTotalPoints = acquiredStats.reduce((sum, p) => sum + p.stats.totalPoints, 0) + draftPickPoints;
    const givenUpTotalPoints = givenUpStats.reduce((sum, p) => sum + p.stats.totalPoints, 0) + draftPickPointsLost;
    const netPoints = acquiredTotalPoints - givenUpTotalPoints;

    return {
      rosterId,
      username: user?.display_name || `Team ${rosterId}`,
      acquired: acquiredStats,
      givenUp: givenUpStats,
      draftPicksGained: moves.draftPicksGained || [],
      draftPicksLost: moves.draftPicksLost || [],
      acquiredTotalPoints,
      givenUpTotalPoints,
      netPoints
    };
  });

  // Determine winner based on actual performance
  const sortedSides = [...sides].sort((a, b) => b.netPoints - a.netPoints);
  const pointsDiff = sortedSides.length >= 2 ? Math.abs(sortedSides[0].netPoints - (sortedSides[1]?.netPoints || 0)) : 0;
  const winner = sortedSides.length >= 2 && pointsDiff > 10 ? sortedSides[0].username : "Even Trade";

  return {
    ...trade,
    sides,
    winner,
    pointsDiff,
    timestamp: new Date(trade.created)
    // season is already in the trade data from the loader
  };
}).filter(trade => {
  // Filter by selected season (trade.season comes from the data loader)
  if (selectedSeason !== "All Seasons" && trade.season !== selectedSeason) {
    return false;
  }

  // Show all trades - even if they don't have 2 properly mapped sides
  // This allows us to display historical trades even without roster mapping
  return trade.sides.length > 0;
}).sort((a, b) => b.timestamp - a.timestamp);

// Debug: Log processed trades
console.log('Selected season:', selectedSeason);
console.log('Processed trades count:', processedTrades.length);
console.log('First processed trade:', processedTrades[0]);
console.log('Trades by number of sides:', processedTrades.reduce((acc, t) => {
  const key = t.sides.length;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {}));

// Debug: Check why trades are filtered out
const allProcessedBeforeFilter = trades.map(trade => {
  const rosterIdsFromAdds = trade.adds ? Object.values(trade.adds).filter(id => id !== 0) : [];
  const rosterIdsFromDrops = trade.drops ? Object.values(trade.drops).filter(id => id !== 0) : [];
  const allRosterIds = [...new Set([...rosterIdsFromAdds, ...rosterIdsFromDrops])];
  return {
    season: trade.season,
    week: trade.week,
    rosterIds: allRosterIds,
    rosterCount: allRosterIds.length
  };
});
console.log('All trades before filter (first 5):', allProcessedBeforeFilter.slice(0, 5));
console.log('Trades with 0 roster IDs:', allProcessedBeforeFilter.filter(t => t.rosterCount === 0).length);
```

```js
// Calculate summary stats
const totalPlayersTrded = processedTrades.reduce((sum, t) => {
  return sum + t.sides.reduce((sideSum, s) => sideSum + s.acquired.length, 0);
}, 0);

const tradeCounts = {};
processedTrades.forEach(t => {
  t.sides.forEach(s => {
    tradeCounts[s.username] = (tradeCounts[s.username] || 0) + 1;
  });
});
const sortedTradeCounts = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]);
const mostActiveTrader = sortedTradeCounts[0] ? sortedTradeCounts[0][0] : 'N/A';

const tradeStatsContent = html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">
        ${selectedSeason === "All Seasons" ? "Total Trades" : `${selectedSeason} Trades`}
      </div>
      <div style="font-size: 32px; font-weight: bold; color: var(--theme-accent);">${processedTrades.length}</div>
    </div>
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #8b5cf6;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Players Traded</div>
      <div style="font-size: 32px; font-weight: bold; color: #8b5cf6;">${totalPlayersTrded}</div>
    </div>
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #f59e0b;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Most Active</div>
      <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">${mostActiveTrader}</div>
    </div>
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">League Trade Stats</summary>
  <div class="section-content">
    ${tradeStatsContent}
  </div>
</details>`);
```

```js
// Display each trade with performance analysis
if (processedTrades.length === 0) {
  display(html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; margin: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
      <h3 style="margin: 0 0 10px 0;">No Trades Yet</h3>
      <p style="color: var(--theme-foreground-alt); margin: 0;">Trades will appear here once they are processed in your league.</p>
    </div>
  `);
} else {
  processedTrades.forEach((trade, index) => {
    const weeksRemaining = matchupsData.length - trade.week;

    const tradeContent = html`
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: var(--theme-foreground-alt); text-transform: uppercase; letter-spacing: 0.05em;">
              Week ${trade.week} • ${trade.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${weeksRemaining} weeks of data
            </div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 5px; color: ${trade.winner === 'Even Trade' ? 'var(--theme-accent)' : '#f59e0b'};">
              ${trade.winner === 'Even Trade' ? '⚖️ Even Trade' : `🏆 Winner: ${trade.winner}`}
            </div>
            ${trade.pointsDiff > 0 ? html`
              <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-top: 5px;">
                Point differential: ${trade.pointsDiff.toFixed(1)} pts
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; align-items: start;">
          <!-- Side 1 -->
          <div style="background: var(--theme-background-alt); padding: 20px; border-radius: 8px; ${trade.sides[0].username === trade.winner && trade.winner !== 'Even Trade' ? 'border: 2px solid #f59e0b;' : ''}">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: var(--theme-accent);">
              ${trade.sides[0].username}
            </div>

            ${trade.sides[0].givenUp.length > 0 || trade.sides[0].draftPicksLost.length > 0 ? html`
              <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Gave Up:
                </div>
                ${trade.sides[0].givenUp.map(player => html`
                  <div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 5px; border-radius: 4px;">
                    <div style="font-weight: 600;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                      ${player.position} • ${player.stats.gamesPlayed} games • ${player.stats.totalPoints.toFixed(1)} pts total
                    </div>
                    ${player.stats.gamesPlayed > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        Avg: ${player.stats.averagePoints.toFixed(1)} • Best: ${player.stats.bestWeek.toFixed(1)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        No games played since trade
                      </div>
                    `}
                  </div>
                `)}
                ${trade.sides[0].draftPicksLost.map(pick => {
                  const draftedPlayer = pick.draftedPlayer ? players[pick.draftedPlayer.player_id] : null;
                  const currentYear = new Date().getFullYear();
                  const isFuture = parseInt(pick.season) > currentYear;
                  return html`
                    <div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 5px; border-radius: 4px;">
                      ${draftedPlayer ? html`
                        <div style="font-weight: 600;">${draftedPlayer.first_name} ${draftedPlayer.last_name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                          ${draftedPlayer.position} • (${pick.season} Round ${pick.round} Pick${pick.draftedPlayer.pick_no ? ` (${pick.draftedPlayer.pick_no} Overall)` : ''})
                        </div>
                        ${pick.draftedPlayerStats && pick.draftedPlayerStats.gamesPlayed > 0 ? html`
                          <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                            ${pick.draftedPlayerStats.gamesPlayed} games • ${pick.draftedPlayerStats.totalPoints.toFixed(1)} pts total
                          </div>
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            Avg: ${pick.draftedPlayerStats.averagePoints.toFixed(1)} • Best: ${pick.draftedPlayerStats.bestWeek.toFixed(1)}
                          </div>
                        ` : html`
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            No games played
                          </div>
                        `}
                      ` : html`
                        <div style="font-weight: 600;">📋 ${pick.season} Round ${pick.round} Pick</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 4px;">
                          ${isFuture ? "Future pick" : "Pick not found"}
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            ${trade.sides[0].acquired.length > 0 || trade.sides[0].draftPicksGained.length > 0 ? html`
              <div>
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Received:
                </div>
                ${trade.sides[0].acquired.map(player => html`
                  <div style="padding: 8px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 5px; border-radius: 4px;">
                    <div style="font-weight: 600;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                      ${player.position} • ${player.stats.gamesPlayed} games • ${player.stats.totalPoints.toFixed(1)} pts total
                    </div>
                    ${player.stats.gamesPlayed > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        Avg: ${player.stats.averagePoints.toFixed(1)} • Best: ${player.stats.bestWeek.toFixed(1)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        No games played since trade
                      </div>
                    `}
                  </div>
                `)}
                ${trade.sides[0].draftPicksGained.map(pick => {
                  const draftedPlayer = pick.draftedPlayer ? players[pick.draftedPlayer.player_id] : null;
                  const currentYear = new Date().getFullYear();
                  const isFuture = parseInt(pick.season) > currentYear;
                  return html`
                    <div style="padding: 8px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 5px; border-radius: 4px;">
                      ${draftedPlayer ? html`
                        <div style="font-weight: 600;">${draftedPlayer.first_name} ${draftedPlayer.last_name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                          ${draftedPlayer.position} • (${pick.season} Round ${pick.round} Pick${pick.draftedPlayer.pick_no ? ` (${pick.draftedPlayer.pick_no} Overall)` : ''})
                        </div>
                        ${pick.draftedPlayerStats && pick.draftedPlayerStats.gamesPlayed > 0 ? html`
                          <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                            ${pick.draftedPlayerStats.gamesPlayed} games • ${pick.draftedPlayerStats.totalPoints.toFixed(1)} pts total
                          </div>
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            Avg: ${pick.draftedPlayerStats.averagePoints.toFixed(1)} • Best: ${pick.draftedPlayerStats.bestWeek.toFixed(1)}
                          </div>
                        ` : html`
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            No games played
                          </div>
                        `}
                      ` : html`
                        <div style="font-weight: 600;">📋 ${pick.season} Round ${pick.round} Pick</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 4px;">
                          ${isFuture ? "Future pick" : "Pick not found"}
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>
                  <div style="color: var(--theme-foreground-alt);">Acquired Total:</div>
                  <div style="font-weight: bold; color: #22c55e;">${trade.sides[0].acquiredTotalPoints.toFixed(1)} pts</div>
                </div>
                <div>
                  <div style="color: var(--theme-foreground-alt);">Given Up Total:</div>
                  <div style="font-weight: bold; color: #ef4444;">${trade.sides[0].givenUpTotalPoints.toFixed(1)} pts</div>
                </div>
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-top: 10px; color: ${trade.sides[0].netPoints > 0 ? '#22c55e' : trade.sides[0].netPoints < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'};">
                Net Gain: ${trade.sides[0].netPoints > 0 ? '+' : ''}${trade.sides[0].netPoints.toFixed(1)} pts
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div style="display: flex; align-items: center; justify-content: center; padding: 20px 0;">
            <div style="font-size: 32px; color: var(--theme-foreground-alt);">⇄</div>
          </div>

          <!-- Side 2 -->
          <div style="background: var(--theme-background-alt); padding: 20px; border-radius: 8px; ${trade.sides[1]?.username === trade.winner && trade.winner !== 'Even Trade' ? 'border: 2px solid #f59e0b;' : ''}">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: var(--theme-accent);">
              ${trade.sides[1]?.username || 'Unknown'}
            </div>

            ${(trade.sides[1]?.givenUp.length > 0 || trade.sides[1]?.draftPicksLost.length > 0) ? html`
              <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Gave Up:
                </div>
                ${trade.sides[1].givenUp.map(player => html`
                  <div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 5px; border-radius: 4px;">
                    <div style="font-weight: 600;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                      ${player.position} • ${player.stats.gamesPlayed} games • ${player.stats.totalPoints.toFixed(1)} pts total
                    </div>
                    ${player.stats.gamesPlayed > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        Avg: ${player.stats.averagePoints.toFixed(1)} • Best: ${player.stats.bestWeek.toFixed(1)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        No games played since trade
                      </div>
                    `}
                  </div>
                `)}
                ${(trade.sides[1]?.draftPicksLost || []).map(pick => {
                  const draftedPlayer = pick.draftedPlayer ? players[pick.draftedPlayer.player_id] : null;
                  const currentYear = new Date().getFullYear();
                  const isFuture = parseInt(pick.season) > currentYear;
                  return html`
                    <div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 5px; border-radius: 4px;">
                      ${draftedPlayer ? html`
                        <div style="font-weight: 600;">${draftedPlayer.first_name} ${draftedPlayer.last_name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                          ${draftedPlayer.position} • (${pick.season} Round ${pick.round} Pick${pick.draftedPlayer.pick_no ? ` (${pick.draftedPlayer.pick_no} Overall)` : ''})
                        </div>
                        ${pick.draftedPlayerStats && pick.draftedPlayerStats.gamesPlayed > 0 ? html`
                          <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                            ${pick.draftedPlayerStats.gamesPlayed} games • ${pick.draftedPlayerStats.totalPoints.toFixed(1)} pts total
                          </div>
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            Avg: ${pick.draftedPlayerStats.averagePoints.toFixed(1)} • Best: ${pick.draftedPlayerStats.bestWeek.toFixed(1)}
                          </div>
                        ` : html`
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            No games played
                          </div>
                        `}
                      ` : html`
                        <div style="font-weight: 600;">📋 ${pick.season} Round ${pick.round} Pick</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 4px;">
                          ${isFuture ? "Future pick" : "Pick not found"}
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            ${(trade.sides[1]?.acquired.length > 0 || trade.sides[1]?.draftPicksGained.length > 0) ? html`
              <div>
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Received:
                </div>
                ${trade.sides[1].acquired.map(player => html`
                  <div style="padding: 8px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 5px; border-radius: 4px;">
                    <div style="font-weight: 600;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                      ${player.position} • ${player.stats.gamesPlayed} games • ${player.stats.totalPoints.toFixed(1)} pts total
                    </div>
                    ${player.stats.gamesPlayed > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        Avg: ${player.stats.averagePoints.toFixed(1)} • Best: ${player.stats.bestWeek.toFixed(1)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                        No games played since trade
                      </div>
                    `}
                  </div>
                `)}
                ${(trade.sides[1]?.draftPicksGained || []).map(pick => {
                  const draftedPlayer = pick.draftedPlayer ? players[pick.draftedPlayer.player_id] : null;
                  const currentYear = new Date().getFullYear();
                  const isFuture = parseInt(pick.season) > currentYear;
                  return html`
                    <div style="padding: 8px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 5px; border-radius: 4px;">
                      ${draftedPlayer ? html`
                        <div style="font-weight: 600;">${draftedPlayer.first_name} ${draftedPlayer.last_name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                          ${draftedPlayer.position} • (${pick.season} Round ${pick.round} Pick${pick.draftedPlayer.pick_no ? ` (${pick.draftedPlayer.pick_no} Overall)` : ''})
                        </div>
                        ${pick.draftedPlayerStats && pick.draftedPlayerStats.gamesPlayed > 0 ? html`
                          <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                            ${pick.draftedPlayerStats.gamesPlayed} games • ${pick.draftedPlayerStats.totalPoints.toFixed(1)} pts total
                          </div>
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            Avg: ${pick.draftedPlayerStats.averagePoints.toFixed(1)} • Best: ${pick.draftedPlayerStats.bestWeek.toFixed(1)}
                          </div>
                        ` : html`
                          <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 2px;">
                            No games played
                          </div>
                        `}
                      ` : html`
                        <div style="font-weight: 600;">📋 ${pick.season} Round ${pick.round} Pick</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 4px;">
                          ${isFuture ? "Future pick" : "Pick not found"}
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>
                  <div style="color: var(--theme-foreground-alt);">Acquired Total:</div>
                  <div style="font-weight: bold; color: #22c55e;">${trade.sides[1]?.acquiredTotalPoints.toFixed(1) || '0.0'} pts</div>
                </div>
                <div>
                  <div style="color: var(--theme-foreground-alt);">Given Up Total:</div>
                  <div style="font-weight: bold; color: #ef4444;">${trade.sides[1]?.givenUpTotalPoints.toFixed(1) || '0.0'} pts</div>
                </div>
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-top: 10px; color: ${trade.sides[1]?.netPoints > 0 ? '#22c55e' : trade.sides[1]?.netPoints < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'};">
                Net Gain: ${trade.sides[1]?.netPoints > 0 ? '+' : ''}${trade.sides[1]?.netPoints.toFixed(1) || '0.0'} pts
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    display(html`<details open class="section-collapse">
      <summary class="section-summary">Trade #${processedTrades.length - index}</summary>
      <div class="section-content">
        ${tradeContent}
      </div>
    </details>`);
  });
}
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">💡 Trade Postmortem Notes</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Performance Tracking:</strong> Shows actual fantasy points scored by each player since the trade was completed</li>
    <li><strong>Winner Determination:</strong> Based on net point differential (>10 points) from actual game performance</li>
    <li><strong>Limited Data:</strong> Recent trades may not have enough weeks of data for a fair comparison</li>
    <li><strong>Context Matters:</strong> Injuries, benchings, and trades can affect post-trade performance</li>
    <li><strong>Team Fit:</strong> A player scoring more points doesn't always mean the trade was bad if it filled a roster need</li>
  </ul>
</div>
