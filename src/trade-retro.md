<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Trade Retro
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Historical Trade Analysis & Long-Term Impact
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Track trade performance year-over-year. See which deals paid off in the long run and which trades haunted managers for seasons to come.
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
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();
const draftData = await FileAttachment("data/draft-picks.json").json();

// Debug: Log data loaded
console.log('Trades loaded:', trades.length, 'trades');
console.log('Matchups years:', Object.keys(matchupsAllYears));
console.log('Draft data seasons:', Object.keys(draftData));
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

// Helper function to get player stats across ALL years after trade
function getPlayerStatsAllYearsAfterTrade(playerId, tradeYear, tradeWeek) {
  const stats = {
    gamesPlayed: 0,
    totalPoints: 0,
    averagePoints: 0,
    bestWeek: 0,
    worstWeek: Infinity,
    yearlyBreakdown: {} // year -> {games, points}
  };

  // Get all available years sorted
  const allYears = Object.keys(matchupsAllYears).sort();

  allYears.forEach(year => {
    const yearData = matchupsAllYears[year];
    if (!yearData || !yearData.matchups) return;

    // Only count stats from trade year onward
    if (parseInt(year) < parseInt(tradeYear)) return;

    let yearGames = 0;
    let yearPoints = 0;

    yearData.matchups.forEach(weekData => {
      // For the trade year, only count weeks after the trade
      if (parseInt(year) === parseInt(tradeYear) && weekData.week <= tradeWeek) {
        return;
      }

      // Find any matchup where this player appeared
      weekData.matchups.forEach(matchup => {
        if (matchup.players_points && matchup.players_points[playerId] !== undefined) {
          const points = matchup.players_points[playerId] || 0;
          stats.gamesPlayed++;
          stats.totalPoints += points;
          stats.bestWeek = Math.max(stats.bestWeek, points);
          stats.worstWeek = Math.min(stats.worstWeek, points);
          yearGames++;
          yearPoints += points;
        }
      });
    });

    if (yearGames > 0) {
      stats.yearlyBreakdown[year] = {
        games: yearGames,
        points: yearPoints,
        avg: yearPoints / yearGames
      };
    }
  });

  if (stats.gamesPlayed > 0) {
    stats.averagePoints = stats.totalPoints / stats.gamesPlayed;
  }
  if (stats.worstWeek === Infinity) stats.worstWeek = 0;

  return stats;
}

