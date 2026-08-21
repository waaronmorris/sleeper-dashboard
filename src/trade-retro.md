<style>
  .stat--text { overflow-wrap: anywhere; font-size: var(--text-xl); }
  .trade-asset { padding: var(--space-3); border-left: 2px solid var(--hair-2); background: var(--ground-2); border-radius: var(--radius); margin-bottom: var(--space-2); }
  .trade-asset__name { font-weight: 600; font-size: var(--text-sm); color: var(--ink); }
  .trade-asset__meta { font-size: var(--text-xs); color: var(--ink-3); margin-top: var(--space-1); }
  .trade-asset__pts { font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 600; margin-top: var(--space-2); }
  .trade-asset__years { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-3); margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--hair); }
  .trade-asset__years > div { display: flex; justify-content: space-between; gap: var(--space-3); }
  .trade-side--win { border-left: 3px solid var(--brass); }
  .trade-card__verdict { margin-bottom: var(--space-3); }
  .trade-side__totals { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .trade-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-4); }
  .trade-matchup { display: grid; grid-template-columns: 1fr; gap: var(--space-4); align-items: start; }
  @media (min-width: 760px) { .trade-matchup { grid-template-columns: 1fr auto 1fr; } }
  .trade-matchup .matchup-divider { align-self: center; text-align: center; font-size: var(--text-lg); }
</style>

```js
import {mountSeasonPicker} from "./components/season.js";
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
const S = seasonsData.by_season[season];
const rosters = S.rosters;
const users = S.users;
```

```js
// Load data
const trades = await FileAttachment("data/trades.json").json();
const players = await FileAttachment("data/players.json").json();
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();
const draftData = await FileAttachment("data/draft-picks.json").json();

// Debug: Log data loaded
console.log('Trades loaded:', trades.length, 'trades');
console.log('Matchups years:', Object.keys(matchupsAllYears));
console.log('Draft data seasons:', Object.keys(draftData));
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? "in season" : "final"}</p>
    <h1>Which trades <em>aged</em> well?</h1>
    <p class="lede">Every trade scored by the career fantasy points each side received versus gave up, across all seasons since the deal.</p>
    <p class="meta">${trades.length} trades on record · ${Object.keys(matchupsAllYears).length} seasons of scoring</p>
  </header>
`);
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
    label: "Season",
    value: (season !== seasonsData.current && availableSeasons.includes(season)) ? season : "All Seasons"
  }
));

