# League Overview

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
// Calculate detailed standings with additional metrics
const standings = rosters.map(roster => {
  const user = users.find(u => u.user_id === roster.owner_id);
  const totalGames = roster.settings.wins + roster.settings.losses + roster.settings.ties;
  const pointsFor = roster.settings.fpts + (roster.settings.fpts_decimal / 100);
  const pointsAgainst = roster.settings.fpts_against + (roster.settings.fpts_against_decimal / 100);

  return {
    roster_id: roster.roster_id,
    team: user?.display_name || roster.owner_id,
    wins: roster.settings.wins,
    losses: roster.settings.losses,
    ties: roster.settings.ties,
    points_for: pointsFor,
    points_against: pointsAgainst,
    win_pct: totalGames > 0 ? roster.settings.wins / totalGames : 0,
    ppg: totalGames > 0 ? pointsFor / totalGames : 0,
    papg: totalGames > 0 ? pointsAgainst / totalGames : 0,
    point_diff: pointsFor - pointsAgainst,
    total_games: totalGames
  };
}).sort((a, b) => b.win_pct - a.win_pct || b.points_for - a.points_for);
```

## League Information

```js
display(html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0;">
    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">League Name</div>
      <div style="font-size: 22px; font-weight: bold;">${league.name}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Season</div>
      <div style="font-size: 22px; font-weight: bold;">${league.season}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Teams</div>
      <div style="font-size: 22px; font-weight: bold;">${rosters.length}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Scoring Type</div>
      <div style="font-size: 22px; font-weight: bold;">${league.scoring_settings?.rec ? league.scoring_settings.rec + ' PPR' : 'Standard'}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Status</div>
      <div style="font-size: 22px; font-weight: bold; text-transform: capitalize;">${league.status}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Playoff Teams</div>
      <div style="font-size: 22px; font-weight: bold;">${league.settings?.playoff_teams || 'N/A'}</div>
    </div>
  </div>
`);
```

## Current Standings

```js
display(html`
  <div style="margin: 30px 0;">
    <h3 style="margin-bottom: 20px;">League Standings</h3>
  </div>
`);

display(Inputs.table(standings, {
  columns: ["team", "wins", "losses", "win_pct", "points_for", "points_against", "ppg", "point_diff"],
  header: {
    team: "Team",
    wins: "W",
    losses: "L",
    win_pct: "Win %",
    points_for: "PF",
    points_against: "PA",
    ppg: "PPG",
    point_diff: "Diff"
  },
  format: {
    win_pct: x => (x * 100).toFixed(1) + "%",
    points_for: x => x.toFixed(2),
    points_against: x => x.toFixed(2),
    ppg: x => x.toFixed(2),
    point_diff: x => x.toFixed(2)
  },
  width: {
    team: 180,
    wins: 40,
    losses: 40,
    win_pct: 80,
    points_for: 80,
    points_against: 80,
    ppg: 70,
    point_diff: 80
  }
}));
```

## Power Rankings

```js
// Calculate power ranking score (combination of win % and points)
const powerRankings = standings.map((team, index) => ({
  ...team,
  rank: index + 1,
  power_score: (team.win_pct * 100) + (team.ppg * 0.5)
})).sort((a, b) => b.power_score - a.power_score);

display(html`
  <div style="margin: 40px 0;">
    <h3 style="margin-bottom: 20px;">Power Rankings</h3>
    <p style="color: var(--theme-foreground-alt); font-size: 14px;">Based on win percentage and points per game</p>
  </div>
`);

display(Plot.plot({
  marginLeft: 150,
  height: rosters.length * 45,
  x: {
    label: "Power Score",
    grid: true
  },
  y: {
    label: null
  },
  marks: [
    Plot.barX(powerRankings, {
      x: "power_score",
      y: "team",
      fill: (d, i) => {
        if (i < 3) return "#22c55e"; // Top 3
        if (i >= powerRankings.length - 3) return "#ef4444"; // Bottom 3
        return "var(--theme-accent)";
      },
      sort: { y: "-x" }
    }),
    Plot.text(powerRankings, {
      x: "power_score",
      y: "team",
      text: (d, i) => `#${i + 1}`,
      dx: -25,
      fill: "white",
      fontWeight: "bold"
    })
  ]
}));
```

## Scoring Trends

```js
// Aggregate scoring by week
const weeklyScoring = matchups.flatMap(weekData => {
  return weekData.matchups.map(m => ({
    week: weekData.week,
    points: m.points || 0,
    team: standings.find(s => s.roster_id === m.roster_id)?.team || `Team ${m.roster_id}`
  }));
});