// Get available seasons from trades
const availableSeasons = [...new Set(trades.map(t => t.season))].sort((a, b) => b.localeCompare(a));
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
// Process trade data with year-over-year stats
const processedTrades = trades.map(trade => {
  // Get roster IDs from adds/drops
  const rosterIdsFromAdds = trade.adds ? Object.values(trade.adds).filter(id => id !== 0) : [];
  const rosterIdsFromDrops = trade.drops ? Object.values(trade.drops).filter(id => id !== 0) : [];
  const allRosterIds = [...new Set([...rosterIdsFromAdds, ...rosterIdsFromDrops])];

  // Build roster movements
  const rosterMoves = {};
  allRosterIds.forEach(rosterId => {
    rosterMoves[rosterId] = {
      added: [],
      dropped: []
    };
  });

  // Map adds to rosters
  if (trade.adds) {
    Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
      if (rosterId !== 0 && rosterMoves[rosterId]) {
        rosterMoves[rosterId].added.push(playerId);
      }
    });
  }

  // Map drops to rosters
  if (trade.drops) {
    Object.entries(trade.drops).forEach(([playerId, rosterId]) => {
      if (rosterId !== 0 && rosterMoves[rosterId]) {
        rosterMoves[rosterId].dropped.push(playerId);
      }
    });
  }

  // Calculate performance for each side (year-over-year)
  const sides = allRosterIds.map(rosterId => {
    const user = getUserByRosterId(rosterId);
    const moves = rosterMoves[rosterId];

    // Get year-over-year performance stats for players acquired
    const acquiredStats = moves.added.map(playerId => ({
      playerId,
      name: getPlayerName(playerId),
      position: getPlayerPosition(playerId),
      stats: getPlayerStatsAllYearsAfterTrade(playerId, trade.season, trade.week)
    }));

    // Get year-over-year performance stats for players given up
    const givenUpStats = moves.dropped.map(playerId => ({
      playerId,
      name: getPlayerName(playerId),
      position: getPlayerPosition(playerId),
      stats: getPlayerStatsAllYearsAfterTrade(playerId, trade.season, trade.week)
    }));

    const acquiredTotalPoints = acquiredStats.reduce((sum, p) => sum + p.stats.totalPoints, 0);
    const givenUpTotalPoints = givenUpStats.reduce((sum, p) => sum + p.stats.totalPoints, 0);
    const netPoints = acquiredTotalPoints - givenUpTotalPoints;

    return {
      rosterId,
      username: user?.display_name || `Team ${rosterId}`,
      acquired: acquiredStats,
      givenUp: givenUpStats,
      acquiredTotalPoints,
      givenUpTotalPoints,
      netPoints
    };
  });

  // Determine winner based on actual performance
  const sortedSides = [...sides].sort((a, b) => b.netPoints - a.netPoints);
  const pointsDiff = sortedSides.length >= 2 ? Math.abs(sortedSides[0].netPoints - (sortedSides[1]?.netPoints || 0)) : 0;
  const winner = sortedSides.length >= 2 && pointsDiff > 20 ? sortedSides[0].username : "Even Trade";

  return {
    ...trade,
    sides,
    winner,
    pointsDiff,
    timestamp: new Date(trade.created)
  };
}).filter(trade => {
  // Filter by selected season
  if (selectedSeason !== "All Seasons" && trade.season !== selectedSeason) {
    return false;
  }
  return trade.sides.length > 0;
}).sort((a, b) => b.timestamp - a.timestamp);

