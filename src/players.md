```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme, positionColor} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data — every season in the league chain, plus the Sleeper player file
const seasonsData = await FileAttachment("data/seasons.json").json();
const players = await FileAttachment("data/players.json").json();
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
// Process player data from rosters
const allRosteredPlayers = rosters.flatMap(roster => {
  const user = users.find(u => u.user_id === roster.owner_id);
  return (roster.players || []).map(playerId => {
    const player = players[playerId];
    return {
      player_id: playerId,
      team_owner: user?.display_name || roster.owner_id,
      roster_id: roster.roster_id,
      name: player ? `${player.first_name} ${player.last_name}` : playerId,
      position: player?.position || 'N/A',
      team: player?.team || 'FA',
      age: player?.age || 0,
      years_exp: player?.years_exp || 0,
      status: player?.status || 'Active',
      injury_status: player?.injury_status || null,
      fantasy_positions: player?.fantasy_positions || []
    };
  });
}).filter(p => p.position !== 'DEF'); // Filter out team defenses for now

// Get unique positions
// Known positions only: unknown player IDs resolve to 'N/A' and are excluded from the dropdown and chart
const knownPlayers = allRosteredPlayers.filter(p => p.position !== 'N/A');
const positions = [...new Set(knownPlayers.map(p => p.position))].sort();
const injuredPlayers = allRosteredPlayers.filter(p => p.injury_status);
const playersWithAge = allRosteredPlayers.filter(p => p.age > 0);
const avgAge = d3.mean(playersWithAge, p => p.age);
const rookieCount = allRosteredPlayers.filter(p => p.years_exp === 0).length;
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? String(S.status || "").replace(/_/g, " ") : "final"}</p>
    <h1>How each team is <em>built</em></h1>
    <p class="lede">Position mix, age, experience, and health across every roster in the league.</p>
    <p class="meta">${S.is_current ? "Updated from Sleeper" : `Final ${season} rosters from Sleeper`} · ${rosters.length} teams · ${knownPlayers.length} rostered players (defenses and unknown IDs excluded)</p>
  </header>
`);
```

<div class="row">

```js
const positionInput = Inputs.select(["all", ...positions], {
  label: "Position",
  value: "all",
  format: x => x === "all" ? "All positions" : x
});
const selectedPosition = Generators.input(positionInput);
display(positionInput);
```

```js
// Players matching the position filter, paged
const filteredPlayers = selectedPosition === "all"
  ? allRosteredPlayers
  : allRosteredPlayers.filter(p => p.position === selectedPosition);

const validPlayers = filteredPlayers.filter(p => p.name && p.position !== 'N/A');

const PLAYER_PAGE_SIZE = 20;
const playerTotalPages = Math.max(1, Math.ceil(validPlayers.length / PLAYER_PAGE_SIZE));

const playerPageInput = Inputs.range([1, playerTotalPages], {
  step: 1,
  value: 1,
  label: "Page",
  width: 150
});
const playerPage = Generators.input(playerPageInput);
display(html`<div>${validPlayers.length > 0 ? playerPageInput : ""}</div>`);
```

</div>

```js
display(html`
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Rostered players</div><div class="stat__v">${allRosteredPlayers.length}</div></div>
    <div class="stat"><div class="stat__k">Average age</div><div class="stat__v ${avgAge ? "" : "stat--muted"}">${avgAge ? avgAge.toFixed(1) : "—"}</div></div>
    <div class="stat"><div class="stat__k">Rookies</div><div class="stat__v">${rookieCount}</div></div>
    <div class="stat"><div class="stat__k">Injured</div><div class="stat__v">${injuredPlayers.length}</div></div>
  </div>
`);
```

## Roster composition

```js
// Calculate position distribution across teams
const positionCounts = d3.rollup(
  knownPlayers,
  v => v.length,
  d => d.team_owner,
  d => d.position
);

