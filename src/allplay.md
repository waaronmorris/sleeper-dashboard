# All-Play Analysis

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {
  calculateLeagueShapleyValues,
  interpretShapleyValue
} from "./components/helpers.js";

// Load data
const league = await FileAttachment("data/league.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const matchups = await FileAttachment("data/matchups.json").json();
```

```js
// Prepare team data for Shapley calculation
const teams = rosters.map((roster, index) => {
  const user = users.find(u => u.user_id === roster.owner_id);
  return {
    id: roster.roster_id,
    roster_id: roster.roster_id, // Needed for all-play calculation
    team: user?.display_name || `Team ${roster.roster_id}`,
    points: roster.settings.fpts + (roster.settings.fpts_decimal / 100),
    wins: roster.settings.wins,
    losses: roster.settings.losses,
    winPct: roster.settings.wins / (roster.settings.wins + roster.settings.losses || 1),
    rank: index + 1
  };
}).sort((a, b) => b.winPct - a.winPct || b.points - a.points);

// Update ranks after sorting
teams.forEach((team, i) => team.rank = i + 1);

// Determine playoff spots (typically 6 teams in a 12-team league)
const playoffSpots = Math.ceil(teams.length / 2);
```

<div style="margin: 0 0 3rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Schedule-Independent Rankings
  </div>
  <h1 style="margin: 0 0 1rem 0;">All-Play Analysis: True Team Strength</h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 900px; line-height: 1.6;">
    See how teams would rank if they played <strong>everyone each week</strong>, removing schedule luck.
    This analysis reveals which teams truly earned their playoff spots versus those who benefited from favorable matchups.
  </p>
</div>

## What is All-Play Record?

<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 1rem; padding: 2rem; margin: 2rem 0;">
  <div style="display: flex; align-items: start; gap: 1.5rem;">
    <div style="font-size: 3rem; line-height: 1;">🎯</div>
    <div>
      <h3 style="margin-top: 0; color: #3b82f6;">Schedule-Independent Team Rankings</h3>
      <p style="color: #cbd5e1; line-height: 1.7; margin: 0;">
        <strong>All-play record</strong> is a fantasy football metric that removes schedule luck by comparing each team's
        weekly score against ALL other teams in the league that week. It answers:
        <em>"How would teams rank if everyone played everyone each week?"</em>
      </p>
      <ul style="color: #cbd5e1; line-height: 1.8; margin-top: 1rem;">
        <li><strong>Schedule Independent:</strong> Eliminates the luck of drawing weak or strong opponents</li>
        <li><strong>True Strength:</strong> Reveals which teams consistently scored high regardless of matchup</li>
        <li><strong>Playoff Predictor:</strong> Shows who truly deserves to make playoffs based on performance</li>
        <li><strong>Fair Comparison:</strong> Every team faces the same "opponents" - the entire league</li>
      </ul>
    </div>
  </div>
</div>

## How It Works

```js
// Always use all-play records (schedule-independent)
const selectedRecordType = "allplay";
```

<div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
  <div style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
    <strong style="color: #3b82f6;">💡 How All-Play Record Works:</strong><br>
    For each week, we compare every team's score against ALL 11 other teams. If you scored 120 points and 8 teams scored less, you get 8 wins that week. Do this for all 10 weeks to get your all-play record. Teams with high all-play win percentages are truly strong, regardless of who they actually played.
  </div>
</div>

```js
// Calculate all-play records and determine playoff-worthy teams
const teamsWithShapley = calculateLeagueShapleyValues(
  teams,
  "playoffs",
  playoffSpots,
  matchups,
  selectedRecordType
);

// Sort by all-play win percentage
const teamsWithAnalysis = teamsWithShapley.map(team => ({
  ...team,
  playoffWorthy: team.shapleyValue > 0.5 ? "Yes" : "No",
  strengthScore: team.allPlayWinPct || 0
}));

teamsWithAnalysis.sort((a, b) => b.allPlayWinPct - a.allPlayWinPct);

// Add all-play standing (rank based on all-play win percentage)
teamsWithAnalysis.forEach((team, index) => {
  team.allPlayStanding = index + 1;
});
```

## All-Play Rankings Summary

<div class="grid grid-3" style="margin: 2rem 0 3rem 0;">
  <div class="kpi-card">
    <div class="kpi-label">Strongest Team</div>
    <div style="font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin: 0.5rem 0;">
      ${teamsWithAnalysis[0].team}
    </div>
    <div style="font-size: 0.875rem; color: #94a3b8;">
      All-Play: ${(teamsWithAnalysis[0].allPlayWinPct * 100).toFixed(1)}%
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-label">Playoff-Worthy Teams</div>
    <div class="kpi-value" style="font-size: 2.5rem;">${teamsWithAnalysis.filter(t => t.allPlayWinPct >= 0.5).length}</div>
    <div style="font-size: 0.875rem; color: #94a3b8;">
      Based on >50% all-play win%
    </div>
  </div>

  <div class="kpi-card">
    <div class="kpi-label">Biggest Schedule Luck</div>
    <div class="kpi-value" style="font-size: 2.5rem;">${Math.max(...teamsWithAnalysis.map(t => Math.abs((t.winPct - t.allPlayWinPct) * 100))).toFixed(0)}%</div>
    <div style="font-size: 0.875rem; color: #94a3b8;">
      Max difference: actual vs all-play
    </div>
  </div>
</div>

```js
const teamRankingsContent = html`
  <div class="card">
    <h3 style="margin-top: 0;">Teams Ranked by True Strength</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Teams sorted by all-play win percentage—their schedule-independent strength.
      <br><strong>Compare actual vs all-play</strong> to see who benefited or suffered from schedule luck.
    </p>
    ${Inputs.table(teamsWithAnalysis, {
      columns: ["team", "rank", "allPlayStanding", "wins", "losses", "allPlayWins", "allPlayLosses", "allPlayWinPct", "playoffWorthy"],
      header: {
        team: "Team",
        rank: "Actual Standing",
        allPlayStanding: "All-Play Standing",
        wins: "Actual W",
        losses: "Actual L",
        allPlayWins: "All-Play W",
        allPlayLosses: "All-Play L",
        allPlayWinPct: "All-Play Win %",
        playoffWorthy: "Playoff Worthy?"
      },
      format: {
        allPlayWinPct: x => (x * 100).toFixed(1) + "%"
      },
      width: {
        team: 140,
        rank: 100,
        allPlayStanding: 100,
        wins: 70,
        losses: 70,
        allPlayWins: 85,
        allPlayLosses: 85,
        allPlayWinPct: 105,
        playoffWorthy: 110
      }
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Team Rankings</summary>
  <div class="section-content">
    ${teamRankingsContent}
  </div>
</details>`);
```

```js
const allPlayChartContent = html`
  <div class="chart-container">
    <h3 class="chart-title">Schedule-Independent Team Strength</h3>
    ${Plot.plot({
      marginLeft: 200,
      marginBottom: 60,
      height: teams.length * 60,
      x: {
        label: "All-Play Win Percentage →",
        grid: true,
        labelAnchor: "center",
        domain: [0, 1],
        percent: true
      },
      y: {
        label: null
      },
      color: {
        type: "linear",
        domain: [0, 1],
        range: ["#ef4444", "#22c55e"],
        legend: true,
        label: "All-Play Win %"
      },
      marks: [
        Plot.barX(teamsWithAnalysis, {
          x: "allPlayWinPct",
          y: "team",
          fill: "allPlayWinPct",
          sort: {y: "-x"},
          rx: 6
        }),
        Plot.text(teamsWithAnalysis, {
          x: "allPlayWinPct",
          y: "team",
          text: d => `#${d.rank} • ${(d.allPlayWinPct * 100).toFixed(1)}%`,
          dx: -10,
          fill: "#f8fafc",
          textAnchor: "end",
          fontSize: 12,
          fontWeight: 600
        }),
        Plot.ruleX([0.5], {
          stroke: "#3b82f6",
          strokeWidth: 2,
          strokeDasharray: "4,4"
        }),
        Plot.text([{x: 0.5, label: "50% (Break-Even)"}], {
          x: "x",
          y: teams.length * 60 - 30,
          text: "label",
          fill: "#3b82f6",
          fontSize: 11,
          fontWeight: 600,
          dy: -5
        }),
        Plot.ruleX([0])
      ]
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">All-Play Win Percentage</summary>
  <div class="section-content">
    ${allPlayChartContent}
  </div>
