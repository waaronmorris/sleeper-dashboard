# Sleeper Analytics Pro

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

// Load data
const league = await FileAttachment("data/league.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const matchups = await FileAttachment("data/matchups.json").json();
```

```js
// Calculate league statistics
const totalGames = rosters.reduce((sum, r) => sum + r.settings.wins + r.settings.losses, 0) / 2;
const totalPoints = rosters.reduce((sum, r) => sum + r.settings.fpts + (r.settings.fpts_decimal / 100), 0);
const avgPointsPerGame = totalPoints / totalGames;
const currentWeek = matchups.length > 0 ? matchups[matchups.length - 1].week : 1;

// Get top scorer
const standings = rosters.map(roster => {
  const user = users.find(u => u.user_id === roster.owner_id);
  return {
    team: user?.display_name || roster.owner_id,
    wins: roster.settings.wins,
    losses: roster.settings.losses,
    ties: roster.settings.ties,
    points_for: roster.settings.fpts + (roster.settings.fpts_decimal / 100),
    points_against: roster.settings.fpts_against + (roster.settings.fpts_against_decimal / 100),
    win_pct: roster.settings.wins / (roster.settings.wins + roster.settings.losses + roster.settings.ties || 1)
  };
}).sort((a, b) => b.win_pct - a.win_pct || b.points_for - a.points_for);

const topScorer = standings.reduce((top, team) =>
  team.points_for > top.points_for ? team : top
, standings[0]);

const leagueLeader = standings[0];
```

<div style="margin: 0 0 3rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #22c55e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    ${league.season} Season • Week ${currentWeek}
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 3rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #4ade80 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    ${league.name}
  </h1>
  <p style="font-size: 1.25rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Professional-grade analytics and insights for your fantasy football league. Track performance, analyze trends, and make data-driven decisions.
  </p>
</div>

## League Performance

<div class="grid grid-4" style="margin: 2rem 0 3rem 0;">
  <div class="kpi-card">
    <div class="kpi-label">Total Teams</div>
    <div class="kpi-value">${rosters.length}</div>
    <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">
      ${league.scoring_settings?.rec ? 'PPR Scoring' : 'Standard Scoring'}
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-label">Current Week</div>
    <div class="kpi-value">${currentWeek}</div>
    <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">
      ${totalGames} games played
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-label">Avg Points/Game</div>
    <div class="kpi-value">${avgPointsPerGame.toFixed(1)}</div>
    <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem;">
      ${totalPoints.toFixed(0)} total points
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-label">League Status</div>
    <div class="kpi-value" style="font-size: 2rem;">${league.status === 'in_season' ? '🏈' : '✓'}</div>
    <div style="font-size: 0.875rem; color: #94a3b8; margin-top: 0.5rem; text-transform: capitalize;">
      ${league.status.replace('_', ' ')}
    </div>
  </div>
</div>

## League Leaders

<div class="grid grid-2" style="margin: 2rem 0 3rem 0;">
  <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 1rem; padding: 2rem; position: relative; overflow: hidden;">
    <div style="position: absolute; top: 1rem; right: 1rem; font-size: 3rem; opacity: 0.15;">🏆</div>
    <div style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 0.5rem;">
      League Leader
    </div>
    <div style="font-size: 2rem; font-weight: 800; color: #f8fafc; margin-bottom: 0.75rem;">
      ${leagueLeader.team}
    </div>
    <div style="display: flex; gap: 2rem; font-size: 0.875rem;">
      <div>
        <div style="color: #94a3b8;">Record</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">${leagueLeader.wins}-${leagueLeader.losses}${leagueLeader.ties > 0 ? `-${leagueLeader.ties}` : ''}</div>
      </div>
      <div>
        <div style="color: #94a3b8;">Win %</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">${(leagueLeader.win_pct * 100).toFixed(0)}%</div>
      </div>
      <div>
        <div style="color: #94a3b8;">Points For</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">${leagueLeader.points_for.toFixed(1)}</div>
      </div>
    </div>
  </div>

  <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 1rem; padding: 2rem; position: relative; overflow: hidden;">
    <div style="position: absolute; top: 1rem; right: 1rem; font-size: 3rem; opacity: 0.15;">💯</div>
    <div style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 0.5rem;">
      Top Scorer
    </div>
    <div style="font-size: 2rem; font-weight: 800; color: #f8fafc; margin-bottom: 0.75rem;">
      ${topScorer.team}
    </div>
    <div style="display: flex; gap: 2rem; font-size: 0.875rem;">
      <div>
        <div style="color: #94a3b8;">Total Points</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${topScorer.points_for.toFixed(1)}</div>
      </div>
      <div>
        <div style="color: #94a3b8;">Avg/Game</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${(topScorer.points_for / (topScorer.wins + topScorer.losses)).toFixed(1)}</div>
      </div>
      <div>
        <div style="color: #94a3b8;">Record</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${topScorer.wins}-${topScorer.losses}</div>
      </div>
    </div>
  </div>
</div>

## Current Standings

```js
display(html`
  <div class="card">
    ${Inputs.table(standings, {
      columns: ["team", "wins", "losses", "points_for", "points_against", "win_pct"],
      header: {
        team: "Team",
        wins: "W",
        losses: "L",
        points_for: "Points For",
        points_against: "Points Against",
        win_pct: "Win %"
      },
      format: {
        points_for: x => x.toFixed(2),
        points_against: x => x.toFixed(2),
        win_pct: x => (x * 100).toFixed(1) + '%'
      },
      width: {
        team: 200,
        wins: 60,
        losses: 60,
        points_for: 100,
        points_against: 120,
        win_pct: 80
      }
    })}
  </div>
`);
```

## Points Distribution

```js
display(html`<div class="chart-container">`);

display(Plot.plot({
  marginLeft: 180,
  marginBottom: 60,
  height: rosters.length * 50,
  x: {
    grid: true,
    label: "Total Points Scored →",
    labelAnchor: "center"
  },
  y: {
    label: null
  },
  color: {
    type: "linear",
    domain: [Math.min(...standings.map(d => d.points_for)), Math.max(...standings.map(d => d.points_for))],
    range: ["#16a34a", "#4ade80"]
  },
  marks: [
    Plot.barX(standings, {
      x: d => d.points_for,
      y: d => d.team,
      fill: d => d.points_for,
      sort: {y: "-x"},
      rx: 6
    }),
    Plot.text(standings, {
      x: d => d.points_for,
      y: d => d.team,
      text: d => d.points_for.toFixed(1),
      dx: -12,
      fill: "#f8fafc",
      textAnchor: "end",
      fontSize: 13,
      fontWeight: 600
    }),
    Plot.ruleX([0])
  ]
}));

display(html`</div>`);
```

## Win Rate Analysis: Schedule Luck Revealed

```js
// Calculate all-play records for teams
const allPlayRecords = rosters.map(roster => {
  const teamMatchups = matchups.filter(week =>
    week.matchups.some(m => m.roster_id === roster.roster_id)
  );

  let allPlayWins = 0;
  let allPlayLosses = 0;
  let allPlayTies = 0;

  for (const week of teamMatchups) {
    const teamMatchup = week.matchups.find(m => m.roster_id === roster.roster_id);
    if (!teamMatchup) continue;

    const teamScore = teamMatchup.points;

    for (const opponent of week.matchups) {
      if (opponent.roster_id === roster.roster_id) continue;

      if (teamScore > opponent.points) {
        allPlayWins++;
      } else if (teamScore < opponent.points) {
        allPlayLosses++;
      } else {
        allPlayTies++;
      }
    }
  }

  const totalGames = allPlayWins + allPlayLosses + allPlayTies;
  const user = users.find(u => u.user_id === roster.owner_id);

  return {
    team: user?.display_name || roster.owner_id,
    allPlayWins,
    allPlayLosses,
    allPlayWinPct: totalGames > 0 ? allPlayWins / totalGames : 0
  };
});

const winRateData = standings.map(s => {
  const allPlayData = allPlayRecords.find(r => r.team === s.team);
  const data = {
    team: s.team,
    wins: s.wins,
    losses: s.losses,
    win_rate: s.win_pct,
    allPlayWins: allPlayData?.allPlayWins || 0,
    allPlayLosses: allPlayData?.allPlayLosses || 0,
    allPlayWinPct: allPlayData?.allPlayWinPct || 0,
    scheduleLuck: (s.win_pct - (allPlayData?.allPlayWinPct || 0)) * 100
  };
  return data;
}).filter(d => d.win_rate !== undefined && d.allPlayWinPct !== undefined);
```

```js
display(html`
<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 1rem; padding: 1.5rem; margin: 2rem 0 1.5rem 0;">
  <div style="display: flex; align-items: start; gap: 1rem;">
    <div style="font-size: 2rem; line-height: 1;">🎯</div>
    <div>
      <h3 style="margin-top: 0; color: #60a5fa; font-size: 1.25rem; font-weight: 700;">Schedule Luck Analyzer</h3>
      <p style="color: #cbd5e1; font-size: 0.9375rem; margin: 0; line-height: 1.6;">
        Teams <strong style="color: #22c55e;">below the line</strong> had lucky schedules. Teams <strong style="color: #ef4444;">above the line</strong> faced tougher opponents than their record suggests.
      </p>
    </div>
  </div>
</div>
`);

display(Plot.plot({
  width: 800,
  height: 600,
  marginLeft: 80,
  marginRight: 40,
  marginBottom: 80,
  marginTop: 50,
  style: {
    background: "transparent",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  x: {
    label: "All-Play Win % →",
    domain: [0, 1],
    tickFormat: d => `${(d * 100).toFixed(0)}%`,
    grid: true,
    labelAnchor: "center",
    labelOffset: 45
  },
  y: {
    label: "↑ Head-to-Head Win %",
    domain: [0, 1],
    tickFormat: d => `${(d * 100).toFixed(0)}%`,
    grid: true,
    labelAnchor: "center",
    labelOffset: 50
  },
  color: {
    legend: true,
    domain: ["Perfect Schedule"],
    range: ["#fbbf24"],
    label: null
  },
  marks: [
    // Team dots with bright, visible colors and white stroke
    Plot.dot(winRateData, {
      x: "allPlayWinPct",
      y: "win_rate",
      r: 12,
      fill: d => {
        const luck = d.scheduleLuck;
        if (luck > 8) return "#22c55e";      // Bright green - very lucky
        if (luck > 3) return "#10b981";       // Green - lucky
        if (luck > -3) return "#fbbf24";      // Yellow - neutral
        if (luck > -8) return "#f97316";      // Orange - unlucky
        return "#ef4444";                     // Red - very unlucky
      },
      stroke: "#ffffff",
      strokeWidth: 3,
      tip: true
    }),

    // Team labels with better positioning
    Plot.text(winRateData, {
      x: "allPlayWinPct",
      y: "win_rate",
      text: "team",
      dy: -20,
      fontSize: 11,
      fontWeight: 600,
      fill: "#e2e8f0",
      stroke: "#0a0e14",
      strokeWidth: 3,
      paintOrder: "stroke"
    }),

    // Perfect schedule efficiency line (diagonal) - drawn last so it's on top
    Plot.line([{x: 0, y: 0, label: "Perfect Schedule"}, {x: 1, y: 1, label: "Perfect Schedule"}], {
      x: "x",
      y: "y",
      stroke: "label",
      strokeWidth: 4,
      strokeOpacity: 1,
      strokeDasharray: "8,8"
    })
  ]
}));
```

```js
// Calculate luck leaderboard - show all teams sorted by luck
const luckLeaderboard = winRateData
  .map(d => ({
    team: d.team,
    scheduleLuck: d.scheduleLuck,
    actualRecord: `${d.wins}-${d.losses}`,
    allPlayRecord: `${d.allPlayWins}-${d.allPlayLosses}`,
    absLuck: Math.abs(d.scheduleLuck)
  }))
  .sort((a, b) => b.scheduleLuck - a.scheduleLuck); // Sort by luck (most lucky first)

display(html`
<details open style="margin-top: 3rem; background: rgba(15, 20, 28, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 0; overflow: hidden;">
  <summary style="font-size: 1.25rem; font-weight: 700; cursor: pointer; padding: 1.5rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #f8fafc; display: flex; align-items: center; gap: 0.75rem;">
    <span style="font-size: 1.5rem;">📊</span>
    <span>Schedule Luck Rankings</span>
  </summary>

  <div style="padding: 1.5rem;">
    <p style="color: #cbd5e1; font-size: 0.9375rem; margin: 0 0 1.5rem 0; line-height: 1.6;">
      <strong style="color: #22c55e;">Positive values</strong> indicate easier schedules. <strong style="color: #ef4444;">Negative values</strong> indicate tougher opponents.
    </p>

    ${Plot.plot({
      width: 900,
      height: luckLeaderboard.length * 55 + 100,
      marginLeft: 150,
      marginRight: 100,
      marginBottom: 60,
      marginTop: 40,
      style: {
        background: "transparent",
        fontSize: "14px",
        fontFamily: "system-ui, -apple-system, sans-serif"
      },
      x: {
        label: "Schedule Luck (Percentage Points) →",
        labelAnchor: "center",
        grid: true,
        labelOffset: 40
      },
      y: {
        label: null,
        domain: luckLeaderboard.map(d => d.team)
      },
      marks: [
        // Horizontal bars
        Plot.barX(luckLeaderboard, {
          x: d => d.scheduleLuck,
          y: d => d.team,
          fill: d => {
            const luck = d.scheduleLuck;
            if (luck > 8) return "#22c55e";
            if (luck > 3) return "#10b981";
            if (luck > -3) return "#fbbf24";
            if (luck > -8) return "#f97316";
            return "#ef4444";
          },
          rx: 6
        }),

        // Percentage labels on bars
        Plot.text(luckLeaderboard, {
          x: d => d.scheduleLuck,
          y: d => d.team,
          text: d => (d.scheduleLuck > 0 ? '+' : '') + d.scheduleLuck.toFixed(1) + '%',
          textAnchor: d => d.scheduleLuck > 0 ? "start" : "end",
          dx: d => d.scheduleLuck > 0 ? 10 : -10,
          fill: "#f8fafc",
          fontSize: 13,
          fontWeight: 700
        }),

        // Record comparison on left side
        Plot.text(luckLeaderboard, {
          x: 0,
          y: d => d.team,
          text: d => `${d.actualRecord} → ${d.allPlayRecord}`,
          textAnchor: "end",
          dx: -12,
          fill: "#94a3b8",
          fontSize: 11,
          fontWeight: 500
        }),

        // Center reference line
        Plot.ruleX([0], {
          stroke: "#64748b",
          strokeWidth: 2,
          strokeOpacity: 0.6
        })
      ]
    })}
  </div>
</details>
`);
```

---

<div style="margin-top: 4rem; padding: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 1rem;">
  <h3 style="margin-top: 0; color: #22c55e; display: flex; align-items: center; gap: 0.75rem;">
    <span style="font-size: 1.5rem;">📊</span>
    Quick Navigation
  </h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
    <div>
      <div style="font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem;">🏆 League Overview</div>
      <div style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
        Detailed league settings, rules, and historical performance data
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem;">👥 Player Analytics</div>
      <div style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
        Deep dive into player performance, trends, and roster composition
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem;">⚔️ Matchups</div>
      <div style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
        Week-by-week matchup analysis and head-to-head records
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem;">💀 Atrocity Score</div>
      <div style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
        Discover the worst lineup decisions and biggest mistakes
      </div>
    </div>
  </div>
</div>
