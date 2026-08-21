```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";
import {
  calculateLeagueShapleyValues,
  interpretShapleyValue
} from "./components/helpers.js";

// Load data — every season in the league chain
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
// Prepare team data for Shapley calculation
const teams = rosters.map((roster, index) => {
  const user = users.find(u => u.user_id === roster.owner_id);
  const st = roster.settings || {};
  return {
    id: roster.roster_id,
    roster_id: roster.roster_id, // Needed for all-play calculation
    team: user?.display_name || `Team ${roster.roster_id}`,
    points: (st.fpts || 0) + ((st.fpts_decimal || 0) / 100),
    wins: st.wins || 0,
    losses: st.losses || 0,
    winPct: (st.wins || 0) / ((st.wins || 0) + (st.losses || 0) || 1),
    rank: index + 1
  };
}).sort((a, b) => b.winPct - a.winPct || b.points - a.points);

// Update ranks after sorting
teams.forEach((team, i) => team.rank = i + 1);

// Determine playoff spots (typically 6 teams in a 12-team league)
const playoffSpots = Math.ceil(teams.length / 2);

// Have any games been played?
const gamesPlayed = teams.some(t => t.wins + t.losses > 0);

// Always use all-play records (schedule-independent)
const selectedRecordType = "allplay";

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

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? S.status.replace(/_/g, " ") : "final"}</p>
    <h1>Who would win if everyone played <em>everyone</em>?</h1>
    <p class="lede">All-play records score each team against the whole league every week, so a good record earned against weak opponents stops looking like strength.</p>
    <p class="meta">${teams.length} teams · ${playoffSpots} playoff spots</p>
  </header>
`);
```

## Rankings at a glance

```js
const maxLuck = Math.max(...teamsWithAnalysis.map(t => Math.abs((t.winPct - t.allPlayWinPct) * 100)));

display(html`
  ${gamesPlayed ? "" : html`<aside class="note"><b>No games played yet.</b> All-play records appear after week 1 finals; until then every team sits at 0%.</aside>`}
  <div class="stat-grid">
    <div class="stat ${gamesPlayed ? "stat--brass" : ""}">
      <div class="stat__k">Strongest team</div>
      <div class="stat__v stat--text ${gamesPlayed ? "" : "stat--muted"}">${gamesPlayed ? teamsWithAnalysis[0].team : "—"}</div>
      <div class="stat__l">${gamesPlayed ? `All-play ${(teamsWithAnalysis[0].allPlayWinPct * 100).toFixed(1)}%` : "No games yet"}</div>
    </div>
    <div class="stat">
      <div class="stat__k">Playoff-worthy teams</div>
      <div class="stat__v">${teamsWithAnalysis.filter(t => t.allPlayWinPct >= 0.5).length}</div>
      <div class="stat__l">All-play win% of 50% or better</div>
    </div>
    <div class="stat">
      <div class="stat__k">Biggest schedule swing</div>
      <div class="stat__v">${maxLuck.toFixed(0)}<small>%</small></div>
      <div class="stat__l">Largest gap between actual and all-play win%</div>
    </div>
  </div>
`);
```

## Team rankings

```js
if (!gamesPlayed) {
  display(html`<aside class="note"><b>No rankings yet.</b> The table fills in once week 1 is final.</aside>`);
} else display(html`
  <p class="muted text-sm">
    Sorted by all-play win percentage. Compare the actual and all-play standings to see who the schedule helped or hurt.
  </p>
  <div class="table-wrap">
  ${Inputs.table(teamsWithAnalysis, {
    rows: teamsWithAnalysis.length + 2,
    columns: ["team", "rank", "allPlayStanding", "wins", "losses", "allPlayWins", "allPlayLosses", "allPlayWinPct", "playoffWorthy"],
    header: {
      team: "Team",
      rank: "Actual standing",
      allPlayStanding: "All-play standing",
      wins: "Actual W",
      losses: "Actual L",
      allPlayWins: "All-play W",
      allPlayLosses: "All-play L",
      allPlayWinPct: "All-play win %",
      playoffWorthy: "Playoff worthy"
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
`);
```

## All-play win percentage

```js
const nRanked = teamsWithAnalysis.length;
const rankFill = d => {
  const i = d.allPlayStanding - 1;
  return i < 3 ? T.brass : i >= nRanked - 3 ? T.down : T.ink4;
};

if (!gamesPlayed) {
  display(html`<aside class="note"><b>Nothing to rank yet.</b> Bars fill in once week 1 is final.</aside>`);
} else display(html`
  <figure class="chart">
    <div class="chart__title">Ranked best to worst</div>
    <p class="chart__sub">Top three in brass, bottom three in ember; the dashed line is break-even.</p>
    ${Plot.plot(plotTheme({
      width: Math.min(width, 800),
      marginLeft: width < 640 ? 110 : 150,
      marginRight: 24,
      height: Math.min(560, teams.length * 36 + 40),
      x: {
        label: "All-play win %",
        grid: true,
        domain: [0, 1],
        tickFormat: d => `${(d * 100).toFixed(0)}%`
      },
      y: {
        label: null,
        grid: false
      },
      marks: [
        Plot.barX(teamsWithAnalysis, {
          x: "allPlayWinPct",
          y: "team",
          fill: rankFill,
          sort: {y: "-x"},
          tip: true,
          title: d => `${d.team}\nActual #${d.rank} · All-play #${d.allPlayStanding}\n${d.allPlayWins}-${d.allPlayLosses} (${(d.allPlayWinPct * 100).toFixed(1)}%)`
        }),
        Plot.text(teamsWithAnalysis, {
          x: "allPlayWinPct",
          y: "team",
          text: d => `#${d.rank} · ${(d.allPlayWinPct * 100).toFixed(1)}%`,
          dx: 6,
          fill: T.ink2,
          textAnchor: "start",
          fontSize: 11
        }),
        Plot.ruleX([0.5], {
          stroke: T.slate,
          strokeWidth: 1,
          strokeDasharray: "4,4"
        }),
        Plot.ruleX([0], {stroke: T.hair2})
      ]
    }))}
    <div class="chart__cap">Labels show actual standing and all-play win percentage.</div>
  </figure>
