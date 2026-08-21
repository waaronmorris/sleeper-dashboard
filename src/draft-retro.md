<style>
  /* Page-local pieces with no system component: pick-row summary, retention heat cells, roster lists. */
  .pick-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .pick-summary .pick-summary__push, .push-right { margin-left: auto; }
  .roster-list { margin: 0; padding: 0; list-style: none; }
  .roster-list li { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-1) 0; border-bottom: 1px solid var(--hair); font-size: var(--text-sm); }
  .roster-list li:last-child { border-bottom: 0; }
  .roster-list.is-moved li { color: var(--ink-3); }
  .heat { text-align: center; }
  .heat--up { color: var(--up); background: var(--up-soft); }
  .heat--mid { color: var(--ink-2); }
  .heat--down { color: var(--down); background: var(--down-soft); }
  .retention-matrix { min-width: 800px; }
  .retention-matrix th, .retention-matrix td { white-space: nowrap; }
  .note--line { margin: 0; }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import {T, plotTheme, multiLine, highlightLine, tipStyle} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data
const seasonsData = await FileAttachment("data/seasons.json").json();
const draftData = await FileAttachment("data/draft-picks.json").json();
const players = await FileAttachment("data/players.json").json();
const matchupsData = await FileAttachment("data/matchups.json").json();
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
// Season bundle for the picker's choice: team names and rosters follow the chosen season
const S = seasonsData.by_season[season];
const rosters = S.rosters;
const users = S.users;
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

// Pick slot label ("Pick 1.03") used when a pick has no player record
function pickSlot(pick) {
  return `Pick ${pick.round}.${String(pick.draft_slot ?? pick.pick_no).padStart(2, '0')}`;
}

// Player name, or the pick slot when the player record is missing
function pickName(pick) {
  return pick?.player ? `${pick.player.first_name} ${pick.player.last_name}` : pickSlot(pick);
}

// Helper function to get full season stats for a player
function getPlayerSeasonStats(playerId) {
  const stats = {
    gamesPlayed: 0,
    totalPoints: 0,
    averagePoints: 0,
    bestWeek: 0,
    worstWeek: Infinity,
    weeks: []
  };

  // Look through all weeks
  matchupsData.forEach(weekData => {
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
  });

  if (stats.gamesPlayed > 0) {
    stats.averagePoints = stats.totalPoints / stats.gamesPlayed;
  }
  if (stats.worstWeek === Infinity) stats.worstWeek = 0;

  return stats;
}

// Helper function to get tenure information for a player on a specific roster
function getPlayerTenureOnRoster(playerId, rosterId) {
  const tenure = {
    firstWeek: null,
    lastWeek: null,
    weeksOnRoster: 0,
    pointsOnRoster: 0
  };

  // Look through all weeks
  matchupsData.forEach(weekData => {
    // Find matchup for this roster
    const matchup = weekData.matchups.find(m => m.roster_id === rosterId);
    if (matchup && matchup.players_points && matchup.players_points[playerId] !== undefined) {
      const points = matchup.players_points[playerId] || 0;

      if (!tenure.firstWeek) {
        tenure.firstWeek = weekData.week;
      }
      tenure.lastWeek = weekData.week;
      tenure.weeksOnRoster++;
      tenure.pointsOnRoster += points;
    }
  });

  return tenure;
}

// Helper function to check if player is currently on roster
function isPlayerOnCurrentRoster(playerId, rosterId) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return false;
  return roster.players && roster.players.includes(playerId);
}