console.log('Processed trades:', processedTrades.length);
```

```js
// Calculate summary stats
const totalTrades = processedTrades.length;
const totalPlayersTradedAcrossYears = processedTrades.reduce((sum, t) => {
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

// Find the trade with biggest long-term impact
const biggestImpactTrade = processedTrades.reduce((biggest, trade) => {
  return (trade.pointsDiff > (biggest?.pointsDiff || 0)) ? trade : biggest;
}, null);

const tradeStatsContent = html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px;">
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">
        ${selectedSeason === "All Seasons" ? "Historical Trades" : `${selectedSeason} Trades`}
      </div>
      <div style="font-size: 32px; font-weight: bold; color: var(--theme-accent);">${totalTrades}</div>
    </div>
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #8b5cf6;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Players Tracked</div>
      <div style="font-size: 32px; font-weight: bold; color: #8b5cf6;">${totalPlayersTradedAcrossYears}</div>
    </div>
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #f59e0b;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Most Active Trader</div>
      <div style="font-size: 16px; font-weight: bold; color: #f59e0b;">${mostActiveTrader}</div>
      <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
        ${sortedTradeCounts[0] ? sortedTradeCounts[0][1] : 0} trades
      </div>
    </div>
    ${biggestImpactTrade ? html`
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #ef4444;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Biggest Impact</div>
        <div style="font-size: 16px; font-weight: bold; color: #ef4444;">
          ${biggestImpactTrade.winner === 'Even Trade' ? 'Even Trade' : biggestImpactTrade.winner}
        </div>
        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
          ${biggestImpactTrade.pointsDiff.toFixed(1)} pt differential
        </div>
      </div>
    ` : ''}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Year-Over-Year Trade Statistics</summary>
  <div class="section-content">
    ${tradeStatsContent}
  </div>
</details>`);
```

```js
// Display each trade with year-over-year performance analysis
if (processedTrades.length === 0) {
  display(html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; margin: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
      <h3 style="margin: 0 0 10px 0;">No Trades Found</h3>
      <p style="color: var(--theme-foreground-alt); margin: 0;">Historical trades will appear here once available.</p>
    </div>
  `);
} else {
  processedTrades.forEach((trade, index) => {
    // Calculate years of data available
    const tradeYear = parseInt(trade.season);
    const allYears = Object.keys(matchupsAllYears).map(y => parseInt(y)).sort();
    const yearsOfData = allYears.filter(y => y >= tradeYear).length;

    const tradeContent = html`
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: var(--theme-foreground-alt); text-transform: uppercase; letter-spacing: 0.05em;">
              ${trade.season} • Week ${trade.week} • ${trade.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${yearsOfData} season${yearsOfData !== 1 ? 's' : ''} of data
            </div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 5px; color: ${trade.winner === 'Even Trade' ? 'var(--theme-accent)' : '#f59e0b'};">
              ${trade.winner === 'Even Trade' ? '⚖️ Even Long-Term Value' : `🏆 Long-Term Winner: ${trade.winner}`}
            </div>
            ${trade.pointsDiff > 0 ? html`
              <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-top: 5px;">
                Career point differential: ${trade.pointsDiff.toFixed(1)} pts
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

            ${trade.sides[0].givenUp.length > 0 ? html`
              <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Gave Up:
                </div>
                ${trade.sides[0].givenUp.map(player => html`
                  <div style="padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 8px; border-radius: 4px;">
                    <div style="font-weight: 600; font-size: 14px;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                      ${player.position} • ${player.stats.gamesPlayed} career games
                    </div>
                    <div style="font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 6px;">
                      ${player.stats.totalPoints.toFixed(1)} total pts
                    </div>
                    ${Object.keys(player.stats.yearlyBreakdown).length > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        ${Object.entries(player.stats.yearlyBreakdown).map(([year, data]) => html`
                          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                            <span>${year}:</span>
                            <span>${data.points.toFixed(1)} pts (${data.games} games)</span>
                          </div>
                        `)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 4px;">
                        No production since trade
                      </div>
                    `}
                  </div>
                `)}
              </div>
            ` : ''}

            ${trade.sides[0].acquired.length > 0 ? html`
              <div>
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Received:
                </div>
                ${trade.sides[0].acquired.map(player => html`
                  <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 8px; border-radius: 4px;">
                    <div style="font-weight: 600; font-size: 14px;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                      ${player.position} • ${player.stats.gamesPlayed} career games
                    </div>
                    <div style="font-size: 13px; color: #22c55e; font-weight: 600; margin-top: 6px;">
                      ${player.stats.totalPoints.toFixed(1)} total pts
                    </div>
                    ${Object.keys(player.stats.yearlyBreakdown).length > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        ${Object.entries(player.stats.yearlyBreakdown).map(([year, data]) => html`
                          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                            <span>${year}:</span>
                            <span>${data.points.toFixed(1)} pts (${data.games} games)</span>
                          </div>
                        `)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 4px;">
                        No production since trade
                      </div>
                    `}
                  </div>
                `)}
              </div>
            ` : ''}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>
                  <div style="color: var(--theme-foreground-alt);">Career Total Acquired:</div>
                  <div style="font-weight: bold; color: #22c55e;">${trade.sides[0].acquiredTotalPoints.toFixed(1)} pts</div>
                </div>
                <div>
                  <div style="color: var(--theme-foreground-alt);">Career Total Given Up:</div>
                  <div style="font-weight: bold; color: #ef4444;">${trade.sides[0].givenUpTotalPoints.toFixed(1)} pts</div>
                </div>
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-top: 10px; color: ${trade.sides[0].netPoints > 0 ? '#22c55e' : trade.sides[0].netPoints < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'};">
                Career Net Gain: ${trade.sides[0].netPoints > 0 ? '+' : ''}${trade.sides[0].netPoints.toFixed(1)} pts
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

            ${(trade.sides[1]?.givenUp.length > 0) ? html`
              <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Gave Up:
                </div>
                ${trade.sides[1].givenUp.map(player => html`
                  <div style="padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 8px; border-radius: 4px;">
                    <div style="font-weight: 600; font-size: 14px;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                      ${player.position} • ${player.stats.gamesPlayed} career games
                    </div>
                    <div style="font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 6px;">
                      ${player.stats.totalPoints.toFixed(1)} total pts
                    </div>
                    ${Object.keys(player.stats.yearlyBreakdown).length > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        ${Object.entries(player.stats.yearlyBreakdown).map(([year, data]) => html`
                          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                            <span>${year}:</span>
                            <span>${data.points.toFixed(1)} pts (${data.games} games)</span>
                          </div>
                        `)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 4px;">
                        No production since trade
                      </div>
                    `}
                  </div>
                `)}
              </div>
            ` : ''}

            ${(trade.sides[1]?.acquired.length > 0) ? html`
              <div>
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Received:
                </div>
                ${trade.sides[1].acquired.map(player => html`
                  <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 8px; border-radius: 4px;">
                    <div style="font-weight: 600; font-size: 14px;">${player.name}</div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                      ${player.position} • ${player.stats.gamesPlayed} career games
                    </div>
                    <div style="font-size: 13px; color: #22c55e; font-weight: 600; margin-top: 6px;">
                      ${player.stats.totalPoints.toFixed(1)} total pts
                    </div>
                    ${Object.keys(player.stats.yearlyBreakdown).length > 0 ? html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        ${Object.entries(player.stats.yearlyBreakdown).map(([year, data]) => html`
                          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                            <span>${year}:</span>
                            <span>${data.points.toFixed(1)} pts (${data.games} games)</span>
                          </div>
                        `)}
                      </div>
                    ` : html`
                      <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-top: 4px;">
                        No production since trade
                      </div>
                    `}
                  </div>
                `)}
              </div>
            ` : ''}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div>
                  <div style="color: var(--theme-foreground-alt);">Career Total Acquired:</div>
                  <div style="font-weight: bold; color: #22c55e;">${trade.sides[1]?.acquiredTotalPoints.toFixed(1) || '0.0'} pts</div>
                </div>
                <div>
                  <div style="color: var(--theme-foreground-alt);">Career Total Given Up:</div>
                  <div style="font-weight: bold; color: #ef4444;">${trade.sides[1]?.givenUpTotalPoints.toFixed(1) || '0.0'} pts</div>
                </div>
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-top: 10px; color: ${trade.sides[1]?.netPoints > 0 ? '#22c55e' : trade.sides[1]?.netPoints < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'};">
                Career Net Gain: ${trade.sides[1]?.netPoints > 0 ? '+' : ''}${trade.sides[1]?.netPoints.toFixed(1) || '0.0'} pts
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    display(html`<details class="section-collapse">
      <summary class="section-summary">
        Trade #${processedTrades.length - index} • ${trade.season} Week ${trade.week}
        ${trade.winner !== 'Even Trade' ? html`<span style="color: #f59e0b; margin-left: 0.5rem;">🏆 ${trade.winner}</span>` : ''}
      </summary>
      <div class="section-content">
        ${tradeContent}
      </div>
    </details>`);
  });
}
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">💡 Trade Retro Guide</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Year-Over-Year Tracking:</strong> Shows total fantasy points scored by each player across ALL seasons since the trade</li>
    <li><strong>Career Impact:</strong> Reveals which trades had lasting impact beyond just the trade season</li>
    <li><strong>Yearly Breakdown:</strong> Drill down to see season-by-season performance for each traded player</li>
    <li><strong>Long-Term Winner:</strong> Determined by career point differential (>20 points) from actual performance</li>
    <li><strong>Context Matters:</strong> Injuries, breakouts, and career trajectories can't be predicted—this is hindsight analysis</li>
  </ul>
</div>
