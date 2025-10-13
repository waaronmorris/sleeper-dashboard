<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Draft Overview
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    League-Wide Draft Performance & Retention Analysis
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Comprehensive draft analysis across all seasons. Track retention trends, compare draft performance year-over-year, and identify which teams excel at building through the draft.
  </p>
</div>

```js
// Load data
const draftData = await FileAttachment("data/draft-picks.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();

// Debug: Log data loaded
console.log('Draft data seasons:', Object.keys(draftData));
console.log('Historical matchups years:', Object.keys(matchupsAllYears));
```

```js
// Helper function to get user by roster ID (works across seasons)
function getUserByRosterId(rosterId, seasonData) {
  // Try to find user in current season first
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (roster) {
    return users.find(u => u.user_id === roster.owner_id);
  }
  return null;
}

// Helper function to get player name
function getPlayerName(playerId) {
  const player = players[playerId];
  if (!player) return playerId;
  return `${player.first_name} ${player.last_name}`;
}

// Calculate retention for a specific draft across weeks
function calculateDraftRetention(season, draftPicks, yearMatchups) {
  const retentionByWeek = [];

  if (!yearMatchups || !yearMatchups.matchups) return retentionByWeek;

  // For each week in the season
  yearMatchups.matchups.forEach(weekData => {
    const weekRetention = {
      week: weekData.week,
      teamRetention: {}
    };

    // Group draft picks by roster
    const picksByRoster = {};
    draftPicks.forEach(pick => {
      if (!picksByRoster[pick.roster_id]) {
        picksByRoster[pick.roster_id] = [];
      }
      picksByRoster[pick.roster_id].push(pick.player_id);
    });

    // For each team, count how many drafted players are on roster this week
    Object.entries(picksByRoster).forEach(([rosterId, draftedPlayers]) => {
      const matchup = weekData.matchups.find(m => m.roster_id === parseInt(rosterId));
      if (matchup && matchup.players_points) {
        const draftedOnRoster = draftedPlayers.filter(
          playerId => matchup.players_points[playerId] !== undefined
        ).length;

        weekRetention.teamRetention[rosterId] = {
          count: draftedOnRoster,
          total: draftedPlayers.length,
          percentage: (draftedOnRoster / draftedPlayers.length) * 100
        };
      }
    });

    retentionByWeek.push(weekRetention);
  });

  return retentionByWeek;
}

// Calculate end-of-season retention for each season
const seasonRetentionData = [];
const availableSeasons = Object.keys(draftData).sort((a, b) => b.localeCompare(a));

availableSeasons.forEach(season => {
  const seasonDraft = draftData[season];
  const yearMatchups = matchupsAllYears[season];

  if (!seasonDraft || !seasonDraft.picks || !yearMatchups) return;

  const retentionByWeek = calculateDraftRetention(season, seasonDraft.picks, yearMatchups);

  // Get final week retention
  if (retentionByWeek.length > 0) {
    const finalWeek = retentionByWeek[retentionByWeek.length - 1];

    // Calculate league-wide retention for this season
    let totalDrafted = 0;
    let totalRetained = 0;

    Object.values(finalWeek.teamRetention).forEach(teamData => {
      totalDrafted += teamData.total;
      totalRetained += teamData.count;
    });

    seasonRetentionData.push({
      season: season,
      totalDrafted: totalDrafted,
      totalRetained: totalRetained,
      retentionRate: (totalRetained / totalDrafted) * 100,
      weeks: retentionByWeek.length,
      teamCount: Object.keys(finalWeek.teamRetention).length
    });
  }
});

console.log('Season retention data:', seasonRetentionData);
```

## League-Wide Draft Retention by Season

<div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 24px; margin: 2rem 0;">
  <div style="display: flex; align-items: start; gap: 16px; margin-bottom: 20px;">
    <div style="font-size: 2rem; line-height: 1;">📊</div>
    <div style="flex: 1;">
      <h2 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">Season-by-Season Retention Trends</h2>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 0.9375rem; line-height: 1.6;">
        Track how draft capital is managed across different seasons. Higher retention may indicate successful drafts or conservative roster management, while lower retention shows active waiver wire strategy.
      </p>
    </div>
  </div>

  ```js
  display(Plot.plot({
    width: 1000,
    height: 400,
    marginLeft: 70,
    marginRight: 40,
    marginBottom: 60,
    marginTop: 30,
    style: {
      background: "transparent",
      fontSize: "13px"
    },
    x: {
      label: "Season →",
      labelAnchor: "center"
    },
    y: {
      label: "↑ End-of-Season Retention Rate (%)",
      grid: true,
      domain: [0, 100]
    },
    marks: [
      Plot.ruleY([0]),
      Plot.line(seasonRetentionData, {
        x: "season",
        y: "retentionRate",
        stroke: "#8b5cf6",
        strokeWidth: 3,
        curve: "catmull-rom"
      }),
      Plot.dot(seasonRetentionData, {
        x: "season",
        y: "retentionRate",
        fill: "#8b5cf6",
        r: 6,
        stroke: "white",
        strokeWidth: 2
      }),
      Plot.text(seasonRetentionData, {
        x: "season",
        y: "retentionRate",
        text: d => `${d.retentionRate.toFixed(1)}%`,
        dy: -15,
        fill: "#e2e8f0",
        fontSize: 12,
        fontWeight: 600
      })
    ]
  }))
  ```