// Helper function to calculate team draft grade
function calculateTeamDraftGrade(teamPicks) {
  const totalPicks = teamPicks.length;
  if (totalPicks === 0) return null;

  // Calculate retention
  const stillOnRoster = teamPicks.filter(p => isPlayerOnCurrentRoster(p.player_id, p.roster_id)).length;
  const retentionRate = (stillOnRoster / totalPicks) * 100;

  // Calculate total points and averages
  const totalPoints = teamPicks.reduce((sum, p) => sum + p.stats.totalPoints, 0);
  const avgPointsPerPick = totalPoints / totalPicks;
  const avgWeeksOnRoster = teamPicks.reduce((sum, p) => sum + p.tenure.weeksOnRoster, 0) / totalPicks;

  // Calculate points from players still on roster
  const pointsFromRetained = teamPicks
    .filter(p => isPlayerOnCurrentRoster(p.player_id, p.roster_id))
    .reduce((sum, p) => sum + p.tenure.pointsOnRoster, 0);

  // Find best and worst picks
  const bestPick = teamPicks.reduce((best, current) =>
    current.stats.totalPoints > best.stats.totalPoints ? current : best
  );
  const worstPick = teamPicks.reduce((worst, current) =>
    current.stats.totalPoints < worst.stats.totalPoints ? current : worst
  );

  // Calculate overall grade (A-F)
  let gradeScore = 0;

  // Points per pick (40% weight)
  if (avgPointsPerPick > 80) gradeScore += 40;
  else if (avgPointsPerPick > 60) gradeScore += 32;
  else if (avgPointsPerPick > 40) gradeScore += 24;
  else if (avgPointsPerPick > 20) gradeScore += 16;
  else gradeScore += 8;

  // Retention rate (30% weight)
  if (retentionRate > 70) gradeScore += 30;
  else if (retentionRate > 50) gradeScore += 24;
  else if (retentionRate > 30) gradeScore += 18;
  else if (retentionRate > 20) gradeScore += 12;
  else gradeScore += 6;

  // Average weeks on roster (20% weight)
  const currentWeek = matchupsData.length;
  const avgWeeksPercentage = (avgWeeksOnRoster / currentWeek) * 100;
  if (avgWeeksPercentage > 80) gradeScore += 20;
  else if (avgWeeksPercentage > 60) gradeScore += 16;
  else if (avgWeeksPercentage > 40) gradeScore += 12;
  else if (avgWeeksPercentage > 20) gradeScore += 8;
  else gradeScore += 4;

  // Best pick quality (10% weight)
  if (bestPick.stats.totalPoints > 150) gradeScore += 10;
  else if (bestPick.stats.totalPoints > 100) gradeScore += 8;
  else if (bestPick.stats.totalPoints > 50) gradeScore += 6;
  else gradeScore += 4;

  // Determine letter grade and a tone class (brass = A range, down = D/F, plain otherwise)
  let letterGrade = 'F';
  let gradeTone = 'hero-num--down';
  if (gradeScore >= 90) { letterGrade = 'A+'; gradeTone = 'hero-num--brass'; }
  else if (gradeScore >= 85) { letterGrade = 'A'; gradeTone = 'hero-num--brass'; }
  else if (gradeScore >= 80) { letterGrade = 'A-'; gradeTone = 'hero-num--brass'; }
  else if (gradeScore >= 77) { letterGrade = 'B+'; gradeTone = ''; }
  else if (gradeScore >= 73) { letterGrade = 'B'; gradeTone = ''; }
  else if (gradeScore >= 70) { letterGrade = 'B-'; gradeTone = ''; }
  else if (gradeScore >= 67) { letterGrade = 'C+'; gradeTone = ''; }
  else if (gradeScore >= 63) { letterGrade = 'C'; gradeTone = ''; }
  else if (gradeScore >= 60) { letterGrade = 'C-'; gradeTone = ''; }
  else if (gradeScore >= 57) { letterGrade = 'D+'; gradeTone = 'hero-num--down'; }
  else if (gradeScore >= 53) { letterGrade = 'D'; gradeTone = 'hero-num--down'; }
  else if (gradeScore >= 50) { letterGrade = 'D-'; gradeTone = 'hero-num--down'; }
  else { letterGrade = 'F'; gradeTone = 'hero-num--down'; }

  return {
    totalPicks,
    stillOnRoster,
    retentionRate,
    totalPoints,
    avgPointsPerPick,
    avgWeeksOnRoster,
    pointsFromRetained,
    bestPick,
    worstPick,
    letterGrade,
    gradeTone,
    gradeScore
  };
}

// Get available seasons from draft data
const availableSeasons = Object.keys(draftData).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
const anyPointsScored = matchupsData.some(w => (w.matchups || []).some(m => (m.points || 0) > 0));
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? (anyPointsScored ? `through week ${matchupsData.length}` : "pre-season") : "final"} · draft retro</p>
    <h1>Which picks <em>held</em> their value?</h1>
    <p class="lede">Every draft pick against what it produced, who is still rostered, and who was left on the board.</p>
  </header>
`);
```