display(html`<h3 style="margin-top: 40px;">Weekly Scoring Trends</h3>`);

display(Plot.plot({
  marginBottom: 60,
  height: 400,
  x: {
    label: "Week",
    tickFormat: d => `Wk ${d}`
  },
  y: {
    label: "Points Scored",
    grid: true
  },
  color: {
    legend: false
  },
  marks: [
    Plot.line(weeklyScoring, {
      x: "week",
      y: "points",
      z: "team",
      stroke: "var(--theme-foreground-alt)",
      strokeOpacity: 0.3,
      curve: "catmull-rom"
    }),
    Plot.dot(weeklyScoring, {
      x: "week",
      y: "points",
      z: "team",
      fill: "var(--theme-accent)",
      r: 3
    })
  ]
}));
```

## League Averages

```js
const leagueAvgPF = d3.mean(standings, d => d.points_for);
const leagueAvgPA = d3.mean(standings, d => d.points_against);
const leagueAvgPPG = d3.mean(standings, d => d.ppg);
const highestScorer = standings[0];
const lowestScorer = standings[standings.length - 1];

display(html`
  <div style="margin: 40px 0;">
    <h3 style="margin-bottom: 20px;">League Statistics</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">Avg Points For</div>
        <div style="font-size: 28px; font-weight: bold; color: var(--theme-accent); margin-top: 8px;">${leagueAvgPF.toFixed(2)}</div>
      </div>

      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">Avg Points Against</div>
        <div style="font-size: 28px; font-weight: bold; color: var(--theme-accent); margin-top: 8px;">${leagueAvgPA.toFixed(2)}</div>
      </div>

      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">Avg PPG</div>
        <div style="font-size: 28px; font-weight: bold; color: var(--theme-accent); margin-top: 8px;">${leagueAvgPPG.toFixed(2)}</div>
      </div>

      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">Highest Scorer</div>
        <div style="font-size: 18px; font-weight: bold; color: #22c55e; margin-top: 8px;">${highestScorer.team}</div>
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">${highestScorer.points_for.toFixed(2)} pts</div>
      </div>

      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">Needs Improvement</div>
        <div style="font-size: 18px; font-weight: bold; color: #ef4444; margin-top: 8px;">${lowestScorer.team}</div>
        <div style="font-size: 14px; color: var(--theme-foreground-alt);">${lowestScorer.points_for.toFixed(2)} pts</div>
      </div>
    </div>
  </div>
`);
```

## Competitive Balance Analysis

```js
// Calculate competitive balance metrics
const scoringVariance = d3.variance(standings, d => d.ppg);
const winPctSpread = d3.max(standings, d => d.win_pct) - d3.min(standings, d => d.win_pct);

const competitiveBalance = {
  high: scoringVariance < 10 && winPctSpread < 0.5,
  medium: scoringVariance < 20 && winPctSpread < 0.7,
  low: true
};

const balanceLevel = competitiveBalance.high ? "High" :
                    competitiveBalance.medium ? "Medium" : "Low";
const balanceColor = competitiveBalance.high ? "#22c55e" :
                     competitiveBalance.medium ? "#f59e0b" : "#ef4444";

display(html`
  <div style="margin: 40px 0; padding: 25px; background: ${balanceColor}20; border-left: 4px solid ${balanceColor}; border-radius: 8px;">
    <h3 style="margin-top: 0; color: ${balanceColor};">League Competitive Balance: ${balanceLevel}</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
      <div>
        <strong>Scoring Variance:</strong> ${scoringVariance.toFixed(2)}
        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 5px;">
          Lower variance = more competitive
        </div>
      </div>
      <div>
        <strong>Win % Spread:</strong> ${(winPctSpread * 100).toFixed(1)}%
        <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 5px;">
          Smaller spread = closer standings
        </div>
      </div>
    </div>
  </div>
`);
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">🏆 Championship Insights</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Power Rankings:</strong> Combine record and scoring to identify true contenders</li>
    <li><strong>Points Per Game:</strong> More predictive of playoff success than total points</li>
    <li><strong>Competitive Balance:</strong> High balance = anyone can win, Low balance = clear favorites</li>
    <li><strong>Trends Matter:</strong> Recent scoring trends can indicate momentum heading into playoffs</li>
  </ul>
</div>