const positionData = Array.from(positionCounts, ([owner, positions]) => {
  const data = { team: owner };
  Array.from(positions, ([pos, count]) => {
    data[pos] = count;
  });
  return data;
});
```

```js
// Display position distribution
if (knownPlayers.length === 0) {
  display(html`<aside class="note"><b>No rostered players.</b> Rosters fill in after the draft.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Position mix by team</div>
  <p class="chart__sub">Players per roster, stacked by position. Longest bars carry the most bodies.</p>
  ${Plot.plot(plotTheme({
    width: Math.min(width, 800),
    marginLeft: width < 640 ? 110 : 150,
    marginBottom: 50,
    height: Math.min(500, Math.max(300, allRosteredPlayers.length * 2)),
    x: {
      label: "Players",
      grid: true
    },
    y: {
      label: null
    },
    color: {
      legend: true,
      domain: positions,
      range: positions.map(positionColor)
    },
    marks: [
      Plot.barX(knownPlayers,
        Plot.groupY(
          {x: "count"},
          {
            y: "team_owner",
            fill: "position",
            sort: {y: "-x"}
          }
        )
      ),
      Plot.ruleX([0], {stroke: T.hair2})
    ]
  }))}
</figure>`);
```

## Age and experience

<div class="grid grid-2">
<div>

```js
if (playersWithAge.length === 0) {
  display(html`<aside class="note"><b>No ages available.</b> Player ages appear once Sleeper's player file includes them.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Age distribution</div>
  <p class="chart__sub">Ages of every rostered player, binned by year.</p>
  ${Plot.plot(plotTheme({
    marginLeft: 60,
    marginBottom: 50,
    height: 300,
    x: {
      label: "Age",
      domain: [20, Math.max(38, (d3.max(playersWithAge, p => p.age) ?? 37) + 1)]
    },
    y: {
      label: "Players",
      grid: true
    },
    marks: [
      Plot.rectY(
        playersWithAge,
        Plot.binX(
          {y: "count"},
          {
            x: "age",
            fill: T.brass,
            thresholds: 20
          }
        )
      ),
      Plot.ruleY([0], {stroke: T.hair2})
    ]
  }))}
</figure>`);
```

</div>
<div>

```js
// Group players by experience
const experienceGroups = d3.rollup(
  allRosteredPlayers.filter(p => p.years_exp >= 0),
  v => v.length,
  d => {
    if (d.years_exp === 0) return "Rookie";
    if (d.years_exp <= 2) return "1-2 years";
    if (d.years_exp <= 4) return "3-4 years";
    if (d.years_exp <= 7) return "5-7 years";
    return "Veteran (8+)";
  }
);

const experienceData = Array.from(experienceGroups, ([group, count]) => ({
  experience: group,
  count: count
}));

if (experienceData.length === 0) {
  display(html`<aside class="note"><b>No rostered players.</b> Experience groups appear once rosters fill.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Experience</div>
  <p class="chart__sub">Rostered players grouped by years in the NFL.</p>
  ${Plot.plot(plotTheme({
    marginLeft: 120,
    marginBottom: 50,
    height: 250,
    x: {
      label: "Players",
      domain: [0, Math.max(1, d3.max(experienceData, d => d.count) ?? 0) * 1.1],
      grid: true
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(experienceData, {
        x: "count",
        y: "experience",
        fill: T.ink4,
        sort: {
          y: {
            value: "x",
            order: "descending"
          }
        }
      }),
      Plot.text(experienceData, {
        x: "count",
        y: "experience",
        text: d => d.count,
        dx: 15,
        fill: T.ink
      })
    ]
  }))}
</figure>`);
```

</div>
</div>

```js
const playerStart = (playerPage - 1) * PLAYER_PAGE_SIZE;
const playerEnd = Math.min(playerStart + PLAYER_PAGE_SIZE, validPlayers.length);
const displayPlayers = validPlayers.slice(playerStart, playerEnd);
```

<h2>Rosters <span class="section-meta">${selectedPosition === "all" ? "all positions" : selectedPosition} · ${validPlayers.length} players</span></h2>

```js
if (validPlayers.length === 0) {
  display(html`<aside class="note"><b>No players match.</b> Pick another position, or wait for rosters to fill after the draft.</aside>`);
} else display(html`
  <div class="pagination-container">
    <div class="pagination-info">Showing ${playerStart + 1}–${playerEnd} of ${validPlayers.length} players</div>
    <div class="pagination-controls"><span class="mono text-xs muted">Page ${playerPage} of ${playerTotalPages}</span></div>
  </div>
  <div class="table-wrap">${Inputs.table(displayPlayers, {
    columns: ["name", "position", "team", "age", "years_exp", "team_owner", "status"],
    header: {
      name: "Player",
      position: "Pos",
      team: "NFL team",
      age: "Age",
      years_exp: "Exp",
      team_owner: "Fantasy team",
      status: "Status"
    },
    width: {
      name: 160,
      position: 50,
      team: 70,
      age: 50,
      years_exp: 50,
      team_owner: 140,
      status: 80
    }
  })}</div>`);
```

<h2>Injury report <span class="section-meta">${injuredPlayers.length} ${injuredPlayers.length === 1 ? "player" : "players"}</span></h2>

```js
if (injuredPlayers.length === 0) {
  display(html`<aside class="note"><b>Every rostered player is healthy.</b> Designations appear here when Sleeper reports them.</aside>`);
} else display(html`<div class="table-wrap">${Inputs.table(injuredPlayers, {
  columns: ["name", "position", "team", "injury_status", "team_owner"],
  header: {
    name: "Player",
    position: "Pos",
    team: "NFL team",
    injury_status: "Status",
    team_owner: "Fantasy team"
  },
  width: {
    name: 160,
    position: 50,
    team: 70,
    injury_status: 100,
    team_owner: 140
  }
})}</div>`);
```

## Depth by position

```js
// Analyze depth by position for each team
const depthAnalysis = users.map(user => {
  const roster = rosters.find(r => r.owner_id === user.user_id);
  const teamPlayers = allRosteredPlayers.filter(p => p.roster_id === roster?.roster_id);

  const positionBreakdown = d3.rollup(
    teamPlayers,
    v => v.length,
    d => d.position
  );

  return {
    team: user.display_name,
    qb: positionBreakdown.get('QB') || 0,
    rb: positionBreakdown.get('RB') || 0,
    wr: positionBreakdown.get('WR') || 0,
    te: positionBreakdown.get('TE') || 0,
    k: positionBreakdown.get('K') || 0,
    total: teamPlayers.length
  };
});

display(html`<p class="muted text-sm">How many players each team carries at every position.</p>
<div class="table-wrap">${Inputs.table(depthAnalysis, {
  columns: ["team", "qb", "rb", "wr", "te", "k", "total"],
  header: {
    team: "Team",
    qb: "QB",
    rb: "RB",
    wr: "WR",
    te: "TE",
    k: "K",
    total: "Total"
  },
  width: {
    team: 180,
    qb: 60,
    rb: 60,
    wr: 60,
    te: 60,
    k: 60,
    total: 80
  },
  sort: "team"
})}</div>`);
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Position mix</strong> shows where each team is deep and where it is thin.</li>
    <li><strong>Age</strong> separates upside from stability: younger rosters grow, older ones hold.</li>
    <li><strong>Experience</strong> tracks the rookie-to-veteran balance behind each team's window.</li>
    <li><strong>Injuries</strong> flag who needs a lineup or waiver decision this week.</li>
    <li><strong>Past seasons</strong> show the final rosters; ages and injury designations come from today's Sleeper player file, not the season shown.</li>
  </ul>
</section>