```js
// Season selector: defaults to the site-wide season when that draft exists
const selectedSeason = view(Inputs.select(
  availableSeasons,
  {
    label: "Draft",
    value: availableSeasons.includes(season) ? season : availableSeasons[0]
  }
));
```

```js
// Get draft data for selected season and compute teams list
const seasonDraftData = draftData[selectedSeason];

// Compute available teams for this season
const availableTeams = seasonDraftData && seasonDraftData.picks
  ? ["All Teams", ...[...new Set(seasonDraftData.picks.map(pick => {
      const user = getUserByRosterId(pick.roster_id);
      return user?.display_name || `Team ${pick.roster_id}`;
    }))].sort()]
  : ["All Teams"];
```

```js
// Create team filter
const selectedTeam = view(Inputs.select(
  availableTeams,
  {
    label: "Team",
    value: "All Teams"
  }
));
```

```js
display(html`<div>${anyPointsScored ? "" : html`<aside class="note note--brass"><b>No games played yet.</b> Points, pick grades, tenure and retention all read zero until week 1 is scored. The draft board and pick order are complete now.</aside>`}</div>`);
```

```js
// Process draft picks for selected season: stats, round/position context, opportunity cost, team grades
const retro = (() => {
  if (!seasonDraftData || !seasonDraftData.picks || seasonDraftData.picks.length === 0) return null;

  // Calculate stats for all drafted players
  const picksWithStats = seasonDraftData.picks.map(pick => {
    const stats = getPlayerSeasonStats(pick.player_id);
    const tenure = getPlayerTenureOnRoster(pick.player_id, pick.roster_id);
    const user = getUserByRosterId(pick.roster_id);
    const player = players[pick.player_id];

    return {
      ...pick,
      player,
      stats,
      tenure,
      username: user?.display_name || `Team ${pick.roster_id}`
    };
  });

  // Sort by pick number
  picksWithStats.sort((a, b) => a.pick_no - b.pick_no);

  // Calculate round averages for comparison
  const roundAverages = {};
  picksWithStats.forEach(pick => {
    if (!roundAverages[pick.round]) {
      roundAverages[pick.round] = { total: 0, count: 0 };
    }
    roundAverages[pick.round].total += pick.stats.totalPoints;
    roundAverages[pick.round].count += 1;
  });

  Object.keys(roundAverages).forEach(round => {
    roundAverages[round].average = roundAverages[round].total / roundAverages[round].count;
  });

  // Calculate position averages
  const positionAverages = {};
  picksWithStats.forEach(pick => {
    const pos = pick.player?.position || 'N/A';
    if (!positionAverages[pos]) {
      positionAverages[pos] = { total: 0, count: 0 };
    }
    positionAverages[pos].total += pick.stats.totalPoints;
    positionAverages[pos].count += 1;
  });

  Object.keys(positionAverages).forEach(pos => {
    positionAverages[pos].average = positionAverages[pos].total / positionAverages[pos].count;
  });

  // For each pick, calculate opportunity cost (best player still available)
  const picksWithOpportunityCost = picksWithStats.map((pick, index) => {
    // Get all players drafted after this pick
    const laterPicks = picksWithStats.slice(index + 1);

    // Find best performer from later picks
    const bestAvailable = laterPicks.length > 0
      ? laterPicks.reduce((best, current) =>
          current.stats.totalPoints > best.stats.totalPoints ? current : best
        )
      : null;

    // Get top 5 performers still available
    const topAvailable = laterPicks
      .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints)
      .slice(0, 5);

    const roundAvg = roundAverages[pick.round]?.average || 0;
    const posAvg = positionAverages[pick.player?.position]?.average || 0;

    // Calculate value grade and badge tone
    let valueGrade = 'Average';
    let valueTone = '';
    const vsRound = pick.stats.totalPoints - roundAvg;

    if (vsRound > 50) {
      valueGrade = 'Excellent';
      valueTone = 'badge--up';
    } else if (vsRound > 20) {
      valueGrade = 'Good';
      valueTone = 'badge--up';
    } else if (vsRound < -50) {
      valueGrade = 'Poor';
      valueTone = 'badge--down';
    } else if (vsRound < -20) {
      valueGrade = 'Below average';
      valueTone = 'badge--down';
    }

    return {
      ...pick,
      bestAvailable,
      topAvailable,
      opportunityCost: bestAvailable ? bestAvailable.stats.totalPoints - pick.stats.totalPoints : 0,
      vsRoundAverage: vsRound,
      vsPositionAverage: pick.stats.totalPoints - posAvg,
      valueGrade,
      valueTone
    };
  });

  // Summary stats
  const totalPicks = picksWithStats.length;
  const totalPoints = picksWithStats.reduce((sum, p) => sum + p.stats.totalPoints, 0);
  const avgPointsPerPick = totalPoints / totalPicks;
  const bestPick = picksWithStats.reduce((best, current) =>
    current.stats.totalPoints > best.stats.totalPoints ? current : best
  );
  const worstPick = picksWithStats.reduce((worst, current) =>
    current.stats.totalPoints < worst.stats.totalPoints ? current : worst
  );

  // Team draft grades
  const teamStats = {};
  picksWithOpportunityCost.forEach(pick => {
    if (!teamStats[pick.username]) {
      teamStats[pick.username] = [];
    }
    teamStats[pick.username].push(pick);
  });

  const teamGrades = Object.entries(teamStats).map(([teamName, picks]) => {
    const grade = calculateTeamDraftGrade(picks);
    return { teamName, grade, picks };
  }).sort((a, b) => b.grade.gradeScore - a.grade.gradeScore);

  return { picksWithStats, picksWithOpportunityCost, totalPicks, totalPoints, avgPointsPerPick, bestPick, worstPick, teamGrades };
})();

if (!retro) {
  display(html`
    <aside class="note note--down">
      <b>No draft data for ${selectedSeason}.</b> Pick another draft from the selector once this one has been run and synced.
    </aside>
  `);
}
```

