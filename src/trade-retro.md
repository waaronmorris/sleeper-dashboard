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

// Helper function to get player stats from the draft year onward (for draft picks)
function getPlayerStatsFromDraftYear(playerId, draftYear) {
  const stats = {
    gamesPlayed: 0,
    totalPoints: 0,
    averagePoints: 0,
    bestWeek: 0,
    worstWeek: Infinity,
    yearlyBreakdown: {}
  };

  const allYears = Object.keys(matchupsAllYears).sort();

  allYears.forEach(year => {
    const yearData = matchupsAllYears[year];
    if (!yearData || !yearData.matchups) return;

    // Only count stats from draft year onward
    if (parseInt(year) < parseInt(draftYear)) return;

    let yearGames = 0;
    let yearPoints = 0;

    yearData.matchups.forEach(weekData => {
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

// Helper function to look up which player was drafted with a specific pick
function getPlayerDraftedWithPick(pick) {
  const draftYear = draftData[pick.season];
  if (!draftYear || !draftYear.picks) return null;

  // First, check if this pick was traded by looking in tradedPicks
  // If it was traded, we need to find who actually made the pick (the new owner)
  let actualRosterId = pick.roster_id; // Default to original roster_id

  if (draftYear.tradedPicks && draftYear.tradedPicks.length > 0) {
    const tradedPick = draftYear.tradedPicks.find(tp =>
      tp.roster_id === pick.roster_id && tp.round === pick.round
    );

    if (tradedPick && tradedPick.owner_id) {
      // This pick was traded, so the actual roster that made the pick is the owner_id
      actualRosterId = tradedPick.owner_id;
    }
  }

  // Now find the draft pick made by the actual owner
  const draftPick = draftYear.picks.find(p =>
    p.roster_id === actualRosterId && p.round === pick.round
  );

  if (!draftPick || !draftPick.player_id) return null;

  return {
    playerId: draftPick.player_id,
    name: getPlayerName(draftPick.player_id),
    position: getPlayerPosition(draftPick.player_id),
    pickNumber: draftPick.pick_no,
    stats: getPlayerStatsFromDraftYear(draftPick.player_id, pick.season)
  };
}

// Get available seasons from trades
const availableSeasons = [...new Set(trades.map(t => t.season))].sort((a, b) => b.localeCompare(a));
```

```js
// Get all unique teams that have been involved in trades
const allTeamsInTrades = new Set();
trades.forEach(trade => {
  // Get roster IDs from adds/drops AND draft picks
  const rosterIdsFromAdds = trade.adds ? Object.values(trade.adds).filter(id => id !== 0) : [];
  const rosterIdsFromDrops = trade.drops ? Object.values(trade.drops).filter(id => id !== 0) : [];
  const rosterIdsFromPicks = trade.draft_picks ? trade.draft_picks.flatMap(pick => [pick.owner_id, pick.previous_owner_id]) : [];
  const allRosterIds = [...new Set([...rosterIdsFromAdds, ...rosterIdsFromDrops, ...rosterIdsFromPicks])];

  allRosterIds.forEach(rosterId => {
    const user = getUserByRosterId(rosterId);
    if (user) {
      allTeamsInTrades.add(user.display_name);
    }
  });
});

const availableTeams = [...allTeamsInTrades].sort();
```

```js
// Create filters
const selectedSeason = view(Inputs.select(
  ["All Seasons", ...availableSeasons],
  {
    label: "Filter by Season",
    value: "All Seasons"
  }
));

const selectedTeam = view(Inputs.select(
  ["All Teams", ...availableTeams],
  {
    label: "Filter by Team",
    value: "All Teams"
  }
));
```

```js
// Process trade data with year-over-year stats
const processedTrades = trades.map(trade => {
  // Get roster IDs from adds/drops AND draft picks
  const rosterIdsFromAdds = trade.adds ? Object.values(trade.adds).filter(id => id !== 0) : [];
  const rosterIdsFromDrops = trade.drops ? Object.values(trade.drops).filter(id => id !== 0) : [];
  const rosterIdsFromPicks = trade.draft_picks ? trade.draft_picks.flatMap(pick => [pick.owner_id, pick.previous_owner_id]) : [];
  const allRosterIds = [...new Set([...rosterIdsFromAdds, ...rosterIdsFromDrops, ...rosterIdsFromPicks])];

  // Build roster movements
  const rosterMoves = {};
  allRosterIds.forEach(rosterId => {
    rosterMoves[rosterId] = {
      added: [],
      dropped: [],
      picksAdded: [],
      picksGivenUp: []
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

  // Map draft picks to rosters with enriched player data
  if (trade.draft_picks && trade.draft_picks.length > 0) {
    trade.draft_picks.forEach(pick => {
      // Enrich the pick with actual player data
      const draftedPlayer = getPlayerDraftedWithPick(pick);
      const enrichedPick = {
        ...pick,
        draftedPlayer
      };

      // Current owner received this pick
      if (rosterMoves[pick.owner_id]) {
        rosterMoves[pick.owner_id].picksAdded.push(enrichedPick);
      }
      // Previous owner gave up this pick
      if (rosterMoves[pick.previous_owner_id]) {
        rosterMoves[pick.previous_owner_id].picksGivenUp.push(enrichedPick);
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

    // Calculate points from drafted players received
    const picksReceivedPoints = moves.picksAdded.reduce((sum, pick) => {
      return sum + (pick.draftedPlayer?.stats.totalPoints || 0);
    }, 0);

    // Calculate points from drafted players given up
    const picksGivenUpPoints = moves.picksGivenUp.reduce((sum, pick) => {
      return sum + (pick.draftedPlayer?.stats.totalPoints || 0);
    }, 0);

    const acquiredTotalPoints = acquiredStats.reduce((sum, p) => sum + p.stats.totalPoints, 0) + picksReceivedPoints;
    const givenUpTotalPoints = givenUpStats.reduce((sum, p) => sum + p.stats.totalPoints, 0) + picksGivenUpPoints;
    const netPoints = acquiredTotalPoints - givenUpTotalPoints;

    return {
      rosterId,
      username: user?.display_name || `Team ${rosterId}`,
      acquired: acquiredStats,
      givenUp: givenUpStats,
      picksReceived: moves.picksAdded || [],
      picksGivenUp: moves.picksGivenUp || [],
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

  // Filter by selected team
  if (selectedTeam !== "All Teams") {
    const teamInvolved = trade.sides.some(side => side.username === selectedTeam);
    if (!teamInvolved) {
      return false;
    }
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
const tradeRecords = {}; // Track win-loss-draw for each team

processedTrades.forEach(t => {
  t.sides.forEach(s => {
    tradeCounts[s.username] = (tradeCounts[s.username] || 0) + 1;

    // Initialize record if not exists
    if (!tradeRecords[s.username]) {
      tradeRecords[s.username] = { wins: 0, losses: 0, draws: 0 };
    }

    // Update record based on trade outcome
    if (t.winner === 'Even Trade') {
      tradeRecords[s.username].draws++;
    } else if (t.winner === s.username) {
      tradeRecords[s.username].wins++;
    } else {
      tradeRecords[s.username].losses++;
    }
  });
});

const sortedTradeCounts = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]);
const mostActiveTrader = sortedTradeCounts[0] ? sortedTradeCounts[0][0] : 'N/A';

// Calculate best trade record (by win percentage, then total trades)
const sortedTradeRecords = Object.entries(tradeRecords)
  .map(([team, record]) => {
    const totalTrades = record.wins + record.losses + record.draws;
    const winPercentage = totalTrades > 0 ? (record.wins / totalTrades) * 100 : 0;
    return {
      team,
      ...record,
      totalTrades,
      winPercentage,
      record: `${record.wins}W-${record.losses}L-${record.draws}D`
    };
  })
  .sort((a, b) => {
    // Sort by win percentage, then by total wins
    if (Math.abs(a.winPercentage - b.winPercentage) > 0.01) {
      return b.winPercentage - a.winPercentage;
    }
    return b.wins - a.wins;
  });

const bestTradeRecord = sortedTradeRecords[0];

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
    ${bestTradeRecord ? html`
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #10b981;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Best Trade Record</div>
        <div style="font-size: 16px; font-weight: bold; color: #10b981;">${bestTradeRecord.team}</div>
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-top: 4px; font-weight: 600;">
          ${bestTradeRecord.record}
        </div>
        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 2px;">
          ${bestTradeRecord.winPercentage.toFixed(1)}% win rate
        </div>
      </div>
    ` : ''}
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
// Display team trade records table
if (sortedTradeRecords.length > 0) {
  const teamRecordsTable = html`
    <div style="background: var(--theme-background-alt); border-radius: 8px; padding: 20px; margin-bottom: 30px;">
      <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 700; color: var(--theme-accent);">
        Team Trade Records
      </h3>
      <div style="padding: 12px 16px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 6px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
        <strong style="color: #3b82f6; font-size: 14px;">📊 Note:</strong> These records are current and will change as traded draft picks are used and those players perform in future seasons.
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <colgroup>
            <col style="width: 70px;">
            <col>
            <col style="width: 130px;">
            <col style="width: 70px;">
            <col style="width: 80px;">
            <col style="width: 75px;">
            <col style="width: 70px;">
            <col style="width: 75px;">
          </colgroup>
          <thead>
            <tr style="border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
              <th style="padding: 12px 8px; text-align: left; color: var(--theme-foreground-alt); font-weight: 600;">Rank</th>
              <th style="padding: 12px 8px; text-align: left; color: var(--theme-foreground-alt); font-weight: 600;">Team</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Record</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Wins</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Losses</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Draws</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Total</th>
              <th style="padding: 12px 8px; text-align: center; color: var(--theme-foreground-alt); font-weight: 600;">Win %</th>
            </tr>
          </thead>
          <tbody>
            ${sortedTradeRecords.map((teamRecord, index) => {
              const isTop3 = index < 3;
              const rankColor = index === 0 ? '#fbbf24' : index === 1 ? '#d1d5db' : index === 2 ? '#cd7f32' : 'var(--theme-foreground-alt)';
              const rowBg = index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
              const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;
              const winColor = teamRecord.winPercentage >= 50 ? '#22c55e' : teamRecord.winPercentage >= 33 ? '#f59e0b' : '#ef4444';

              return html`<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: ${rowBg};">
                <td style="padding: 12px 8px; color: ${rankColor}; font-weight: ${isTop3 ? '700' : '500'}; white-space: nowrap; text-align: left;">${rank}</td>
                <td style="padding: 12px 8px; font-weight: ${isTop3 ? '600' : '400'}; color: ${isTop3 ? 'var(--theme-accent)' : 'var(--theme-foreground)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;">${teamRecord.team}</td>
                <td style="padding: 12px 8px; text-align: center; font-weight: 600; font-family: monospace; color: var(--theme-accent); white-space: nowrap;">${teamRecord.record}</td>
                <td style="padding: 12px 8px; text-align: center; color: #22c55e; font-weight: 600;">${teamRecord.wins}</td>
                <td style="padding: 12px 8px; text-align: center; color: #ef4444; font-weight: 600;">${teamRecord.losses}</td>
                <td style="padding: 12px 8px; text-align: center; color: #94a3b8; font-weight: 600;">${teamRecord.draws}</td>
                <td style="padding: 12px 8px; text-align: center; font-weight: 500;">${teamRecord.totalTrades}</td>
                <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: ${winColor}; white-space: nowrap;">${teamRecord.winPercentage.toFixed(1)}%</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: var(--theme-foreground-alt); line-height: 1.6;">
        <strong>How it works:</strong> A team "wins" a trade if they gain 20+ more career fantasy points than they gave up.
        Trades with smaller differentials (&lt;20 pts) are considered "draws" (even trades). Rankings are based on win percentage.
      </div>
    </div>
  `;

  display(html`<details open class="section-collapse">
    <summary class="section-summary">Team Trade Records - Win/Loss/Draw</summary>
    <div class="section-content">
      ${teamRecordsTable}
    </div>
  </details>`);
}
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

            ${(trade.sides[0].givenUp.length > 0 || trade.sides[0].picksGivenUp.length > 0) ? html`
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
                ${trade.sides[0].picksGivenUp.map(pick => {
                  const player = pick.draftedPlayer;
                  return html`
                    <div style="padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 8px; border-radius: 4px;">
                      <div style="font-weight: 600; font-size: 14px;">
                        📋 ${pick.season} Round ${pick.round} ${player ? `Pick #${player.pickNumber}` : 'Pick'}
                      </div>
                      ${player ? html`
                        <div style="font-weight: 600; font-size: 14px; margin-top: 4px;">${player.name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 2px;">
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
                            No production since draft
                          </div>
                        `}
                      ` : html`
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                          Draft not yet occurred
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            ${(trade.sides[0].acquired.length > 0 || trade.sides[0].picksReceived.length > 0) ? html`
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
                ${trade.sides[0].picksReceived.map(pick => {
                  const player = pick.draftedPlayer;
                  return html`
                    <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 8px; border-radius: 4px;">
                      <div style="font-weight: 600; font-size: 14px;">
                        📋 ${pick.season} Round ${pick.round} ${player ? `Pick #${player.pickNumber}` : 'Pick'}
                      </div>
                      ${player ? html`
                        <div style="font-weight: 600; font-size: 14px; margin-top: 4px;">${player.name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 2px;">
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
                            No production since draft
                          </div>
                        `}
                      ` : html`
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                          Draft not yet occurred
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

            ${((trade.sides[1]?.givenUp.length > 0) || (trade.sides[1]?.picksGivenUp.length > 0)) ? html`
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
                ${(trade.sides[1]?.picksGivenUp || []).map(pick => {
                  const player = pick.draftedPlayer;
                  return html`
                    <div style="padding: 10px; background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; margin-bottom: 8px; border-radius: 4px;">
                      <div style="font-weight: 600; font-size: 14px;">
                        📋 ${pick.season} Round ${pick.round} ${player ? `Pick #${player.pickNumber}` : 'Pick'}
                      </div>
                      ${player ? html`
                        <div style="font-weight: 600; font-size: 14px; margin-top: 4px;">${player.name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 2px;">
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
                            No production since draft
                          </div>
                        `}
                      ` : html`
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                          Draft not yet occurred
                        </div>
                      `}
                    </div>
                  `;
                })}
              </div>
            ` : ''}

            ${((trade.sides[1]?.acquired.length > 0) || (trade.sides[1]?.picksReceived.length > 0)) ? html`
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
                ${(trade.sides[1]?.picksReceived || []).map(pick => {
                  const player = pick.draftedPlayer;
                  return html`
                    <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; margin-bottom: 8px; border-radius: 4px;">
                      <div style="font-weight: 600; font-size: 14px;">
                        📋 ${pick.season} Round ${pick.round} ${player ? `Pick #${player.pickNumber}` : 'Pick'}
                      </div>
                      ${player ? html`
                        <div style="font-weight: 600; font-size: 14px; margin-top: 4px;">${player.name}</div>
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 2px;">
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
                            No production since draft
                          </div>
                        `}
                      ` : html`
                        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 4px;">
                          Draft not yet occurred
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
