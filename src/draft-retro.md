<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #22c55e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Draft Retro
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #22c55e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Draft Pick Analysis & Performance Review
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Analyze every draft pick and see how players performed throughout the season. Compare actual fantasy production to identify draft steals, reaches, and missed opportunities.
  </p>
</div>

```js
// Load data
const draftData = await FileAttachment("data/draft-picks.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
const matchupsData = await FileAttachment("data/matchups.json").json();
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();

// Debug: Log data loaded
console.log('Draft data seasons:', Object.keys(draftData));
console.log('Matchups weeks (current season):', matchupsData.length);
console.log('Historical matchups years:', Object.keys(matchupsAllYears));
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

  // Determine letter grade
  let letterGrade = 'F';
  let gradeColor = '#ef4444';
  if (gradeScore >= 90) { letterGrade = 'A+'; gradeColor = '#22c55e'; }
  else if (gradeScore >= 85) { letterGrade = 'A'; gradeColor = '#22c55e'; }
  else if (gradeScore >= 80) { letterGrade = 'A-'; gradeColor = '#22c55e'; }
  else if (gradeScore >= 77) { letterGrade = 'B+'; gradeColor = '#84cc16'; }
  else if (gradeScore >= 73) { letterGrade = 'B'; gradeColor = '#84cc16'; }
  else if (gradeScore >= 70) { letterGrade = 'B-'; gradeColor = '#84cc16'; }
  else if (gradeScore >= 67) { letterGrade = 'C+'; gradeColor = '#f59e0b'; }
  else if (gradeScore >= 63) { letterGrade = 'C'; gradeColor = '#f59e0b'; }
  else if (gradeScore >= 60) { letterGrade = 'C-'; gradeColor = '#f59e0b'; }
  else if (gradeScore >= 57) { letterGrade = 'D+'; gradeColor = '#f97316'; }
  else if (gradeScore >= 53) { letterGrade = 'D'; gradeColor = '#f97316'; }
  else if (gradeScore >= 50) { letterGrade = 'D-'; gradeColor = '#f97316'; }
  else { letterGrade = 'F'; gradeColor = '#ef4444'; }

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
    gradeColor,
    gradeScore
  };
}

// Get available seasons from draft data
const availableSeasons = Object.keys(draftData).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
```

```js
// Create season selector
const selectedSeason = view(Inputs.select(
  availableSeasons,
  {
    label: "Select Season",
    value: availableSeasons[0]
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
    label: "Filter by Team",
    value: "All Teams"
  }
));
```

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">💡 Draft Postmortem Guide</h3>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Team Draft Grades (A+ to F)</h4>
  <p style="line-height: 1.8; margin-bottom: 0.5rem;">Overall team draft performance is calculated using a weighted scoring system:</p>
  <ul style="line-height: 1.8; margin-top: 0;">
    <li><strong>Points Per Pick (40% weight):</strong> Total fantasy points divided by number of picks</li>
    <li><strong>Retention Rate (30% weight):</strong> Percentage of drafted players still on your roster</li>
    <li><strong>Average Tenure (20% weight):</strong> How many weeks players stayed on your roster</li>
    <li><strong>Best Pick Quality (10% weight):</strong> Points produced by your best draft pick</li>
  </ul>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Individual Pick Grades</h4>
  <ul style="line-height: 1.8; margin-top: 0;">
    <li><strong>Excellent:</strong> +50pts above round average</li>
    <li><strong>Good:</strong> +20pts to +49pts above round average</li>
    <li><strong>Average:</strong> ±20pts of round average</li>
    <li><strong>Below Average:</strong> -20pts to -49pts below round average</li>
    <li><strong>Poor:</strong> -50pts or more below round average</li>
  </ul>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Roster Retention Timeline</h4>
  <p style="line-height: 1.8; margin-top: 0;">
    Track how many drafted players remain on each team's roster week by week throughout the season:
  </p>
  <ul style="line-height: 1.8; margin-top: 0;">
    <li><strong>Line Chart:</strong> Shows retention trends for all teams over time. Steeper drops indicate aggressive waiver wire activity</li>
    <li><strong>Retention Matrix:</strong> Detailed table showing exact counts and percentages for each team/week combination</li>
    <li><strong>Color Coding:</strong> Green (>70%) = high retention, Yellow (40-70%) = moderate, Red (<40%) = low retention</li>
    <li><strong>Interpretation:</strong> Higher retention isn't always better - successful teams may improve through trades/waivers. Low retention with good results shows smart roster management</li>
  </ul>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Key Metrics Explained</h4>
  <ul style="line-height: 1.8; margin-top: 0;">
    <li><strong>Roster Status:</strong> ✓ ON ROSTER means still on your team, ✗ MOVED means traded/dropped</li>
    <li><strong>Retained Value:</strong> Points scored by players still on your roster</li>
    <li><strong>Opportunity Cost:</strong> Shows top performers who were still available at your pick</li>
    <li><strong>Round Context:</strong> Compares player performance to others drafted in the same round</li>
    <li><strong>Position Context:</strong> Shows how the pick performed vs average for that position</li>
    <li><strong>Tenure:</strong> Weeks the player appeared on your roster during the season</li>
  </ul>

  <p style="margin-top: 1.5rem; padding: 15px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 4px; line-height: 1.8;">
    <strong>⚠️ Remember:</strong> Draft decisions are made with pre-season information. Injuries, breakouts, and unexpected performances are part of the game. This analysis uses hindsight to identify patterns and improve future draft strategy.
  </p>