</div>

## Season Comparison Table

```js
// Create detailed table data
const seasonComparisonData = seasonRetentionData.map(s => ({
  Season: s.season,
  "Total Drafted": s.totalDrafted,
  "Still on Rosters": s.totalRetained,
  "Retention Rate": `${s.retentionRate.toFixed(1)}%`,
  "Weeks Played": s.weeks,
  "Teams": s.teamCount
}));

display(html`
  <div style="background: var(--theme-background-alt); border-radius: 12px; padding: 24px; margin: 2rem 0; overflow-x: auto;">
    <h3 style="margin-top: 0; color: #8b5cf6; font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">📈 Detailed Season Statistics</h3>
    ${Inputs.table(seasonComparisonData, {
      width: {
        Season: 100,
        "Total Drafted": 120,
        "Still on Rosters": 140,
        "Retention Rate": 120,
        "Weeks Played": 120,
        "Teams": 80
      }
    })}
  </div>
`);
```

## All-Time Team Retention Performance

```js
// Calculate all-time retention for each team across all seasons
const allTimeTeamRetention = {};

availableSeasons.forEach(season => {
  const seasonDraft = draftData[season];
  const yearMatchups = matchupsAllYears[season];

  if (!seasonDraft || !seasonDraft.picks || !yearMatchups) return;

  const retentionByWeek = calculateDraftRetention(season, seasonDraft.picks, yearMatchups);

  if (retentionByWeek.length > 0) {
    const finalWeek = retentionByWeek[retentionByWeek.length - 1];

    // For each team in this season
    Object.entries(finalWeek.teamRetention).forEach(([rosterId, teamData]) => {
      const user = getUserByRosterId(parseInt(rosterId));
      const teamName = user?.display_name || `Team ${rosterId}`;

      if (!allTimeTeamRetention[teamName]) {
        allTimeTeamRetention[teamName] = {
          teamName: teamName,
          totalDrafted: 0,
          totalRetained: 0,
          seasons: []
        };
      }

      allTimeTeamRetention[teamName].totalDrafted += teamData.total;
      allTimeTeamRetention[teamName].totalRetained += teamData.count;
      allTimeTeamRetention[teamName].seasons.push({
        season: season,
        drafted: teamData.total,
        retained: teamData.count,
        rate: teamData.percentage
      });
    });
  }
});

// Convert to array and calculate averages
const allTimeTeamStats = Object.values(allTimeTeamRetention).map(team => ({
  ...team,
  retentionRate: (team.totalRetained / team.totalDrafted) * 100,
  avgPerSeason: team.totalDrafted / team.seasons.length,
  seasonsPlayed: team.seasons.length
})).sort((a, b) => b.retentionRate - a.retentionRate);

console.log('All-time team retention:', allTimeTeamStats);
```

