```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme, outcome} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data — every season in the league chain; the picker selects one
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
const S = seasonsData.by_season[season];
const league = S.league;
const rosters = S.rosters;
const users = S.users;
const matchups = S.matchups;
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

// Display helpers (formatting only)
const fmtNum = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : "—";
const seasonStarted = totalGames > 0;
const seasonLabel = S.is_current ? S.status.replace(/_/g, " ") : "final";
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${seasonLabel}</p>
    <h1>${league.name}, at a <em>glance</em></h1>
    <p class="lede">Who leads, who scores, and whose record the schedule flatters.</p>
    <p class="meta">${S.is_current ? "Updated from Sleeper" : `Final ${season} results from Sleeper`} · ${rosters.length} teams · ${league.scoring_settings?.rec ? "PPR" : "Standard"} scoring</p>
  </header>
`);
```

## League at a glance

```js
display(html`
  <div class="stat-grid">
    <div class="stat">
      <div class="stat__k">Teams</div>
      <div class="stat__v">${rosters.length}</div>
      <div class="stat__l">${league.scoring_settings?.rec ? "PPR scoring" : "Standard scoring"}</div>
    </div>
    <div class="stat">
      <div class="stat__k">${S.is_current ? "Current week" : "Weeks played"}</div>
      <div class="stat__v">${S.is_current ? currentWeek : matchups.length}</div>
      <div class="stat__l">${totalGames} games played</div>
    </div>
    <div class="stat">
      <div class="stat__k">Points per game</div>
      <div class="stat__v ${seasonStarted ? "" : "stat--muted"}">${seasonStarted ? fmtNum(avgPointsPerGame) : "—"}</div>
      <div class="stat__l">${totalPoints.toFixed(0)} total points</div>
    </div>
    <div class="stat">
      <div class="stat__k">League status</div>
      <div class="stat__v stat--text">${seasonLabel}</div>
    </div>
  </div>
`);
```

## Leaders

```js
const topScorerGames = topScorer.wins + topScorer.losses;