## Draft summary

```js
if (retro) {
  const { totalPicks, totalPoints, avgPointsPerPick, bestPick, worstPick } = retro;
  display(html`
    <div class="stat-grid">
      <div class="stat">
        <div class="stat__k">Picks</div>
        <div class="stat__v">${totalPicks}</div>
      </div>
      <div class="stat">
        <div class="stat__k">Points per pick</div>
        <div class="stat__v">${avgPointsPerPick.toFixed(1)}</div>
      </div>
      <div class="stat ${totalPoints === 0 ? 'stat--muted' : 'stat--brass'}">
        <div class="stat__k">Best pick</div>
        <div class="stat__v stat--text">${totalPoints === 0 ? '—' : pickName(bestPick)}</div>
        <div class="stat__l">${totalPoints === 0 ? 'no points yet' : `${bestPick.stats.totalPoints.toFixed(1)} pts`}</div>
      </div>
      <div class="stat ${totalPoints === 0 ? 'stat--muted' : 'stat--down'}">
        <div class="stat__k">Biggest miss</div>
        <div class="stat__v stat--text">${totalPoints === 0 ? '—' : pickName(worstPick)}</div>
        <div class="stat__l">${totalPoints === 0 ? 'no points yet' : `${worstPick.stats.totalPoints.toFixed(1)} pts`}</div>
      </div>
    </div>
    ${totalPoints === 0 ? html`<p class="muted text-sm">Best pick and biggest miss fill in once points are scored.</p>` : ''}
  `);
}
```

## Team report cards