<div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px; padding: 24px; margin: 2rem 0;">
  <div style="display: flex; align-items: start; gap: 16px; margin-bottom: 20px;">
    <div style="font-size: 2rem; line-height: 1;">🏆</div>
    <div style="flex: 1;">
      <h2 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700; color: #22c55e;">All-Time Team Retention Rankings</h2>
      <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 0.9375rem; line-height: 1.6;">
        Which teams build through the draft and stick with their picks? Compare retention rates across all seasons to see who trusts their draft strategy vs. who works the waiver wire.
      </p>
    </div>
  </div>

  ```js
  display(Plot.plot({
    width: 1000,
    height: allTimeTeamStats.length * 45 + 100,
    marginLeft: 180,
    marginRight: 100,
    marginBottom: 60,
    marginTop: 30,
    style: {
      background: "transparent",
      fontSize: "13px"
    },
    x: {
      label: "All-Time Retention Rate (%) →",
      grid: true,
      domain: [0, 100]
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(allTimeTeamStats, {
        x: "retentionRate",
        y: "teamName",
        fill: d => {
          const rate = d.retentionRate;
          if (rate >= 70) return "#22c55e";
          if (rate >= 60) return "#84cc16";
          if (rate >= 50) return "#fbbf24";
          if (rate >= 40) return "#f97316";
          return "#ef4444";
        },
        sort: { y: "-x" },
        rx: 6
      }),
      Plot.text(allTimeTeamStats, {
        x: "retentionRate",
        y: "teamName",
        text: d => `${d.retentionRate.toFixed(1)}%`,
        dx: 10,
        textAnchor: "start",
        fill: "#f8fafc",
        fontSize: 13,
        fontWeight: 700
      }),
      Plot.text(allTimeTeamStats, {
        x: 0,
        y: "teamName",
        text: d => `${d.totalRetained}/${d.totalDrafted} (${d.seasonsPlayed} seasons)`,
        dx: -10,
        textAnchor: "end",
        fill: "#94a3b8",
        fontSize: 11,
        fontWeight: 500
      }),
      Plot.ruleX([0])
    ]
  }))
  ```

  <div style="margin-top: 20px; padding: 16px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 6px;">
    <div style="font-weight: 700; color: #8b5cf6; margin-bottom: 8px; font-size: 0.875rem;">Understanding Retention Rates</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; font-size: 0.8125rem; line-height: 1.5;">
      <div><span style="color: #22c55e;">●</span> <strong>70%+</strong> Elite</div>
      <div><span style="color: #84cc16;">●</span> <strong>60-69%</strong> High</div>
      <div><span style="color: #fbbf24;">●</span> <strong>50-59%</strong> Moderate</div>
      <div><span style="color: #f97316;">●</span> <strong>40-49%</strong> Low</div>
      <div><span style="color: #ef4444;">●</span> <strong>&lt;40%</strong> Very Low</div>
    </div>
  </div>
</div>

## Team-by-Team Season Breakdown

```js
// Create detailed breakdown for each team
const teamSeasonBreakdown = allTimeTeamStats.map(team => {
  const seasonDetails = team.seasons.map(s => ({
    Season: s.season,
    Drafted: s.drafted,
    Retained: s.retained,
    "Retention Rate": `${s.rate.toFixed(1)}%`
  }));

  return html`
    <details style="background: var(--theme-background-alt); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; margin-bottom: 1rem;">
      <summary style="cursor: pointer; font-weight: 600; padding: 16px 20px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%); user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1rem; color: ${
            team.retentionRate >= 70 ? '#22c55e' :
            team.retentionRate >= 60 ? '#84cc16' :
            team.retentionRate >= 50 ? '#fbbf24' :
            team.retentionRate >= 40 ? '#f97316' : '#ef4444'
          };">●</span>
          <span style="font-size: 1rem;">${team.teamName}</span>
        </div>
        <div style="display: flex; gap: 16px; font-size: 0.875rem; color: rgba(255, 255, 255, 0.7);">
          <span><strong>${team.retentionRate.toFixed(1)}%</strong> overall</span>
          <span>${team.totalRetained}/${team.totalDrafted} retained</span>
          <span>${team.seasonsPlayed} seasons</span>
        </div>
      </summary>
      <div style="padding: 20px;">
        ${Inputs.table(seasonDetails, {
          width: {
            Season: 100,
            Drafted: 100,
            Retained: 100,
            "Retention Rate": 150
          }
        })}
      </div>
    </details>
  `;
});

display(html`
  <div style="margin: 2rem 0;">
    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #8b5cf6;">📋 Individual Team Performance</h2>
    <p style="color: #cbd5e1; font-size: 0.9375rem; margin-bottom: 1.5rem; line-height: 1.6;">
      Expand any team to see their retention performance across all seasons they've participated in.
    </p>
    ${teamSeasonBreakdown}
  </div>
`);
```

## Key Insights