const selectedTeam = view(Inputs.select(
  ["All Teams", ...availableTeams],
  {
    label: "Team",
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

## Trade statistics

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
  <div class="stat-grid">
    <div class="stat">
      <div class="stat__k">${selectedSeason === "All Seasons" ? "Trades on record" : `${selectedSeason} trades`}</div>
      <div class="stat__v">${totalTrades}</div>
    </div>
    <div class="stat">
      <div class="stat__k">Players tracked</div>
      <div class="stat__v">${totalPlayersTradedAcrossYears}</div>
    </div>
    <div class="stat">
      <div class="stat__k">Most active trader</div>
      <div class="stat__v stat--text">${mostActiveTrader}</div>
      <div class="stat__l">${sortedTradeCounts[0] ? sortedTradeCounts[0][1] : 0} trades</div>
    </div>
    ${bestTradeRecord ? html`<div class="stat"><div class="stat__k">Best trade record</div><div class="stat__v stat--text">${bestTradeRecord.team}</div><div class="stat__l"><span class="mono">${bestTradeRecord.record}</span> · ${bestTradeRecord.winPercentage.toFixed(1)}% won</div></div>` : ''}
    ${biggestImpactTrade ? html`<div class="stat"><div class="stat__k">Biggest swing</div><div class="stat__v stat--text">${biggestImpactTrade.winner === 'Even Trade' ? 'Even trade' : biggestImpactTrade.winner}</div><div class="stat__l">${biggestImpactTrade.pointsDiff.toFixed(1)} pt differential</div></div>` : ''}
  </div>
`;

display(tradeStatsContent);
```

## Team trade records <span class="section-meta">win / loss / draw</span>

```js
// Display team trade records table
if (sortedTradeRecords.length > 0) {
  const n = sortedTradeRecords.length;
  const teamRecordsTable = html`
    <aside class="note note--slate">
      <b>Records move.</b> Traded draft picks keep scoring as the drafted players play, so these win/loss counts update every season.
    </aside>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th class="num">Record</th>
            <th class="num">Wins</th>
            <th class="num">Losses</th>
            <th class="num">Draws</th>
            <th class="num">Total</th>
            <th class="num">Win %</th>
          </tr>
        </thead>
        <tbody>
          ${sortedTradeRecords.map((teamRecord, index) => {
            const isTop = index < 3;
            const isBottom = n > 6 && index >= n - 3;
            return html`<tr class="${isTop ? 'is-top' : isBottom ? 'is-bottom' : ''}">
              <td><span class="rank ${isTop ? 'rank--top' : isBottom ? 'rank--bottom' : ''}">${index + 1}</span></td>
              <td>${teamRecord.team}</td>
              <td class="num mono">${teamRecord.record}</td>
              <td class="num">${teamRecord.wins}</td>
              <td class="num">${teamRecord.losses}</td>
              <td class="num muted">${teamRecord.draws}</td>
              <td class="num">${teamRecord.totalTrades}</td>
              <td class="num">${teamRecord.winPercentage.toFixed(1)}%</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
    <p class="muted text-xs">A team wins a trade when it gains 20 or more career fantasy points than it gave up. Smaller gaps count as draws. Ranked by win percentage, then wins.</p>
  `;

  display(teamRecordsTable);
}
```

```js
// Render helpers for the per-trade cards.
const fmtPts = v => `${v.toFixed(1)} pts`;

function yearlyRows(stats, emptyText) {
  const years = Object.entries(stats.yearlyBreakdown);
  if (years.length === 0) return html`<div class="trade-asset__meta">${emptyText}</div>`;
  return html`<div class="trade-asset__years">
    ${years.map(([year, data]) => html`<div><span>${year}</span><span>${fmtPts(data.points)} (${data.games} games)</span></div>`)}
  </div>`;
}

function playerCard(player) {
  return html`<div class="trade-asset">
    <div class="trade-asset__name">${player.name}</div>
    <div class="trade-asset__meta"><span class="badge badge--pos-${player.position.toLowerCase()}">${player.position}</span> · ${player.stats.gamesPlayed} career games</div>
    <div class="trade-asset__pts">${fmtPts(player.stats.totalPoints)} total</div>
    ${yearlyRows(player.stats, 'No production since trade')}
  </div>`;
}

function pickCard(pick) {
  const player = pick.draftedPlayer;
  return html`<div class="trade-asset">
    <div class="trade-asset__name mono">${pick.season} round ${pick.round}${player ? ` · pick ${player.pickNumber}` : ' pick'}</div>
    ${player ? html`
      <div class="trade-asset__name">${player.name}</div>
      <div class="trade-asset__meta"><span class="badge badge--pos-${player.position.toLowerCase()}">${player.position}</span> · ${player.stats.gamesPlayed} career games</div>
      <div class="trade-asset__pts">${fmtPts(player.stats.totalPoints)} total</div>
      ${yearlyRows(player.stats, 'No production since draft')}
    ` : html`<div class="trade-asset__meta">Not drafted yet — the player appears after the ${pick.season} draft.</div>`}
  </div>`;
}

function sideCard(side, trade) {
  if (!side) {
    return html`<div class="card trade-side"><div class="card__title">Unknown</div></div>`;
  }
  const isWinner = side.username === trade.winner && trade.winner !== 'Even Trade';
  const net = side.netPoints;
  return html`<div class="card trade-side ${isWinner ? 'trade-side--win' : ''}">
    <div class="card__title">${side.username}</div>

    ${(side.givenUp.length > 0 || side.picksGivenUp.length > 0) ? html`
      <div class="stack">
        <h4>Gave up</h4>
        ${side.givenUp.map(p => playerCard(p))}
        ${side.picksGivenUp.map(p => pickCard(p))}
      </div>
    ` : ''}

    ${(side.acquired.length > 0 || side.picksReceived.length > 0) ? html`
      <div class="stack">
        <h4>Received</h4>
        ${side.acquired.map(p => playerCard(p))}
        ${side.picksReceived.map(p => pickCard(p))}
      </div>
    ` : ''}

    <div class="card__foot">
      <div class="trade-side__totals">
        <div><div class="card__k">Career points received</div><div class="card__v">${fmtPts(side.acquiredTotalPoints)}</div></div>
        <div><div class="card__k">Career points given up</div><div class="card__v">${fmtPts(side.givenUpTotalPoints)}</div></div>
      </div>
      <div class="card__k">Net</div>
      <div class="card__v ${isWinner ? 'brass' : ''}">${net > 0 ? '+' : ''}${fmtPts(net)}</div>
    </div>
  </div>`;
}
```

## Trade by trade

```js
// Display each trade with year-over-year performance analysis
if (processedTrades.length === 0) {
  display(html`
    <aside class="note">
      <b>No trades match.</b> ${trades.length === 0
        ? 'Trades appear here once the league makes its first deal.'
        : 'Try a different season or team filter.'}
    </aside>
  `);
} else {
  processedTrades.forEach((trade, index) => {
    // Calculate years of data available
    const tradeYear = parseInt(trade.season);
    const allYears = Object.keys(matchupsAllYears).map(y => parseInt(y)).sort();
    const yearsOfData = allYears.filter(y => y >= tradeYear).length;
    const isEven = trade.winner === 'Even Trade';

    const tradeContent = html`
      <div class="trade-head">
        <div>
          <p class="eyebrow">${trade.season} · week ${trade.week} · ${trade.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${yearsOfData} season${yearsOfData !== 1 ? 's' : ''} of data</p>
          <div class="trade-card__verdict">${isEven ? html`<span class="badge">Even long-term value</span>` : html`<span class="badge badge--brass">Long-term winner · ${trade.winner}</span>`}</div>
        </div>
        ${trade.pointsDiff > 0 ? html`<div class="mono text-sm muted">Career point differential ${trade.pointsDiff.toFixed(1)} pts</div>` : ''}
      </div>

      <div class="trade-matchup">
        ${sideCard(trade.sides[0], trade)}
        <div class="matchup-divider">FOR</div>
        ${sideCard(trade.sides[1], trade)}
      </div>
    `;

    display(html`<details class="section-collapse">
      <summary class="section-summary">
        Trade ${processedTrades.length - index} · ${trade.season} week ${trade.week}
        ${!isEven ? html`<small class="brass">${trade.winner}</small>` : html`<small>even</small>`}
      </summary>
      <div class="section-content">
        ${tradeContent}
      </div>
    </details>`);
  });
}
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Career points.</strong> Each player's fantasy points in every season since the trade, summed. Draft picks count the points of the player eventually drafted with them.</li>
    <li><strong>Winner.</strong> The side that netted at least 20 more career points than it gave up; anything closer is a draw.</li>
    <li><strong>Yearly rows.</strong> Season-by-season production for each traded asset, so you can see when a deal turned.</li>
    <li><strong>Hindsight.</strong> Injuries, breakouts, and busts are scored after the fact; this is how the trade aged, not how it looked on the day.</li>
  </ul>
</section>