```js
if (retro) {
  const { teamGrades } = retro;
  display(html`
    <div class="stack">
      ${teamGrades.map(({ teamName, grade, picks }, i) => {
        const retainedPlayers = picks.filter(p => isPlayerOnCurrentRoster(p.player_id, p.roster_id));
        const droppedPlayers = picks.filter(p => !isPlayerOnCurrentRoster(p.player_id, p.roster_id));
        const openDetail = selectedTeam === "All Teams" ? i === 0 : teamName === selectedTeam;

        return html`
          <div class="card">
            <div class="row">
              <div>
                <div class="card__title">${teamName}</div>
                <div class="text-sm muted">${grade.totalPicks} picks · ${selectedSeason} draft</div>
              </div>
              <div class="hero-num ${grade.gradeTone} push-right">${grade.letterGrade}</div>
            </div>

            <div class="stat-grid">
              <div class="stat">
                <div class="stat__k">Retention</div>
                <div class="stat__v">${grade.retentionRate.toFixed(0)}<small>%</small></div>
                <div class="stat__l">${grade.stillOnRoster}/${grade.totalPicks} still rostered</div>
              </div>
              <div class="stat">
                <div class="stat__k">Total points</div>
                <div class="stat__v">${grade.totalPoints.toFixed(1)}</div>
                <div class="stat__l">${grade.avgPointsPerPick.toFixed(1)} per pick</div>
              </div>
              <div class="stat">
                <div class="stat__k">Average tenure</div>
                <div class="stat__v">${grade.avgWeeksOnRoster.toFixed(1)}</div>
                <div class="stat__l">weeks on roster</div>
              </div>
              <div class="stat">
                <div class="stat__k">Retained value</div>
                <div class="stat__v">${grade.pointsFromRetained.toFixed(1)}</div>
                <div class="stat__l">from ${grade.stillOnRoster} players</div>
              </div>
            </div>

            <div class="stack">
              <p class="note note--up note--line"><b>Best pick.</b> ${pickName(grade.bestPick)} · pick ${grade.bestPick.pick_no} · ${grade.bestPick.stats.totalPoints.toFixed(1)} pts</p>
              <p class="note note--down note--line"><b>Biggest miss.</b> ${pickName(grade.worstPick)} · pick ${grade.worstPick.pick_no} · ${grade.worstPick.stats.totalPoints.toFixed(1)} pts</p>
            </div>

            <details class="section-collapse" open=${openDetail}>
              <summary class="section-summary">Roster status <small>${grade.stillOnRoster} retained, ${droppedPlayers.length} moved</small></summary>
              <div class="section-content">
                ${retainedPlayers.length > 0 ? html`
                  <h4>Still on roster</h4>
                  <ul class="roster-list">
                    ${retainedPlayers.map(p => html`<li><span>${pickName(p)} <span class="muted">${p.player?.position ?? 'name pending'}</span></span><span class="mono muted">${p.tenure.pointsOnRoster.toFixed(1)} pts · ${p.tenure.weeksOnRoster} wks</span></li>`)}
                  </ul>
                ` : ''}
                ${droppedPlayers.length > 0 ? html`
                  <h4>Traded or dropped</h4>
                  <ul class="roster-list is-moved">
                    ${droppedPlayers.map(p => html`<li><span>${pickName(p)} <span class="muted">${p.player?.position ?? 'name pending'}</span></span><span class="mono muted">${p.tenure.pointsOnRoster.toFixed(1)} pts · ${p.tenure.weeksOnRoster} wks</span></li>`)}
                  </ul>
                ` : ''}
              </div>
            </details>
          </div>
        `;
      })}
    </div>
  `);
}
```

## Roster retention timeline

