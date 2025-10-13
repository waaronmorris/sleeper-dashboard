# Player Analytics

<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Roster Analysis
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #4ade80 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Player Analytics
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Deep dive into roster composition, player demographics, and team depth analysis. Identify strengths, weaknesses, and roster construction strategies across your league.
  </p>
</div>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

// Load data
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
const matchups = await FileAttachment("data/matchups.json").json();
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
const positions = [...new Set(allRosteredPlayers.map(p => p.position))].sort();
```

## Roster Composition

<div class="card">

```js
const positionInput = Inputs.select(positions, {
  label: "Filter by Position",
  value: "all",
  format: x => x === "all" ? "All Positions" : x
});
const selectedPosition = Generators.input(positionInput);
display(positionInput);
```

```js
// Calculate position distribution across teams
const positionCounts = d3.rollup(
  allRosteredPlayers,
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

<div class="chart-container">
  <h3 class="chart-title">Position Distribution by Team</h3>

```js
// Display position distribution
display(Plot.plot({
  marginLeft: 150,
  marginBottom: 50,
  height: Math.max(300, allRosteredPlayers.length * 2),
  x: {
    label: "Number of Players →",
    labelAnchor: "center",
    grid: true
  },
  y: {
    label: null
  },
  color: {
    legend: true,
    scheme: "Tableau10"
  },
  marks: [
    Plot.barX(allRosteredPlayers,
      Plot.groupY(
        {x: "count"},
        {
          y: "team_owner",
          fill: "position",
          sort: {y: "-x"}
        }
      )
    ),
    Plot.ruleX([0])
  ]
}));
```

</div>
</div>

## Player Demographics

<div class="grid grid-2">
  <div class="card">
    <h3 style="margin-top: 0; color: var(--color-text-primary);">Age Distribution</h3>
    <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">Distribution of player ages across all rosters</p>

```js
display(Plot.plot({
  marginLeft: 60,
  marginBottom: 50,
  height: 300,
  x: {
    label: "Age →",
    labelAnchor: "center",
    domain: [20, 38]
  },
  y: {
    label: "Number of Players",
    grid: true
  },
  marks: [
    Plot.rectY(
      allRosteredPlayers.filter(p => p.age > 0),
      Plot.binX(
        {y: "count"},
        {
          x: "age",
          fill: "var(--theme-accent)",
          thresholds: 20
        }
      )
    ),
    Plot.ruleY([0])
  ]
}));
```

  </div>

  <div class="card">
    <h3 style="margin-top: 0; color: var(--color-text-primary);">Experience Levels</h3>
    <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">Breakdown of players by years of NFL experience</p>

```js
// Group players by experience
const experienceGroups = d3.rollup(
  allRosteredPlayers.filter(p => p.years_exp >= 0),
  v => v.length,
  d => {
    if (d.years_exp === 0) return "Rookie";
    if (d.years_exp <= 2) return "1-2 Years";
    if (d.years_exp <= 4) return "3-4 Years";
    if (d.years_exp <= 7) return "5-7 Years";
    return "Veteran (8+)";
  }
);

const experienceData = Array.from(experienceGroups, ([group, count]) => ({
  experience: group,
  count: count
}));

display(Plot.plot({
  marginLeft: 120,
  marginBottom: 50,
  height: 250,
  x: {
    label: "Number of Players →",
    labelAnchor: "center",
    grid: true
  },
  y: {
    label: null
  },
  marks: [
    Plot.barX(experienceData, {
      x: "count",
      y: "experience",
      fill: "var(--theme-accent)",
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
      fill: "var(--color-text-primary)"
    })
  ]
}));
```

  </div>
</div>

## Roster Details

<div class="card">
  <h3 style="margin-top: 0; color: var(--color-text-primary);">Players by Team</h3>
  <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">
    Browse rostered players{selectedPosition !== "all" ? ` at ${selectedPosition}` : ""} across all fantasy teams
  </p>

```js
// Get top players by position based on roster priority (earlier in roster = higher value)
const filteredPlayers = selectedPosition === "all"
  ? allRosteredPlayers
  : allRosteredPlayers.filter(p => p.position === selectedPosition);

const displayPlayers = filteredPlayers
  .filter(p => p.name && p.position !== 'N/A')
  .slice(0, 30);

display(Inputs.table(displayPlayers, {
  columns: ["name", "position", "team", "age", "years_exp", "team_owner", "status"],
  header: {
    name: "Player",
    position: "Pos",
    team: "NFL Team",
    age: "Age",
    years_exp: "Exp",
    team_owner: "Fantasy Team",
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
}));
```

  <p style="color: var(--color-text-muted); font-size: 0.875rem; margin-top: 1rem;">
    Showing {displayPlayers.length} of {filteredPlayers.length} players
  </p>
</div>

## Injury Report

```js
const injuredPlayers = allRosteredPlayers.filter(p => p.injury_status);
```

<div class="card" style="${injuredPlayers.length > 0 ? 'border-left: 4px solid var(--color-warning)' : 'border-left: 4px solid var(--color-success)'}">
  <h3 style="margin-top: 0; color: ${injuredPlayers.length > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
    ${injuredPlayers.length > 0 ? `⚠️ Injury Report (${injuredPlayers.length} players)` : '✓ Injury Report'}
  </h3>

```js
if (injuredPlayers.length > 0) {
  display(Inputs.table(injuredPlayers, {
    columns: ["name", "position", "team", "injury_status", "team_owner"],
    header: {
      name: "Player",
      position: "Pos",
      team: "NFL Team",
      injury_status: "Status",
      team_owner: "Fantasy Team"
    },
    width: {
      name: 160,
      position: 50,
      team: 70,
      injury_status: 100,
      team_owner: 140
    }
  }));
} else {
  display(html`
    <p style="margin: 0; color: var(--color-success); font-weight: 600;">
      ✓ All rostered players are currently healthy
    </p>
  `);
}
```

</div>

## Team Roster Depth

<div class="card">
  <h3 style="margin-top: 0; color: var(--color-text-primary);">Position Depth by Team</h3>
  <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">
    Compare roster construction strategies across all teams
  </p>

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

display(Inputs.table(depthAnalysis, {
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
}));
```

</div>

---

<div style="margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 1rem;">
  <h3 style="margin-top: 0; color: #3b82f6;">📊 Key Insights</h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Roster Balance</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Compare position distribution to identify team strengths and weaknesses
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Age Analysis</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Younger players offer upside, veterans provide stability and consistency
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Experience Matters</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Track rookie vs veteran balance for championship window planning
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Injury Management</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Monitor injury status to make informed lineup and waiver decisions
      </div>
    </div>
  </div>
</div>