if (!seasonStarted) {
  display(html`<div class="note">No games played yet. Leaders appear once week 1 results arrive.</div>`);
} else display(html`
  <div class="grid grid-2">
    <div class="card card--accent">
      <div class="card__k">League leader</div>
      <div class="card__v">${leagueLeader.team}</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__k">Record</div>
          <div class="stat__v stat--brass">${leagueLeader.wins}-${leagueLeader.losses}${leagueLeader.ties > 0 ? `-${leagueLeader.ties}` : ""}</div>
        </div>
        <div class="stat">
          <div class="stat__k">Win %</div>
          <div class="stat__v stat--brass">${(leagueLeader.win_pct * 100).toFixed(0)}%</div>
        </div>
        <div class="stat">
          <div class="stat__k">Points for</div>
          <div class="stat__v stat--brass">${fmtNum(leagueLeader.points_for)}</div>
        </div>
      </div>
    </div>

    <div class="card card--slate">
      <div class="card__k">Top scorer</div>
      <div class="card__v">${topScorer.team}</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__k">Total points</div>
          <div class="stat__v stat--slate">${fmtNum(topScorer.points_for)}</div>
        </div>
        <div class="stat">
          <div class="stat__k">Per game</div>
          <div class="stat__v stat--slate">${topScorerGames > 0 ? fmtNum(topScorer.points_for / topScorerGames) : "—"}</div>
        </div>
        <div class="stat">
          <div class="stat__k">Record</div>
          <div class="stat__v stat--slate">${topScorer.wins}-${topScorer.losses}</div>
        </div>
      </div>
    </div>
  </div>
`);
```

## Standings

```js
display(html`
  <div class="table-wrap">
    ${Inputs.table(standings, {
      columns: ["team", "wins", "losses", "points_for", "points_against", "win_pct"],
      header: {
        team: "Team",
        wins: "W",
        losses: "L",
        points_for: "Points for",
        points_against: "Points against",
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

## Points scored

```js
const pointsRanked = [...standings].sort((a, b) => b.points_for - a.points_for);
const maxPoints = Math.max(1, d3.max(pointsRanked, d => d.points_for) ?? 0);

if (!seasonStarted) {
  display(html`<div class="note">No points scored yet. This chart fills in after the first week's games.</div>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Total points by team</div>
  <p class="chart__sub">Ranked highest to lowest. Top three in brass, bottom three in ember.</p>
  ${Plot.plot(plotTheme({
    width: Math.min(width, 800),
    marginLeft: width < 640 ? 110 : 180,
    height: rosters.length * 36 + 40,
    x: {
      label: "Total points",
      domain: [0, maxPoints]
    },
    y: {
      label: null,
      domain: pointsRanked.map(d => d.team)
    },
    marks: [
      Plot.barX(pointsRanked, {
        x: d => d.points_for,
        y: d => d.team,
        fill: (d, i) => i < 3 ? T.brass : i >= pointsRanked.length - 3 ? T.down : T.ink4
      }),
      // Value labels: inside the bar when it is long enough, otherwise just past its end
      Plot.text(pointsRanked.filter(d => d.points_for > maxPoints * 0.15), {
        x: d => d.points_for,
        y: d => d.team,
        text: d => d.points_for.toFixed(1),
        dx: -8,
        textAnchor: "end",
        fill: T.ground,
        fontWeight: 500
      }),
      Plot.text(pointsRanked.filter(d => d.points_for <= maxPoints * 0.15), {
        x: d => d.points_for,
        y: d => d.team,
        text: d => d.points_for.toFixed(1),
        dx: 8,
        textAnchor: "start",
        fill: T.ink2,
        fontWeight: 500
      }),
      Plot.ruleX([0], {stroke: T.hair2})
    ]
  }))}
</figure>`);
```

## Schedule luck

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
<div class="note note--brass">
  <strong>How to read it.</strong> Each team's head-to-head win rate is plotted against its all-play win rate (its record if it had faced every team every week).
  Teams <span class="up">above the line</span> (green) have won more than their scoring earned; teams <span class="down">below the line</span> (ember) have faced tougher opponents than their record suggests.
  ${seasonStarted ? "" : " Every team sits at 0% until week 1 is played, so the chart is hidden."}
</div>
`);

const luckNarrow = width < 640;
if (seasonStarted) display(Plot.plot(plotTheme({
  width: Math.min(width, 800),
  height: luckNarrow ? 340 : 420,
  marginLeft: 60,
  marginRight: 40,
  marginBottom: 50,
  marginTop: 30,
  x: {
    label: "All-play win %",
    domain: [0, 1],
    tickFormat: d => `${(d * 100).toFixed(0)}%`,
    grid: true
  },
  y: {
    label: "Head-to-head win %",
    domain: [0, 1],
    tickFormat: d => `${(d * 100).toFixed(0)}%`
  },
  marks: [
    // Even-schedule reference: head-to-head equals all-play
    Plot.line([{x: 0, y: 0}, {x: 1, y: 1}], {
      x: "x",
      y: "y",
      stroke: T.brass,
      strokeWidth: 1.5,
      strokeDasharray: "6,6"
    }),

    // Team dots, colored by the sign of their schedule luck
    Plot.dot(winRateData, {
      x: "allPlayWinPct",
      y: "win_rate",
      r: 8,
      fill: d => outcome(d.scheduleLuck),
      stroke: T.ground,
      strokeWidth: 1.5,
      tip: true,
      title: d => `${d.team}\nH2H ${d.wins}-${d.losses} · All-play ${d.allPlayWins}-${d.allPlayLosses}\nLuck ${d.scheduleLuck > 0 ? "+" : ""}${d.scheduleLuck.toFixed(1)} pts`
    }),

    // Team labels
    Plot.text(winRateData, {
      x: "allPlayWinPct",
      y: "win_rate",
      text: "team",
      dy: -14,
      fill: T.ink,
      stroke: T.ground,
      strokeWidth: 3,
      paintOrder: "stroke"
    })
  ]
})));
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

const luckExtent = Math.max(1, d3.max(luckLeaderboard, d => d.absLuck) ?? 0);
// Record comparison (head-to-head → all-play) shown in the axis label beside each team
const luckRecordByTeam = new Map(luckLeaderboard.map(d => [d.team, `${d.actualRecord} → ${d.allPlayRecord}`]));

display(html`
<details open class="section-collapse">
  <summary class="section-summary">Schedule luck rankings <small>head-to-head minus all-play, in percentage points</small></summary>
  <div class="section-content">
    <p class="muted text-sm">
      <span class="up">Positive</span> (green) means an easier schedule than the scoring earned; <span class="down">negative</span> (ember) means tougher opponents. Records read head-to-head → all-play.
    </p>
    ${seasonStarted ? "" : html`<div class="note">No schedule luck to rank yet. Every team is at 0 until the first week is scored.</div>`}

    ${!seasonStarted ? "" : Plot.plot(plotTheme({
      width: Math.min(width, 900),
      height: luckLeaderboard.length * 36 + 60,
      marginLeft: width < 640 ? 110 : 210,
      marginRight: width < 640 ? 50 : 80,
      x: {
        label: "Schedule luck (percentage points)",
        domain: [-luckExtent, luckExtent],
        grid: true
      },
      y: {
        label: null,
        domain: luckLeaderboard.map(d => d.team),
        // On narrow screens drop the record from the tick label to keep the axis legible
        tickFormat: t => width < 640 ? t : `${t}  ${luckRecordByTeam.get(t) ?? ""}`
      },
      marks: [
        Plot.barX(luckLeaderboard, {
          x: d => d.scheduleLuck,
          y: d => d.team,
          fill: d => outcome(d.scheduleLuck)
        }),

        // Signed value labels at the end of each bar
        Plot.text(luckLeaderboard.filter(d => d.scheduleLuck >= 0), {
          x: d => d.scheduleLuck,
          y: d => d.team,
          text: d => (d.scheduleLuck > 0 ? '+' : '') + d.scheduleLuck.toFixed(1) + '%',
          textAnchor: "start",
          dx: 8,
          fill: T.ink,
          fontWeight: 500
        }),
        Plot.text(luckLeaderboard.filter(d => d.scheduleLuck < 0), {
          x: d => d.scheduleLuck,
          y: d => d.team,
          text: d => d.scheduleLuck.toFixed(1) + '%',
          textAnchor: "end",
          dx: -8,
          fill: T.ink,
          fontWeight: 500
        }),

        Plot.ruleX([0], {stroke: T.hair2})
      ]
    }))}
  </div>
</details>
`);
```

## Where to go next

<div class="grid grid-4">
  <a class="card card--tight" href="./league">
    <div class="card__title">League</div>
    <p class="muted text-sm mb-0">Settings, rules, and how evenly strength is spread.</p>
  </a>
  <a class="card card--tight" href="./players">
    <div class="card__title">Players</div>
    <p class="muted text-sm mb-0">Player performance, trends, and roster composition.</p>
  </a>
  <a class="card card--tight" href="./matchups">
    <div class="card__title">Matchups</div>
    <p class="muted text-sm mb-0">Week-by-week results and head-to-head records.</p>
  </a>
  <a class="card card--tight" href="./atrocity">
    <div class="card__title">Atrocity score</div>
    <p class="muted text-sm mb-0">The worst lineup decisions and biggest mistakes.</p>
  </a>
</div>

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Standings</strong> sort by win percentage, then points for. Win % counts ties as neither a win nor a loss.</li>
    <li><strong>Points scored</strong> ranks total points for the season; the top three bars are brass, the bottom three ember.</li>
    <li><strong>Schedule luck</strong> is head-to-head win % minus all-play win % (the record a team would have facing every other team every week). Green means the schedule helped; ember means it hurt.</li>
    <li><strong>Seasons</strong> switch with the picker in the header. Past seasons show final results; the season in progress updates as weeks are scored.</li>
  </ul>
</section>