```js
// Calculate interesting insights
const avgRetention = seasonRetentionData.reduce((sum, s) => sum + s.retentionRate, 0) / seasonRetentionData.length;
const highestRetentionSeason = seasonRetentionData.reduce((max, s) => s.retentionRate > max.retentionRate ? s : max);
const lowestRetentionSeason = seasonRetentionData.reduce((min, s) => s.retentionRate < min.retentionRate ? s : min);
const topTeam = allTimeTeamStats[0];
const bottomTeam = allTimeTeamStats[allTimeTeamStats.length - 1];

display(html`
  <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 24px; margin: 2rem 0;">
    <h2 style="margin: 0 0 1.5rem 0; font-size: 1.5rem; font-weight: 700; color: #60a5fa; display: flex; align-items: center; gap: 0.75rem;">
      <span>💡</span>
      <span>League Insights</span>
    </h2>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
      <div style="background: rgba(0, 0, 0, 0.2); padding: 16px; border-radius: 8px; border-left: 3px solid #3b82f6;">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">League Average</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: #3b82f6;">${avgRetention.toFixed(1)}%</div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">across all seasons</div>
      </div>

      <div style="background: rgba(0, 0, 0, 0.2); padding: 16px; border-radius: 8px; border-left: 3px solid #22c55e;">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Highest Retention Season</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: #22c55e;">${highestRetentionSeason.season}</div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">${highestRetentionSeason.retentionRate.toFixed(1)}% retention</div>
      </div>

      <div style="background: rgba(0, 0, 0, 0.2); padding: 16px; border-radius: 8px; border-left: 3px solid #ef4444;">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Lowest Retention Season</div>
        <div style="font-size: 1.75rem; font-weight: 700; color: #ef4444;">${lowestRetentionSeason.season}</div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">${lowestRetentionSeason.retentionRate.toFixed(1)}% retention</div>
      </div>

      <div style="background: rgba(0, 0, 0, 0.2); padding: 16px; border-radius: 8px; border-left: 3px solid #f59e0b;">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Most Loyal to Draft</div>
        <div style="font-size: 1rem; font-weight: 700; color: #f59e0b; margin-bottom: 2px;">${topTeam.teamName}</div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5);">${topTeam.retentionRate.toFixed(1)}% retention</div>
      </div>

      <div style="background: rgba(0, 0, 0, 0.2); padding: 16px; border-radius: 8px; border-left: 3px solid #8b5cf6;">
        <div style="font-size: 0.75rem; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.05em; margin-bottom: 4px;">Most Active on Waivers</div>
        <div style="font-size: 1rem; font-weight: 700; color: #8b5cf6; margin-bottom: 2px;">${bottomTeam.teamName}</div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5);">${bottomTeam.retentionRate.toFixed(1)}% retention</div>
      </div>
    </div>

    <div style="margin-top: 1.5rem; padding: 15px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 4px; line-height: 1.8;">
      <strong>💭 Analysis:</strong> ${
        avgRetention > 60
          ? "The league shows strong draft loyalty with teams generally trusting their draft picks throughout the season."
          : avgRetention > 50
          ? "The league balances draft picks with waiver wire activity, showing moderate roster turnover."
          : "The league is highly active on waivers with teams frequently improving rosters beyond their initial draft."
      }
    </div>
  </div>
`);
```

<div style="margin-top: 3rem; padding: 2rem; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0; color: var(--theme-accent);">💡 Understanding Draft Retention</h3>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">What is Draft Retention?</h4>
  <p style="line-height: 1.8;">
    Draft retention measures what percentage of your drafted players are still on your roster at the end of the season. It's calculated by dividing the number of drafted players remaining on your roster by the total number of picks you made.
  </p>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">High vs. Low Retention</h4>
  <ul style="line-height: 1.8;">
    <li><strong>High Retention (70%+):</strong> Indicates successful draft strategy, player loyalty, or conservative roster management. You drafted well and stuck with your picks.</li>
    <li><strong>Moderate Retention (50-69%):</strong> Balanced approach mixing draft picks with strategic waiver wire additions and trades.</li>
    <li><strong>Low Retention (&lt;50%):</strong> Aggressive waiver wire strategy, poor draft performance, or active trading. You're constantly improving your roster.</li>
  </ul>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Neither is "Better"</h4>
  <p style="line-height: 1.8;">
    High retention isn't always good and low retention isn't always bad. What matters is <strong>results</strong>. A championship team with 30% retention found gold on waivers. A last-place team with 80% retention drafted poorly and didn't adapt. The key is <strong>winning</strong>, not loyalty to draft picks.
  </p>

  <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--theme-accent);">Season Trends</h4>
  <p style="line-height: 1.8;">
    League-wide retention trends can reveal interesting patterns:
  </p>
  <ul style="line-height: 1.8;">
    <li><strong>Increasing retention over time:</strong> League is maturing, managers are getting better at drafting</li>
    <li><strong>Decreasing retention over time:</strong> League is becoming more competitive with active waiver wire play</li>
    <li><strong>Stable retention:</strong> League has found its equilibrium between drafting and roster churn</li>
  </ul>

  <p style="margin-top: 1.5rem; padding: 15px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; border-radius: 4px; line-height: 1.8;">
    <strong>⚠️ Remember:</strong> Use this data to understand your league's behavior patterns. Are you more conservative or aggressive than your league average? Does your retention rate correlate with your success? There's no "right" answer—only what works for your strategy.
  </p>
</div>