</details>`);
```

```js
// Calculate schedule luck: difference between actual and all-play win%
const scheduleLuck = teamsWithAnalysis.map((team, i) => {
  const luckDiff = (team.winPct - team.allPlayWinPct) * 100;
  const rankingsGained = team.allPlayStanding - team.rank; // Positive means better actual standing than deserved

  return {
    team: team.team,
    actualRank: team.rank,
    allPlayRank: team.allPlayStanding,
    rankingsGained: rankingsGained,
    actualWinPct: team.winPct,
    allPlayWinPct: team.allPlayWinPct,
    luckDiff,
    absLuckDiff: Math.abs(luckDiff),
    scheduleLuck: luckDiff > 5 ? "Lucky" : luckDiff < -5 ? "Unlucky" : "Fair"
  };
}).sort((a, b) => b.absLuckDiff - a.absLuckDiff);

const scheduleLuckContent = html`
  <div class="card">
    <h3 style="margin-top: 0;">Who Got Lucky? Who Got Unlucky?</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Positive = actual record better than all-play (lucky schedule)<br>
      Negative = actual record worse than all-play (unlucky schedule)
    </p>
    ${Inputs.table(scheduleLuck, {
      columns: ["team", "actualRank", "allPlayRank", "rankingsGained", "actualWinPct", "allPlayWinPct", "luckDiff", "scheduleLuck"],
      header: {
        team: "Team",
        actualRank: "Actual Standing",
        allPlayRank: "All-Play Standing",
        rankingsGained: "Rankings Gained",
        actualWinPct: "Actual Win %",
        allPlayWinPct: "All-Play Win %",
        luckDiff: "Schedule Luck %",
        scheduleLuck: "Assessment"
      },
      format: {
        rankingsGained: x => x > 0 ? `+${x}` : x === 0 ? "0" : `${x}`,
        actualWinPct: x => (x * 100).toFixed(1) + "%",
        allPlayWinPct: x => (x * 100).toFixed(1) + "%",
        luckDiff: x => (x > 0 ? "+" : "") + x.toFixed(1) + "%"
      },
      width: {
        team: 130,
        actualRank: 100,
        allPlayRank: 100,
        rankingsGained: 110,
        actualWinPct: 100,
        allPlayWinPct: 105,
        luckDiff: 115,
        scheduleLuck: 100
      }
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Schedule Luck Analysis</summary>
  <div class="section-content">
    ${scheduleLuckContent}
  </div>
</details>`);
```

```js
const teamSelector = Inputs.select(
  teamsWithAnalysis.map(t => t.team),
  {
    label: "Select Team for Deep Dive",
    value: teamsWithAnalysis[0].team
  }
);
const selectedTeam = Generators.input(teamSelector);
```

```js
const teamData = teamsWithAnalysis.find(t => t.team === selectedTeam);
const teamLuck = scheduleLuck.find(d => d.team === selectedTeam);

const detailedAnalysisContent = html`
  <div>
    ${teamSelector}
  </div>

  <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 1rem; padding: 2rem; margin: 1.5rem 0;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <h3 style="margin-top: 0; color: #22c55e;">Actual Performance</h3>
        <div style="display: grid; gap: 1rem;">
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">League Standing</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #f8fafc;">#${teamData.rank} of ${teams.length}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">Actual Record</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #f8fafc;">${teamData.wins}-${teamData.losses} (${(teamData.winPct * 100).toFixed(1)}%)</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">Total Points</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #f8fafc;">${teamData.points.toFixed(1)}</div>
          </div>
        </div>
      </div>
      <div>
        <h3 style="margin-top: 0; color: #3b82f6;">All-Play Performance</h3>
        <div style="display: grid; gap: 1rem;">
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">All-Play Record</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #f8fafc;">${teamData.allPlayWins}-${teamData.allPlayLosses}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">All-Play Win %</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #3b82f6;">${(teamData.allPlayWinPct * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #94a3b8;">Playoff Worthy?</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: #f8fafc;">${teamData.playoffWorthy}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(34, 197, 94, 0.2);">
      <h4 style="margin-top: 0; color: #22c55e;">Schedule Luck Assessment</h4>
      ${Math.abs(teamLuck.luckDiff) > 5 ? html`
        <p style="color: ${teamLuck.luckDiff > 0 ? '#22c55e' : '#f59e0b'}; line-height: 1.7; margin: 0;">
          <strong>${teamLuck.scheduleLuck} Schedule:</strong> This team's actual win% is ${(teamLuck.luckDiff > 0 ? '+' : '')}${teamLuck.luckDiff.toFixed(1)}% ${teamLuck.luckDiff > 0 ? 'higher' : 'lower'} than their all-play win%, suggesting they ${teamLuck.luckDiff > 0 ? 'benefited from favorable matchups' : 'faced tougher opponents than average'}.
        </p>
      ` : html`
        <p style="color: #cbd5e1; line-height: 1.7; margin: 0;">
          <strong>Fair Schedule:</strong> This team's actual record closely matches their all-play performance, indicating minimal schedule luck.
        </p>
      `}
    </div>
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Detailed Team Analysis</summary>
  <div class="section-content">
    ${detailedAnalysisContent}
  </div>
</details>`);
```

---

<div style="margin-top: 4rem; padding: 2rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 1rem;">
  <div style="text-align: center;">
    <div style="font-size: 2rem; margin-bottom: 1rem;">📊</div>
    <h3 style="margin-top: 0; color: #3b82f6;">About All-Play Analysis</h3>
    <p style="color: #cbd5e1; max-width: 800px; margin: 0 auto; line-height: 1.7;">
      All-play records are a standard metric in fantasy football used to evaluate team strength independent of schedule.
      By comparing each team's weekly score against all opponents, we eliminate the luck factor of who you happened to play that week.
      This provides a fairer assessment of which teams truly deserve playoff spots based on consistent performance.
    </p>
    <div style="margin-top: 1.5rem; font-size: 0.875rem; color: #94a3b8;">
      <strong>Calculation:</strong> Each week, compare your score vs all N-1 opponents. Sum wins across all weeks to get all-play record.
    </div>
  </div>
</div>