```js
if (retro) {
  const { teamGrades } = retro;

  // Build retention timeline: track drafted player retention year-over-year
  const retentionTriangle = [];

  // Get all available years and weeks for year-over-year tracking
  const allYears = Object.keys(matchupsAllYears).sort();
  const allYearWeeks = []; // Array of {year, week, label, sortKey}

  allYears.forEach(year => {
    const yearData = matchupsAllYears[year];
    if (yearData && yearData.matchups) {
      yearData.matchups.forEach(weekData => {
        allYearWeeks.push({
          year: year,
          week: weekData.week,
          label: `${year}.${String(weekData.week).padStart(2, '0')}`,
          sortKey: parseInt(year) * 100 + weekData.week
        });
      });
    }
  });

  // Sort by year and week
  allYearWeeks.sort((a, b) => a.sortKey - b.sortKey);

  teamGrades.forEach(({ teamName, picks }) => {
    const teamRetention = {
      team: teamName,
      totalPicks: picks.length,
      weeklyRetention: {} // Will use "YYYY.WW" format as keys
    };

    // For each year.week combination, check if drafted players are on roster
    allYearWeeks.forEach(({ year, week, label }) => {
      // Get matchups for this specific year and week
      const yearData = matchupsAllYears[year];
      if (!yearData || !yearData.matchups) return;

      const weekMatchups = yearData.matchups.find(w => w.week === week);
      if (!weekMatchups || !weekMatchups.matchups) return;

      // Find the team's matchup for this week
      const teamMatchup = weekMatchups.matchups.find(m => {
        const user = getUserByRosterId(m.roster_id);
        return user?.display_name === teamName;
      });

      if (teamMatchup) {
        // Count drafted players on roster this week
        const draftedOnRoster = picks.filter(pick => {
          return teamMatchup.players_points && teamMatchup.players_points[pick.player_id] !== undefined;
        }).length;

        teamRetention.weeklyRetention[label] = {
          count: draftedOnRoster,
          percentage: (draftedOnRoster / picks.length) * 100,
          year: year,
          week: week
        };
      }
    });

    retentionTriangle.push(teamRetention);
  });

  // Prepare data for Plot with YYYY.WK format
  // Filter to only show data from selected season onward
  const filteredYearWeeks = allYearWeeks.filter(yw => parseInt(yw.year) >= parseInt(selectedSeason));

  const retentionChartData = [];
  retentionTriangle.forEach(teamData => {
    filteredYearWeeks.forEach(({ label, sortKey }) => {
      if (teamData.weeklyRetention[label]) {
        retentionChartData.push({
          team: teamData.team,
          weekLabel: label,
          sortKey: sortKey,
          count: teamData.weeklyRetention[label].count,
          percentage: teamData.weeklyRetention[label].percentage,
          totalPicks: teamData.totalPicks
        });
      }
    });
  });

  // One highlighted team (from the team filter) drawn in brass; all others in ink.
  const highlightedTeam = selectedTeam !== "All Teams" ? selectedTeam : null;
  const lastKey = retentionChartData.length ? Math.max(...retentionChartData.map(r => r.sortKey)) : null;

  const scoredWeekCount = new Set(retentionChartData.map(r => r.sortKey)).size;
  const hasTimeline = scoredWeekCount >= 2;
  const retentionChart = !hasTimeline
    ? null
    : Plot.plot(plotTheme({
        width: Math.min(width, 800),
        height: 420,
        marginLeft: width < 640 ? 40 : 56,
        marginRight: width < 640 ? 90 : 150,
        x: {
          label: "Season.week",
          domain: filteredYearWeeks.map(w => w.sortKey),
          ticks: filteredYearWeeks.filter(w =>
            (w.week === 1 || w.week === 9 || w.week === 17)
          ).map(w => w.sortKey),
          tickFormat: d => {
            const found = filteredYearWeeks.find(w => w.sortKey === d);
            return found ? found.label : d;
          }
        },
        y: {
          label: "Drafted players still rostered",
          domain: [0, 1],
          tickFormat: d => `${(d * 100).toFixed(0)}%`
        },
        marks: [
          Plot.ruleY([0], {stroke: T.hair2}),
          Plot.line(retentionChartData, {
            x: "sortKey",
            y: d => d.percentage / 100,
            z: "team",
            curve: "monotone-x",
            ...multiLine
          }),
          highlightedTeam ? Plot.line(retentionChartData.filter(d => d.team === highlightedTeam), {
            x: "sortKey",
            y: d => d.percentage / 100,
            curve: "monotone-x",
            ...highlightLine
          }) : null,
          Plot.dot(retentionChartData, {
            x: "sortKey",
            y: d => d.percentage / 100,
            r: 2.5,
            fill: d => d.team === highlightedTeam ? T.brass : T.ink3,
            fillOpacity: d => d.team === highlightedTeam ? 1 : 0.5
          }),
          Plot.text(
            retentionChartData.filter(d => d.sortKey === lastKey),
            {
              x: "sortKey",
              y: d => d.percentage / 100,
              text: "team",
              textAnchor: "start",
              dx: 10,
              fill: d => d.team === highlightedTeam ? T.brass : T.ink3,
              fontSize: 11
            }
          ),
          Plot.tip(retentionChartData, Plot.pointer({
            x: "sortKey",
            y: d => d.percentage / 100,
            title: d => `${d.team}\n${d.weekLabel}: ${d.count}/${d.totalPicks} (${d.percentage.toFixed(0)}%)`,
            ...tipStyle
          }))
        ]
      }));

  if (!hasTimeline) {
    display(html`<aside class="note"><b>No retention data yet.</b> The timeline and matrix fill in once weeks 1 and 2 of ${selectedSeason} have been scored.</aside>`);
  } else {
    display(html`
      <div class="stack">
        <figure class="chart">
          <div class="chart__title">Drafted players still rostered, week by week</div>
          <p class="chart__sub">One line per team. ${highlightedTeam ? `${highlightedTeam} in brass.` : "Pick a team in the filter above to highlight it."}</p>
          ${retentionChart}
          <div class="chart__cap">Counts the ${selectedSeason} draft class on each roster from ${selectedSeason} onward.</div>
        </figure>

        <details class="section-collapse" open>
          <summary class="section-summary">Retention matrix <small>counts and share by week</small></summary>
          <div class="section-content">
            <div class="table-wrap">
              <table class="retention-matrix">
                <thead>
                  <tr>
                    <th class="sticky-col">Team</th>
                    <th class="num">Picks</th>
                    ${filteredYearWeeks.map(({ label }) => html`<th class="num mono">${label}</th>`)}
                  </tr>
                </thead>
                <tbody>
                  ${retentionTriangle.map((teamData) => html`<tr><td class="sticky-col">${teamData.team}</td><td class="num">${teamData.totalPicks}</td>${filteredYearWeeks.map(({ label }) => {
                    const retention = teamData.weeklyRetention[label];
                    if (!retention) return html`<td class="num muted">—</td>`;
                    const percentage = retention.percentage;
                    const heat = percentage >= 60 ? 'heat--up' : percentage >= 40 ? 'heat--mid' : 'heat--down';
                    return html`<td class="heat ${heat}"><div class="mono">${retention.count}</div><div class="text-xs muted">${percentage.toFixed(0)}%</div></td>`;
                  })}</tr>`)}
                </tbody>
              </table>
            </div>
            <p class="text-sm muted">Green cells: 60% or more of the draft class still rostered. Ember cells: under 40%. A dash means no matchup recorded for that week.</p>
          </div>
        </details>
      </div>
    `);
  }
}
```