</div>

```js
// Process draft picks for selected season

if (!seasonDraftData || !seasonDraftData.picks || seasonDraftData.picks.length === 0) {
  display(html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; margin: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
      <h3 style="margin: 0 0 10px 0;">No Draft Data Available</h3>
      <p style="color: var(--theme-foreground-alt); margin: 0;">Draft data for ${selectedSeason} is not available.</p>
    </div>
  `);
} else {
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

    // Calculate value grade
    let valueGrade = 'Average';
    let valueColor = '#64748b';
    const vsRound = pick.stats.totalPoints - roundAvg;

    if (vsRound > 50) {
      valueGrade = 'Excellent';
      valueColor = '#22c55e';
    } else if (vsRound > 20) {
      valueGrade = 'Good';
      valueColor = '#84cc16';
    } else if (vsRound < -50) {
      valueGrade = 'Poor';
      valueColor = '#ef4444';
    } else if (vsRound < -20) {
      valueGrade = 'Below Average';
      valueColor = '#f97316';
    }

    return {
      ...pick,
      bestAvailable,
      topAvailable,
      opportunityCost: bestAvailable ? bestAvailable.stats.totalPoints - pick.stats.totalPoints : 0,
      vsRoundAverage: vsRound,
      vsPositionAverage: pick.stats.totalPoints - posAvg,
      valueGrade,
      valueColor
    };
  });

  // Display summary stats
  const totalPicks = picksWithStats.length;
  const totalPoints = picksWithStats.reduce((sum, p) => sum + p.stats.totalPoints, 0);
  const avgPointsPerPick = totalPoints / totalPicks;

  const bestPick = picksWithStats.reduce((best, current) =>
    current.stats.totalPoints > best.stats.totalPoints ? current : best
  );

  const worstPick = picksWithStats.reduce((worst, current) =>
    current.stats.totalPoints < worst.stats.totalPoints ? current : worst
  );

  const summaryContent = html`
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid var(--theme-accent);">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">
          Total Picks
        </div>
        <div style="font-size: 32px; font-weight: bold; color: var(--theme-accent);">${totalPicks}</div>
      </div>
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #22c55e;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Avg Points Per Pick</div>
        <div style="font-size: 32px; font-weight: bold; color: #22c55e;">${avgPointsPerPick.toFixed(1)}</div>
      </div>
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #f59e0b;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Best Pick</div>
        <div style="font-size: 16px; font-weight: bold; color: #f59e0b;">
          ${bestPick.player ? `${bestPick.player.first_name} ${bestPick.player.last_name}` : 'N/A'}
        </div>
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">${bestPick.stats.totalPoints.toFixed(1)} pts</div>
      </div>
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #ef4444;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Biggest Miss</div>
        <div style="font-size: 16px; font-weight: bold; color: #ef4444;">
          ${worstPick.player ? `${worstPick.player.first_name} ${worstPick.player.last_name}` : 'N/A'}
        </div>
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">${worstPick.stats.totalPoints.toFixed(1)} pts</div>
      </div>
    </div>
  `;

  display(html`<details class="section-collapse">
    <summary class="section-summary">${selectedSeason} Draft Summary</summary>
    <div class="section-content">
      ${summaryContent}
    </div>
  </details>`);

  // Calculate and display team draft grades
  const teamStats = {};
  picksWithOpportunityCost.forEach(pick => {
    if (!teamStats[pick.username]) {
      teamStats[pick.username] = [];
    }
    teamStats[pick.username].push(pick);
  });

  // Calculate grades for each team
  const teamGrades = Object.entries(teamStats).map(([teamName, picks]) => {
    const grade = calculateTeamDraftGrade(picks);
    return { teamName, grade, picks };
  }).sort((a, b) => b.grade.gradeScore - a.grade.gradeScore);

  // Display team draft grades section
  const teamGradesContent = html`
    <div style="margin-bottom: 30px;">
      <h2 style="margin: 0 0 20px 0; font-size: 1.75rem; font-weight: 700;">Team Draft Grades</h2>
      <div style="display: grid; gap: 20px;">
        ${teamGrades.map(({ teamName, grade, picks }) => {
          const currentWeek = matchupsData.length;
          const retainedPlayers = picks.filter(p => isPlayerOnCurrentRoster(p.player_id, p.roster_id));
          const droppedPlayers = picks.filter(p => !isPlayerOnCurrentRoster(p.player_id, p.roster_id));

          const bestPickName = grade.bestPick.player
            ? `${grade.bestPick.player.first_name} ${grade.bestPick.player.last_name}`
            : 'Unknown';
          const worstPickName = grade.worstPick.player
            ? `${grade.worstPick.player.first_name} ${grade.worstPick.player.last_name}`
            : 'Unknown';

          return html`
            <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; position: relative; overflow: hidden;">
              <!-- Grade Badge -->
              <div style="position: absolute; top: 20px; right: 20px; width: 80px; height: 80px; background: ${grade.gradeColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px ${grade.gradeColor}40;">
                <div style="font-size: 32px; font-weight: 900; color: white;">${grade.letterGrade}</div>
              </div>

              <!-- Team Header -->
              <div style="margin-bottom: 20px; padding-right: 100px;">
                <h3 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700;">${teamName}</h3>
                <div style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.6);">
                  ${grade.totalPicks} draft picks • ${selectedSeason} Season
                </div>
              </div>

              <!-- Key Metrics Grid -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Retention</div>
                  <div style="font-size: 1.5rem; font-weight: 700; color: ${grade.retentionRate > 50 ? '#22c55e' : '#f59e0b'};">
                    ${grade.retentionRate.toFixed(0)}%
                  </div>
                  <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">
                    ${grade.stillOnRoster}/${grade.totalPicks} still rostered
                  </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 3px solid #8b5cf6;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Total Points</div>
                  <div style="font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">${grade.totalPoints.toFixed(1)}</div>
                  <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">
                    ${grade.avgPointsPerPick.toFixed(1)} per pick
                  </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Avg Tenure</div>
                  <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">
                    ${grade.avgWeeksOnRoster.toFixed(1)}
                  </div>
                  <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">
                    weeks on roster
                  </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 3px solid #22c55e;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Retained Value</div>
                  <div style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">${grade.pointsFromRetained.toFixed(1)}</div>
                  <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">
                    from ${grade.stillOnRoster} players
                  </div>
                </div>
              </div>

              <!-- Best/Worst Picks -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div style="background: rgba(34, 197, 94, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.2);">
                  <div style="font-size: 0.75rem; color: #22c55e; font-weight: 600; margin-bottom: 4px;">BEST PICK</div>
                  <div style="font-weight: 600;">${bestPickName}</div>
                  <div style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.6);">
                    Pick ${grade.bestPick.pick_no} • ${grade.bestPick.stats.totalPoints.toFixed(1)} pts
                  </div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">
                  <div style="font-size: 0.75rem; color: #ef4444; font-weight: 600; margin-bottom: 4px;">BIGGEST MISS</div>
                  <div style="font-weight: 600;">${worstPickName}</div>
                  <div style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.6);">
                    Pick ${grade.worstPick.pick_no} • ${grade.worstPick.stats.totalPoints.toFixed(1)} pts
                  </div>
                </div>
              </div>

              <!-- Roster Status Details -->
              <details style="background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; cursor: pointer;">
                <summary style="font-size: 0.875rem; font-weight: 600; color: rgba(255, 255, 255, 0.8); cursor: pointer;">
                  View Detailed Roster Status (${grade.stillOnRoster} retained, ${droppedPlayers.length} moved)
                </summary>
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                  ${retainedPlayers.length > 0 ? html`
                    <div style="margin-bottom: 12px;">
                      <div style="font-size: 0.75rem; color: #22c55e; font-weight: 600; margin-bottom: 6px;">✓ STILL ON ROSTER</div>
                      ${retainedPlayers.map(p => {
                        const pName = p.player ? `${p.player.first_name} ${p.player.last_name}` : 'Unknown';
                        return html`
                          <div style="font-size: 0.875rem; padding: 4px 0; display: flex; justify-content: space-between;">
                            <span>${pName} (${p.player?.position})</span>
                            <span style="color: rgba(255, 255, 255, 0.6);">${p.tenure.pointsOnRoster.toFixed(1)} pts • ${p.tenure.weeksOnRoster} wks</span>
                          </div>
                        `;
                      })}
                    </div>
                  ` : ''}
                  ${droppedPlayers.length > 0 ? html`
                    <div>
                      <div style="font-size: 0.75rem; color: #ef4444; font-weight: 600; margin-bottom: 6px;">✗ TRADED/DROPPED</div>
                      ${droppedPlayers.map(p => {
                        const pName = p.player ? `${p.player.first_name} ${p.player.last_name}` : 'Unknown';
                        return html`
                          <div style="font-size: 0.875rem; padding: 4px 0; display: flex; justify-content: space-between; opacity: 0.7;">
                            <span>${pName} (${p.player?.position})</span>
                            <span style="color: rgba(255, 255, 255, 0.6);">${p.tenure.pointsOnRoster.toFixed(1)} pts • ${p.tenure.weeksOnRoster} wks</span>
                          </div>
                        `;
                      })}
                    </div>
                  ` : ''}
                </div>
              </details>
            </div>
          `;
        })}
      </div>
    </div>
  `;

  display(html`<details class="section-collapse">
    <summary class="section-summary">Team Draft Report Cards</summary>
    <div class="section-content">
      ${teamGradesContent}
    </div>
  </details>`);

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

  // Debug: Log retention data
  console.log('Retention triangle data points:', retentionChartData.length);
  console.log('Sample data:', retentionChartData.slice(0, 3));

  // Create color scale for teams
  const teamColors = {};
  teamGrades.forEach((team, i) => {
    const hue = (i * 360 / teamGrades.length);
    teamColors[team.teamName] = `hsl(${hue}, 70%, 60%)`;
  });

  // Display retention timeline
  const actuarialContent = html`
    <div style="margin-bottom: 30px;">
      <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; align-items: start; gap: 16px; margin-bottom: 20px;">
          <div style="font-size: 2rem; line-height: 1;">📊</div>
          <div style="flex: 1;">
            <h2 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">Draft Pick Retention Timeline</h2>
            <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 0.9375rem; line-height: 1.6;">
              Track roster continuity throughout the season. This analysis shows how draft capital is managed over time—whether teams hold their picks or actively work the waiver wire.
            </p>
          </div>
        </div>

        <!-- Retention Percentage Chart -->
        <div style="background: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          ${Plot.plot({
            width: 1000,
            height: 450,
            marginLeft: 70,
            marginRight: 150,
            marginBottom: 60,
            marginTop: 30,
            style: {
              background: "transparent",
              fontSize: "13px"
            },
            x: {
              label: "Timeline →",
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
              label: "↑ Retention Rate (%)",
              grid: true,
              domain: [0, 1],
              tickFormat: d => `${(d * 100).toFixed(0)}%`
            },
            marks: [
              Plot.ruleY([0]),
              Plot.line(retentionChartData, {
                x: "sortKey",
                y: d => d.percentage / 100,
                stroke: "team",
                strokeWidth: 3,
                curve: "monotone-x"
              }),
              Plot.dot(retentionChartData, {
                x: "sortKey",
                y: d => d.percentage / 100,
                fill: "team",
                r: 5,
                stroke: "rgba(0, 0, 0, 0.3)",
                strokeWidth: 1.5
              }),
              Plot.text(
                retentionChartData.filter(d => d.sortKey === Math.max(...retentionChartData.map(r => r.sortKey))),
                {
                  x: "sortKey",
                  y: d => d.percentage / 100,
                  text: "team",
                  textAnchor: "start",
                  dx: 10,
                  fill: "team",
                  fontSize: 12,
                  fontWeight: 600
                }
              )
            ],
            color: {
              legend: false,
              domain: teamGrades.map(t => t.teamName),
              range: teamGrades.map(t => teamColors[t.teamName])
            }
          })}
        </div>

        <!-- Legend -->
        <div style="display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
          ${teamGrades.map(({ teamName }) => html`
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 20px; height: 3px; background: ${teamColors[teamName]}; border-radius: 2px;"></div>
              <span style="font-size: 0.8125rem; color: rgba(255, 255, 255, 0.8);">${teamName}</span>
            </div>
          `)}
        </div>
      </div>

      <!-- Retention Data Table -->
      <details style="background: var(--theme-background-alt); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;">
        <summary style="cursor: pointer; font-weight: 600; padding: 16px 20px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%); user-select: none; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1rem; color: #8b5cf6;">📋</span>
          <span>Detailed Retention Matrix</span>
        </summary>
        <div style="padding: 20px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem; min-width: 800px;">
            <thead>
              <tr>
                <th style="padding: 12px 16px; text-align: left; background: rgba(139, 92, 246, 0.15); border-bottom: 2px solid rgba(139, 92, 246, 0.3); position: sticky; left: 0; z-index: 3; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255, 255, 255, 0.9);">Team</th>
                <th style="padding: 12px 16px; text-align: center; background: rgba(139, 92, 246, 0.15); border-bottom: 2px solid rgba(139, 92, 246, 0.3); font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255, 255, 255, 0.9);">Picks</th>
                ${filteredYearWeeks.map(({ label }) => html`
                  <th style="padding: 12px 8px; text-align: center; background: rgba(139, 92, 246, 0.15); border-bottom: 2px solid rgba(139, 92, 246, 0.3); font-size: 0.6875rem; font-weight: 600; color: rgba(255, 255, 255, 0.7);">${label}</th>
                `)}
              </tr>
            </thead>
            <tbody>
              ${retentionTriangle.map((teamData, idx) => {
                return html`
                  <tr style="background: ${idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'};">
                    <td style="padding: 10px 16px; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.05); position: sticky; left: 0; background: ${idx % 2 === 0 ? 'rgba(30, 30, 40, 0.95)' : 'rgba(20, 20, 30, 0.95)'}; z-index: 2; white-space: nowrap; color: rgba(255, 255, 255, 0.95);">${teamData.team}</td>
                    <td style="padding: 10px 16px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.6); font-weight: 600; font-size: 0.875rem;">${teamData.totalPicks}</td>
                    ${filteredYearWeeks.map(({ label }) => {
                      const retention = teamData.weeklyRetention[label];
                      if (!retention) {
                        return html`<td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3);">—</td>`;
                      }
                      const percentage = retention.percentage;
                      let bgColor = 'transparent';
                      let textColor = 'rgba(255, 255, 255, 0.6)';

                      if (percentage >= 80) {
                        bgColor = 'rgba(34, 197, 94, 0.25)';
                        textColor = '#86efac';
                      } else if (percentage >= 60) {
                        bgColor = 'rgba(34, 197, 94, 0.15)';
                        textColor = '#86efac';
                      } else if (percentage >= 40) {
                        bgColor = 'rgba(251, 191, 36, 0.15)';
                        textColor = '#fbbf24';
                      } else if (percentage >= 20) {
                        bgColor = 'rgba(239, 68, 68, 0.15)';
                        textColor = '#fca5a5';
                      } else {
                        bgColor = 'rgba(239, 68, 68, 0.25)';
                        textColor = '#ef4444';
                      }

                      return html`
                        <td style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: ${bgColor};">
                          <div style="font-weight: 700; color: ${textColor}; font-size: 0.875rem;">${retention.count}</div>
                          <div style="font-size: 0.625rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">${retention.percentage.toFixed(0)}%</div>
                        </td>
                      `;
                    })}
                  </tr>
                `;
              })}
            </tbody>
          </table>

          <div style="margin-top: 20px; padding: 16px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 6px;">
            <div style="font-weight: 700; color: #8b5cf6; margin-bottom: 8px; font-size: 0.875rem;">Color Scale Guide</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; font-size: 0.8125rem; line-height: 1.5;">
              <div><span style="color: #86efac;">●</span> <strong>80%+</strong> Elite Retention</div>
              <div><span style="color: #86efac;">●</span> <strong>60-79%</strong> High Retention</div>
              <div><span style="color: #fbbf24;">●</span> <strong>40-59%</strong> Moderate Churn</div>
              <div><span style="color: #fca5a5;">●</span> <strong>20-39%</strong> High Churn</div>
              <div><span style="color: #ef4444;">●</span> <strong>&lt;20%</strong> Extensive Churn</div>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;

  display(html`<details class="section-collapse">
    <summary class="section-summary">Roster Retention Timeline</summary>
    <div class="section-content">
      ${actuarialContent}
    </div>
  </details>`);

  // Filter picks by selected team
  const filteredPicks = selectedTeam === "All Teams"
    ? picksWithOpportunityCost
    : picksWithOpportunityCost.filter(pick => pick.username === selectedTeam);

  // Build all individual picks content
  const individualPicksContent = html`
    <div style="margin-bottom: 30px;">
      ${selectedTeam !== "All Teams" ? html`
        <div style="padding: 15px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: 600; color: #8b5cf6;">
            Showing ${filteredPicks.length} pick${filteredPicks.length !== 1 ? 's' : ''} by ${selectedTeam}
          </div>
        </div>
      ` : ''}
      ${filteredPicks.map((pick) => {
    const playerName = pick.player ? `${pick.player.first_name} ${pick.player.last_name}` : 'Unknown Player';
    const position = pick.player?.position || 'N/A';
    const team = pick.player?.team || 'N/A';
    const onRoster = isPlayerOnCurrentRoster(pick.player_id, pick.roster_id);

    const pickContent = html`
      <div style="margin-bottom: 20px;">
        <!-- Pick Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: var(--theme-foreground-alt); text-transform: uppercase; letter-spacing: 0.05em;">
              Pick ${pick.pick_no} • Round ${pick.round} • Drafted by ${pick.username}
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-top: 5px;">
              <div style="font-size: 24px; font-weight: bold;">
                ${playerName}
              </div>
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.75rem; background: ${onRoster ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1px solid ${onRoster ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; color: ${onRoster ? '#22c55e' : '#ef4444'};">
                ${onRoster ? '✓ ON ROSTER' : '✗ MOVED'}
              </div>
            </div>
            <div style="font-size: 16px; color: var(--theme-foreground-alt); margin-top: 2px;">
              ${position} • ${team}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 0.5rem 1rem; background: ${pick.valueColor}20; border: 1px solid ${pick.valueColor}40; border-radius: 0.5rem; font-weight: 600; color: ${pick.valueColor};">
              ${pick.valueGrade}
            </div>
          </div>
        </div>

        <!-- Performance Stats -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Total Points</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${pick.stats.totalPoints.toFixed(1)}</div>
          </div>
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Games Played</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${pick.stats.gamesPlayed}</div>
          </div>
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Avg PPG</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${pick.stats.averagePoints.toFixed(1)}</div>
          </div>
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Best Week</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${pick.stats.bestWeek.toFixed(1)}</div>
          </div>
        </div>

        <!-- Tenure Information -->
        ${pick.tenure.weeksOnRoster > 0 ? html`
          <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%); border-left: 4px solid #8b5cf6; padding: 15px 20px; margin-bottom: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
              <div>
                <div style="font-size: 12px; color: var(--theme-foreground-alt); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">
                  Tenure on ${pick.username}
                </div>
                <div style="font-size: 16px; font-weight: 600; color: #8b5cf6;">
                  Week ${pick.tenure.firstWeek} - Week ${pick.tenure.lastWeek} (${pick.tenure.weeksOnRoster} ${pick.tenure.weeksOnRoster === 1 ? 'week' : 'weeks'})
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 2px;">Points on Roster</div>
                <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${pick.tenure.pointsOnRoster.toFixed(1)}</div>
              </div>
            </div>
          </div>
        ` : html`
          <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 15px 20px; margin-bottom: 20px; border-radius: 8px;">
            <div style="font-size: 14px; color: #ef4444; font-weight: 600;">
              ⚠️ Player never appeared on ${pick.username}'s roster
            </div>
          </div>
        `}

        <!-- Comparison Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">vs Round ${pick.round} Average</div>
            <div style="font-size: 20px; font-weight: bold; color: ${pick.vsRoundAverage > 0 ? '#22c55e' : '#ef4444'};">
              ${pick.vsRoundAverage > 0 ? '+' : ''}${pick.vsRoundAverage.toFixed(1)} pts
            </div>
          </div>
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 5px;">vs ${position} Average</div>
            <div style="font-size: 20px; font-weight: bold; color: ${pick.vsPositionAverage > 0 ? '#22c55e' : '#ef4444'};">
              ${pick.vsPositionAverage > 0 ? '+' : ''}${pick.vsPositionAverage.toFixed(1)} pts
            </div>
          </div>
        </div>

        <!-- Opportunity Cost Section -->
        ${pick.topAvailable.length > 0 ? html`
          <div style="background: var(--theme-background-alt); padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <div style="font-size: 14px; font-weight: bold; color: #f59e0b; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em;">
              Players Still Available
            </div>
            ${pick.topAvailable.map(avail => {
              const availName = avail.player ? `${avail.player.first_name} ${avail.player.last_name}` : 'Unknown';
              const diff = avail.stats.totalPoints - pick.stats.totalPoints;
              return html`
                <div style="padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-weight: 600;">${availName}</div>
                      <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                        ${avail.player?.position || 'N/A'} • Pick ${avail.pick_no} • ${avail.stats.totalPoints.toFixed(1)} pts
                      </div>
                    </div>
                    <div style="font-size: 18px; font-weight: bold; color: ${diff > 0 ? '#ef4444' : '#22c55e'};">
                      ${diff > 0 ? '+' : ''}${diff.toFixed(1)}
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;

    return html`<details class="section-collapse">
      <summary class="section-summary">
        <span style="font-weight: 600;">${pick.pick_no}.</span> ${playerName}
        <span style="color: var(--theme-foreground-alt); font-weight: normal;">• ${position} • ${pick.stats.totalPoints.toFixed(1)} pts • ${pick.username}</span>
        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.25rem 0.6rem; background: ${onRoster ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1px solid ${onRoster ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; color: ${onRoster ? '#22c55e' : '#ef4444'};">
          ${onRoster ? '✓' : '✗'}
        </span>
        <span style="margin-left: auto; padding: 0.25rem 0.75rem; background: ${pick.valueColor}20; border-radius: 0.25rem; font-size: 0.875rem; color: ${pick.valueColor};">
          ${pick.valueGrade}
        </span>
      </summary>
      <div class="section-content">
        ${pickContent}
      </div>
    </details>`;
      })}
    </div>
  `;

  display(html`<details class="section-collapse">
    <summary class="section-summary">Individual Draft Picks (${filteredPicks.length})</summary>
    <div class="section-content">
      ${individualPicksContent}
    </div>
  </details>`);
}
```