`);
```

## Schedule luck

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

if (!gamesPlayed) {
  display(html`<aside class="note"><b>No schedule luck yet.</b> Actual and all-play records diverge only after games are played.</aside>`);
} else display(html`
  <p class="muted text-sm">
    Positive schedule luck means the actual record beats the all-play record (an easy draw). Negative means the opposite.
  </p>
  <div class="table-wrap">
  ${Inputs.table(scheduleLuck, {
    rows: scheduleLuck.length + 2,
    columns: ["team", "actualRank", "allPlayRank", "rankingsGained", "actualWinPct", "allPlayWinPct", "luckDiff", "scheduleLuck"],
    header: {
      team: "Team",
      actualRank: "Actual standing",
      allPlayRank: "All-play standing",
      rankingsGained: "Places gained",
      actualWinPct: "Actual win %",
      allPlayWinPct: "All-play win %",
      luckDiff: "Schedule luck",
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
`);
```

## Team detail

```js
const teamSelector = Inputs.select(
  teamsWithAnalysis.map(t => t.team),
  {
    label: "Team",
    value: teamsWithAnalysis[0].team
  }
);
const selectedTeam = Generators.input(teamSelector);
display(html`<div class="row">${teamSelector}</div>`);
```

```js
const teamData = teamsWithAnalysis.find(t => t.team === selectedTeam) ?? teamsWithAnalysis[0];
const teamLuck = scheduleLuck.find(d => d.team === teamData.team);
const luckTone = Math.abs(teamLuck.luckDiff) > 5 ? (teamLuck.luckDiff > 0 ? "note--up" : "note--down") : "";

display(html`
  <div class="grid grid-2">
    <div>
      <p class="eyebrow">Actual</p>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__k">League standing</div>
          <div class="stat__v">#${teamData.rank}<small>of ${teams.length}</small></div>
        </div>
        <div class="stat">
          <div class="stat__k">Record</div>
          <div class="stat__v">${teamData.wins}-${teamData.losses}</div>
          <div class="stat__l">${(teamData.winPct * 100).toFixed(1)}%</div>
        </div>
        <div class="stat">
          <div class="stat__k">Total points</div>
          <div class="stat__v">${teamData.points.toFixed(1)}</div>
        </div>
      </div>
    </div>
    <div>
      <p class="eyebrow">All-play</p>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__k">Record</div>
          <div class="stat__v">${teamData.allPlayWins}-${teamData.allPlayLosses}</div>
        </div>
        <div class="stat ${gamesPlayed ? "stat--brass" : ""}">
          <div class="stat__k">Win %</div>
          <div class="stat__v ${gamesPlayed ? "" : "stat--muted"}">${gamesPlayed ? (teamData.allPlayWinPct * 100).toFixed(1) + "%" : "—"}</div>
        </div>
        <div class="stat">
          <div class="stat__k">Playoff worthy</div>
          <div class="stat__v stat--text">${teamData.playoffWorthy}</div>
        </div>
      </div>
    </div>
  </div>

  <aside class="note ${luckTone}">
    ${Math.abs(teamLuck.luckDiff) > 5 ? html`
      <p><b>${teamLuck.scheduleLuck} schedule.</b> Actual win% is ${(teamLuck.luckDiff > 0 ? '+' : '')}${teamLuck.luckDiff.toFixed(1)}% ${teamLuck.luckDiff > 0 ? 'above' : 'below'} all-play win%, so this team ${teamLuck.luckDiff > 0 ? 'drew easier matchups than average' : 'faced tougher opponents than average'}.</p>
    ` : html`
      <p><b>Fair schedule.</b> The actual record closely matches the all-play record${gamesPlayed ? "" : " (no games played yet)"}.</p>
    `}
  </aside>
`);
```

```js
display(html`<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>All-play record.</strong> Each week, a team's score is compared against all ${teams.length - 1} other teams. Score 120 points while 8 teams score less and you get 8 all-play wins for the week; summing across every week played gives the all-play record.</li>
    <li><strong>Schedule independent.</strong> Drawing weak or strong opponents no longer matters, so teams that score high every week rise whoever they faced.</li>
    <li><strong>Playoff signal.</strong> A high all-play win percentage shows who earns a spot on performance rather than matchups.</li>
    <li><strong>Reading the gap.</strong> A team whose actual standing is well above its all-play standing has been carried by the schedule; "Places gained" in the schedule luck table is that gap.</li>
  </ul>
</section>`);
```