## Individual picks

```js
if (retro) {
  const { picksWithOpportunityCost } = retro;

  // Filter picks by selected team
  const filteredPicks = selectedTeam === "All Teams"
    ? picksWithOpportunityCost
    : picksWithOpportunityCost.filter(pick => pick.username === selectedTeam);

  display(html`
    <div class="stack">
      <p class="muted text-sm">${selectedTeam !== "All Teams"
        ? `Showing ${filteredPicks.length} pick${filteredPicks.length !== 1 ? 's' : ''} by ${selectedTeam}.`
        : `${filteredPicks.length} picks in draft order. Open a pick for its season line, tenure and who was still on the board.`}</p>
      ${filteredPicks.map((pick, i) => {
    const hasPlayer = !!pick.player;
    const playerName = pickName(pick);
    const position = pick.player?.position || 'N/A';
    const team = pick.player?.team || 'N/A';
    const onRoster = isPlayerOnCurrentRoster(pick.player_id, pick.roster_id);
    const posClass = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position) ? `badge--pos-${position.toLowerCase()}` : '';

    const pickContent = html`
      <div class="stack">
        <div class="row">
          <div>
            <p class="eyebrow mb-0">Pick ${pick.pick_no} · Round ${pick.round} · Drafted by ${pick.username}</p>
            <div class="muted">${hasPlayer ? `${position} · ${team}` : 'Player name pending'}</div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="stat__k">Total points</div>
            <div class="stat__v">${pick.stats.totalPoints.toFixed(1)}</div>
          </div>
          <div class="stat">
            <div class="stat__k">Games played</div>
            <div class="stat__v">${pick.stats.gamesPlayed}</div>
          </div>
          <div class="stat">
            <div class="stat__k">Points per game</div>
            <div class="stat__v">${pick.stats.averagePoints.toFixed(1)}</div>
          </div>
          <div class="stat">
            <div class="stat__k">Best week</div>
            <div class="stat__v">${pick.stats.bestWeek.toFixed(1)}</div>
          </div>
        </div>

        ${pick.tenure.weeksOnRoster > 0 ? html`
          <div class="card card--slate card--tight">
            <div class="row">
              <div>
                <div class="card__k">Tenure on ${pick.username}</div>
                <div>Week ${pick.tenure.firstWeek} to week ${pick.tenure.lastWeek} (${pick.tenure.weeksOnRoster} ${pick.tenure.weeksOnRoster === 1 ? 'week' : 'weeks'})</div>
              </div>
              <div class="text-right push-right">
                <div class="card__k">Points on roster</div>
                <div class="card__v">${pick.tenure.pointsOnRoster.toFixed(1)}</div>
              </div>
            </div>
          </div>
        ` : html`
          <aside class="note ${anyPointsScored ? 'note--down' : ''}">
            ${!anyPointsScored
              ? html`<b>No tenure yet.</b> Appears after ${pick.username}'s first scored week.`
              : html`<b>Never appeared</b> on ${pick.username}'s roster in a scored week.`}
          </aside>
        `}

        <div class="grid grid-2">
          <div class="card card--tight">
            <div class="card__k">vs round ${pick.round} average</div>
            <div class="card__v ${pick.vsRoundAverage > 0 ? 'up' : pick.vsRoundAverage < 0 ? 'down' : ''}">${pick.vsRoundAverage > 0 ? '+' : ''}${pick.vsRoundAverage.toFixed(1)} pts</div>
          </div>
          <div class="card card--tight">
            <div class="card__k">vs ${hasPlayer ? position : 'position'} average</div>
            <div class="card__v ${pick.vsPositionAverage > 0 ? 'up' : pick.vsPositionAverage < 0 ? 'down' : ''}">${pick.vsPositionAverage > 0 ? '+' : ''}${pick.vsPositionAverage.toFixed(1)} pts</div>
          </div>
        </div>

        ${pick.topAvailable.length > 0 ? html`
          <div class="card card--accent">
            <div class="card__title">Still available at this pick</div>
            <ul class="roster-list">
              ${pick.topAvailable.map(avail => {
                const diff = avail.stats.totalPoints - pick.stats.totalPoints;
                return html`
                  <li>
                    <span>${pickName(avail)} <span class="muted text-xs">${avail.player ? `${avail.player.position || 'N/A'} · ` : ''}pick ${avail.pick_no} · ${avail.stats.totalPoints.toFixed(1)} pts</span></span>
                    <span class="mono ${diff > 0 ? 'down' : diff < 0 ? 'up' : 'muted'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</span>
                  </li>
                `;
              })}
            </ul>
            <div class="card__foot">Difference is the later pick's points minus this pick's. Positive means a better option was left on the board.</div>
          </div>
        ` : ''}
      </div>
    `;

    return html`<details class="section-collapse" open=${i === 0}>
      <summary class="section-summary">
        <span class="pick-summary">
          <span class="mono">${pick.pick_no}.</span>
          <span>${playerName}</span>
          ${hasPlayer ? html`<span class="badge ${posClass}">${position}</span>` : html`<span class="muted text-sm">name pending</span>`}
          <span class="muted text-sm">${pick.stats.totalPoints.toFixed(1)} pts · ${pick.username}</span>
          <span class="badge ${onRoster ? 'badge--up' : 'badge--down'}">${onRoster ? 'On roster' : 'Moved'}</span>
          <span class="badge ${pick.valueTone} pick-summary__push">${pick.valueGrade}</span>
        </span>
      </summary>
      <div class="section-content">
        ${pickContent}
      </div>
    </details>`;
      })}
    </div>
  `);
}
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Draft grades.</strong> A weighted score across four parts: points per pick (40%, total fantasy points divided by number of picks), retention rate (30%, share of drafted players still on the roster), average tenure (20%, weeks players stayed on the roster) and best pick (10%, points produced by the team's best pick). A-range grades are brass, D and F are ember.</li>
    <li><strong>Individual pick grades.</strong> Excellent is 50+ points above the round average; good is 20 to 49 above; average is within 20; below average is 20 to 49 below; poor is 50 or more below.</li>
    <li><strong>Retention timeline.</strong> The line chart is the share of drafted players still rostered each week, one line per team; steeper drops mean heavier waiver activity. The matrix gives exact counts and percentages by team and week: green is 60% or more retained, ember is under 40%. Higher retention is not always better; low retention with good results is smart roster management.</li>
    <li><strong>Terms.</strong> <em>On roster / moved</em>: whether the drafted player is still on the drafting team. <em>Retained value</em>: points scored by players still on the roster. <em>Still available</em>: the best later picks at the time of this pick. <em>Round and position context</em>: the pick against others drafted in the same round or at the same position. <em>Tenure</em>: weeks the player appeared on the drafting team's roster.</li>
    <li><strong>Name pending.</strong> A pick that shows only its slot ("Pick 1.03") is one whose player record has not synced yet.</li>
    <li><strong>Remember.</strong> Draft decisions are made with pre-season information. Injuries, breakouts and surprises are part of the game; this page uses hindsight to find patterns for next year's draft.</li>
  </ul>
</section>
