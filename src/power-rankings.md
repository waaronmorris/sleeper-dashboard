<style>
  /* Page-local layout that has no design-system class: the two-sided trade board. */
  .trade-board { display: grid; grid-template-columns: 1fr; gap: var(--space-4); align-items: start; margin: var(--space-4) 0; }
  @media (min-width: 900px) { .trade-board { grid-template-columns: 1fr auto 1fr; } }
  .trade-board__swap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-6) var(--space-3); color: var(--brass); font-family: var(--font-display); font-size: var(--text-2xl); line-height: 1; }
  .trade-board__swap small { font-family: var(--font-mono); font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); margin-top: var(--space-2); }
  .trade-board__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-3); }
  .trade-board__pick { max-height: 300px; overflow-y: auto; margin-top: var(--space-3); padding: var(--space-2); border: 1px solid var(--hair); border-radius: var(--radius); }
  .trade-board__pick select { width: 100%; }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Season picker (this page is current-season-only; the picker only drives the note below)
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));

// Load data
const powerData = await FileAttachment("data/power-rankings.json").json();
const rankings = powerData.rankings;
const leagueInfo = powerData.league;
const playerValues = powerData.playerValues;
const rosterData = powerData.rosters;
const maxLineupValue = powerData.maxLineupValue;
const weights = powerData.weights || leagueInfo.weights;
const valueSource = leagueInfo.valueSource || {};

// Check if we have VOR scarcity data
const scarcityMultipliers = valueSource.scarcityMultipliers || null;
const isRedraft = leagueInfo.leagueType === 'redraft';
const isDynasty = leagueInfo.leagueType === 'dynasty' || !leagueInfo.leagueType;
```

```js
const S = seasonsData.by_season[season];
const currentSeason = seasonsData.current;
const currentStatus = (seasonsData.by_season[currentSeason]?.status || "in season").replace(/_/g, " ");
const basedOn = String(Number(currentSeason) - 1);
```

<header class="page-head">
  <p class="eyebrow">${currentSeason} season · ${currentStatus}</p>
  <h1>Who is actually <em>strong</em>?</h1>
  <p class="lede">
    Team strength from optimal starting-lineup value, results to date, and positional advantages.
    ${isDynasty
      ? 'Dynasty values weigh long-term asset worth: age, situation, and future potential.'
      : 'Redraft values weigh current-season production, scaled by VOR scarcity.'}
  </p>
  <p class="meta">Based on ${basedOn} results · ${isDynasty ? 'dynasty' : 'redraft'} values · ${leagueInfo.totalTeams} teams</p>
</header>

```js
display(html`<div>${S.is_current ? "" : html`<aside class="note note--brass"><b>Showing the ${seasonsData.current} season.</b> This page is only available for the season in progress.</aside>`}</div>`);
```

## How the power score works

<p class="muted">Power score combines what a roster <strong>could do</strong> with what it <strong>has done</strong>. Weights for this ${isDynasty ? 'dynasty' : 'redraft'} league:</p>

<div class="stat-grid">
  <div class="stat stat--brass">
    <div class="stat__k">Optimal lineup value</div>
    <div class="stat__v">${Math.round((weights?.lineup || 0.5) * 100)}<small>%</small></div>
    <div class="stat__l">${isDynasty ? 'Best starters by dynasty trade value' : 'Best starters by ECR plus VOR scarcity'}</div>
  </div>
  <div class="stat">
    <div class="stat__k">Actual performance</div>
    <div class="stat__v">${Math.round((weights?.performance || 0.3) * 100)}<small>%</small></div>
    <div class="stat__l">Win %, all-play record, points scored</div>
  </div>
  <div class="stat">
    <div class="stat__k">Positional edge</div>
    <div class="stat__v">${Math.round((weights?.positional || 0.15) * 100)}<small>%</small></div>
    <div class="stat__l">Elite players at scarce positions (RB, TE)</div>
  </div>
  <div class="stat stat--muted">
    <div class="stat__k">Usable depth</div>
    <div class="stat__v">${Math.round((weights?.depth || 0.05) * 100)}<small>%</small></div>
    <div class="stat__l">Top backup per position only</div>
  </div>
</div>

## Position scarcity

```js
// VOR Scarcity data for display
const defaultScarcity = {
  QB: leagueInfo.isSuperFlex ? 140 : 80,
  RB: 150,
  WR: 100,
  TE: 120,
  K: 20,
  DEF: 25
};

const displayScarcity = scarcityMultipliers || defaultScarcity;
const scarcitySource = scarcityMultipliers ? 'Dynamic (VOR)' : 'Static defaults';

// Generate VOR scarcity stats
const vorCards = Object.entries(displayScarcity)
  .filter(([pos]) => ['QB', 'RB', 'WR', 'TE'].includes(pos))
  .map(([pos, value]) => {
    const label = value > 120 ? 'Scarce' : value > 90 ? 'Normal' : value < 50 ? 'Deep' : 'Baseline';
    return html`
      <div class="stat">
        <div class="stat__k"><span class="badge badge--pos-${pos.toLowerCase()}">${pos}</span></div>
        <div class="stat__v">${value}</div>
        <div class="stat__l">${label}</div>
      </div>
    `;
  });

const vorFooter = isRedraft ? 'Recalculated weekly from FantasyCalc ECR data.' : 'Based on dynasty trade value distributions.';
```

```js
display(html`
  <p class="muted text-sm">
    <strong>Value over replacement</strong> (VOR) measures how much better elite players are than replacement level at each position.
    Higher values mean a scarcer position and more valuable stars. WR is the 100 baseline. <span class="mono text-xs">${scarcitySource}</span>
  </p>
  <div class="stat-grid">
    ${vorCards}
  </div>
  <p class="muted text-sm">
    A RB with 100 VOR scarcity is worth <em>more</em> than a WR with the same PPG because elite RBs are harder to replace.
    ${vorFooter}
  </p>
`);
```

```js
// Simulate trend by comparing lineup value rank to actual standing
// Positive trend = roster stronger than record suggests
const displayRankings = rankings.map(team => {
  // Calculate a simulated "previous" rank based on lineup vs performance difference
  const lineupRank = [...rankings].sort((a, b) => b.lineupValueScore - a.lineupValueScore)
    .findIndex(t => t.rosterId === team.rosterId) + 1;
  const perfRank = [...rankings].sort((a, b) => b.performanceScore - a.performanceScore)
    .findIndex(t => t.rosterId === team.rosterId) + 1;

  // Trend based on if roster value suggests they should be ranked higher/lower
  const expectedRank = Math.round((lineupRank * 0.6) + (perfRank * 0.4));
  const trendValue = expectedRank - team.powerRank;

  let trend, trendClass;
  if (trendValue > 1) {
    trend = "▲";
    trendClass = "up";
  } else if (trendValue < -1) {
    trend = "▼";
    trendClass = "down";
  } else {
    trend = "—";
    trendClass = "muted";
  }

  return {
    ...team,
    trend,
    trendClass,
    trendValue
  };
});
```

## Current rankings

<div class="stat-grid">
  <div class="stat stat--brass">
    <div class="stat__k">Top team</div>
    <div class="stat__v stat--text">${rankings[0].teamName}</div>
    <div class="stat__l">Power score ${rankings[0].powerScore}</div>
  </div>
  <div class="stat">
    <div class="stat__k">League format</div>
    <div class="stat__v stat--text">${leagueInfo.isSuperFlex ? 'Superflex' : '1QB'}</div>
    <div class="stat__l">${leagueInfo.totalTeams} teams</div>
  </div>
  <div class="stat">
    <div class="stat__k">Power gap</div>
    <div class="stat__v">${(rankings[0].powerScore - rankings[rankings.length - 1].powerScore).toFixed(1)}</div>
    <div class="stat__l">#1 vs #${rankings.length}</div>
  </div>
</div>

```js
// Build rankings rows
const rankingsRows = displayRankings.map((team, i) => {
  const rowClass = i < 3 ? "is-top" : i >= displayRankings.length - 3 ? "is-bottom" : "";
  const rankClass = i < 3 ? "rank rank--top" : i >= displayRankings.length - 3 ? "rank rank--bottom" : "rank";
  return html`<tr class="${rowClass}">
    <td><span class="${rankClass}">${team.powerRank}</span></td>
    <td class="text-center ${team.trendClass}">${team.trend}</td>
    <td>${team.teamName}</td>
    <td class="num brass">${team.powerScore.toFixed(1)}</td>
    <td class="num">${team.lineupValueScore.toFixed(1)}</td>
    <td class="num">${team.performanceScore.toFixed(1)}</td>
    <td class="num">${team.positionalScore.toFixed(1)}</td>
    <td class="num">${team.depthScore.toFixed(1)}</td>
    <td class="num muted">${team.wins}-${team.losses}</td>
  </tr>`;
});

const rankingsTableContent = html`
  <p class="muted text-sm">
    Teams ranked by composite power score. <span class="up">▲</span> roster suggests a higher rank; <span class="down">▼</span> roster suggests a lower rank.
  </p>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="text-center">Trend</th>
          <th>Team</th>
          <th class="num">Power</th>
          <th class="num">Lineup</th>
          <th class="num">Perf</th>
          <th class="num">Pos</th>
          <th class="num">Depth</th>
          <th class="num">Record</th>
        </tr>
      </thead>
      <tbody>${rankingsRows}</tbody>
    </table>
  </div>
`;

display(rankingsTableContent);
```

```js
const rankedTeams = [...rankings].sort((a, b) => b.powerScore - a.powerScore);
const rankFill = d => {
  const i = rankedTeams.indexOf(d);
  return i < 3 ? T.brass : i >= rankedTeams.length - 3 ? T.down : T.ink4;
};

const powerChartContent = html`
  <figure class="chart">
    <div class="chart__title">Power score by team</div>
    <p class="chart__sub">Top three in brass, bottom three in ember.</p>
    ${Plot.plot(plotTheme({
      marginLeft: 140,
      marginBottom: 40,
      height: rankings.length * 36 + 60,
      x: {
        label: "Power score",
        domain: [0, 100]
      },
      y: {
        label: null
      },
      marks: [
        Plot.barX(rankedTeams, {
          x: "powerScore",
          y: "teamName",
          fill: rankFill,
          sort: {y: "-x"}
        }),
        Plot.text(rankedTeams, {
          x: "powerScore",
          y: "teamName",
          text: d => `#${d.powerRank} · ${d.powerScore.toFixed(1)}`,
          dx: -8,
          fill: T.ground,
          textAnchor: "end",
          fontSize: 11,
          fontWeight: 500
        }),
        Plot.ruleX([0], {stroke: T.hair2})
      ]
    }))}
  </figure>
`;

display(powerChartContent);
```

## Trade impact

<aside class="note note--brass">
  <p><b>See the real impact.</b> Pick two teams and the players each side gives up to see how the trade moves <strong>starting lineup strength</strong>, not just total value.</p>
</aside>

```js
// Team selectors for trade simulator
const teamASelector = Inputs.select(
  rankings.map(t => ({ value: t.rosterId, label: `${t.teamName} (#${t.powerRank})` })),
  { label: "Team 1", format: x => x.label }
);
const teamAId = Generators.input(teamASelector);

const teamBOptions = rankings.map(t => ({ value: t.rosterId, label: `${t.teamName} (#${t.powerRank})` }));
const teamBSelector = Inputs.select(
  teamBOptions,
  { label: "Team 2", format: x => x.label, value: teamBOptions[1] }
);
const teamBId = Generators.input(teamBSelector);
```

```js
// Get rosters for selected teams
const teamARoster = rosterData[teamAId.value];
const teamBRoster = rosterData[teamBId.value];
const teamAInfo = rankings.find(r => r.rosterId === teamAId.value);
const teamBInfo = rankings.find(r => r.rosterId === teamBId.value);

// Get players with values for each team
const teamAPlayers = (teamARoster?.players || [])
  .map(pid => ({ id: pid, ...playerValues[pid] }))
  .filter(p => p.name)
  .sort((a, b) => b.value - a.value);

const teamBPlayers = (teamBRoster?.players || [])
  .map(pid => ({ id: pid, ...playerValues[pid] }))
  .filter(p => p.name)
  .sort((a, b) => b.value - a.value);
```

```js
// Player selection - grouped by position for easier scanning
const posOrder = {QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6};
const teamAPlayersSorted = [...teamAPlayers].sort((a, b) => (posOrder[a.position] || 99) - (posOrder[b.position] || 99) || b.value - a.value);
const teamBPlayersSorted = [...teamBPlayers].sort((a, b) => (posOrder[a.position] || 99) - (posOrder[b.position] || 99) || b.value - a.value);

const teamAGivingSelector = Inputs.select(
  teamAPlayersSorted,
  {
    label: "Players to send",
    format: p => `[${p.position}] ${p.name} — ${p.value.toLocaleString()}`,
    multiple: true,
    size: 10
  }
);
const teamAGiving = Generators.input(teamAGivingSelector);

const teamBGivingSelector = Inputs.select(
  teamBPlayersSorted,
  {
    label: "Players to send",
    format: p => `[${p.position}] ${p.name} — ${p.value.toLocaleString()}`,
    multiple: true,
    size: 10
  }
);
const teamBGiving = Generators.input(teamBGivingSelector);
```

<div class="trade-board">
  <div class="card card--accent">
    <div class="trade-board__head">
      <div>
        <div class="card__k">Team 1</div>
        <div class="card__title">${teamARoster?.teamName || 'Team A'}</div>
      </div>
      <div class="text-right">
        <div class="card__k">Power rank</div>
        <div class="card__v">#${teamAInfo?.powerRank || '?'}</div>
      </div>
    </div>
    ${teamASelector}
    <div class="trade-board__pick">
      ${teamAGivingSelector}
    </div>
    <div class="card__foot">
      <div class="card__k">Sending</div>
      <div class="card__v down">${teamAGiving.reduce((sum, p) => sum + p.value, 0).toLocaleString()}</div>
      <div class="muted text-sm">${teamAGiving.length} player${teamAGiving.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="trade-board__swap">
    <div>⇄</div>
    <small>Trade</small>
  </div>

  <div class="card card--accent">
    <div class="trade-board__head">
      <div>
        <div class="card__k">Team 2</div>
        <div class="card__title">${teamBRoster?.teamName || 'Team B'}</div>
      </div>
      <div class="text-right">
        <div class="card__k">Power rank</div>
        <div class="card__v">#${teamBInfo?.powerRank || '?'}</div>
      </div>
    </div>
    ${teamBSelector}
    <div class="trade-board__pick">
      ${teamBGivingSelector}
    </div>
    <div class="card__foot">
      <div class="card__k">Sending</div>
      <div class="card__v down">${teamBGiving.reduce((sum, p) => sum + p.value, 0).toLocaleString()}</div>
      <div class="muted text-sm">${teamBGiving.length} player${teamBGiving.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
</div>

```js
// Calculate trade impact
function simulateTrade() {
  if (teamAGiving.length === 0 && teamBGiving.length === 0) {
    return null;
  }

  const teamABefore = rankings.find(r => r.rosterId === teamAId.value);
  const teamBBefore = rankings.find(r => r.rosterId === teamBId.value);

  // Simulate new rosters after trade
  const teamAGivingIds = new Set(teamAGiving.map(p => p.id));
  const teamBGivingIds = new Set(teamBGiving.map(p => p.id));

  // Team A: loses teamAGiving, gains teamBGiving
  const teamANewRoster = [
    ...teamARoster.players.filter(pid => !teamAGivingIds.has(pid)),
    ...teamBGiving.map(p => p.id)
  ];

  // Team B: loses teamBGiving, gains teamAGiving
  const teamBNewRoster = [
    ...teamBRoster.players.filter(pid => !teamBGivingIds.has(pid)),
    ...teamAGiving.map(p => p.id)
  ];

  // Calculate new lineup values (simplified - just sum optimal starters)
  function calculateNewLineupValue(playerIds) {
    const players = playerIds
      .map(pid => playerValues[pid])
      .filter(p => p)
      .sort((a, b) => b.value - a.value);

    // Simplified: take best 9 skill players (typical starting lineup)
    const starters = players.slice(0, 9);
    return starters.reduce((sum, p) => sum + p.value, 0);
  }

  const teamAOldLineup = calculateNewLineupValue(teamARoster.players);
  const teamANewLineup = calculateNewLineupValue(teamANewRoster);
  const teamBOldLineup = calculateNewLineupValue(teamBRoster.players);
  const teamBNewLineup = calculateNewLineupValue(teamBNewRoster);

  // Estimate new power scores (proportional change in lineup value component)
  const teamALineupChange = (teamANewLineup - teamAOldLineup) / maxLineupValue * 100 * 0.5;
  const teamBLineupChange = (teamBNewLineup - teamBOldLineup) / maxLineupValue * 100 * 0.5;

  return {
    teamA: {
      name: teamARoster.teamName,
      before: teamABefore,
      powerChange: teamALineupChange,
      newPowerScore: Math.round((teamABefore.powerScore + teamALineupChange) * 10) / 10,
      lineupChange: teamANewLineup - teamAOldLineup,
      gives: teamAGiving,
      receives: teamBGiving
    },
    teamB: {
      name: teamBRoster.teamName,
      before: teamBBefore,
      powerChange: teamBLineupChange,
      newPowerScore: Math.round((teamBBefore.powerScore + teamBLineupChange) * 10) / 10,
      lineupChange: teamBNewLineup - teamBOldLineup,
      gives: teamBGiving,
      receives: teamAGiving
    },
    totalValueA: teamAGiving.reduce((sum, p) => sum + p.value, 0),
    totalValueB: teamBGiving.reduce((sum, p) => sum + p.value, 0)
  };
}

const tradeImpact = simulateTrade();
```

```js
// Display trade impact results
if (tradeImpact) {
  const valueDiff = tradeImpact.totalValueB - tradeImpact.totalValueA;
  const isBalanced = Math.abs(valueDiff) < 1000;

  const sideCard = side => html`
    <div class="card">
      <div class="card__title">${side.name}</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat__k">Current rank</div><div class="stat__v">#${side.before.powerRank}</div></div>
        <div class="stat"><div class="stat__k">Power score</div><div class="stat__v">${side.before.powerScore}</div></div>
        <div class="stat ${side.powerChange >= 0 ? 'stat--up' : 'stat--down'}">
          <div class="stat__k">After trade</div>
          <div class="stat__v">${side.newPowerScore}</div>
          <div class="stat__d ${side.powerChange >= 0 ? 'up' : 'down'}">${side.powerChange >= 0 ? '+' : ''}${side.powerChange.toFixed(1)}</div>
        </div>
      </div>
    </div>
  `;

  display(html`
    <div class="stack">
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__k">Value sent</div>
          <div class="stat__v">${tradeImpact.totalValueA.toLocaleString()}</div>
          <div class="stat__l">${tradeImpact.teamA.name}</div>
        </div>
        <div class="stat">
          <div class="stat__k">Value sent</div>
          <div class="stat__v">${tradeImpact.totalValueB.toLocaleString()}</div>
          <div class="stat__l">${tradeImpact.teamB.name}</div>
        </div>
        <div class="stat ${isBalanced ? 'stat--muted' : 'stat--brass'}">
          <div class="stat__k">Value gap</div>
          <div class="stat__v">${Math.abs(valueDiff).toLocaleString()}</div>
          <div class="stat__l">${isBalanced ? 'roughly even' : valueDiff > 0 ? `favors ${tradeImpact.teamA.name}` : `favors ${tradeImpact.teamB.name}`}</div>
        </div>
      </div>

      <div class="grid grid-2">
        ${sideCard(tradeImpact.teamA)}
        ${sideCard(tradeImpact.teamB)}
      </div>

      ${(() => {
        const warnings = [];

        // Check if one team gains much more than the other
        if (Math.abs(tradeImpact.teamA.powerChange - tradeImpact.teamB.powerChange) > 3) {
          const winner = tradeImpact.teamA.powerChange > tradeImpact.teamB.powerChange ? tradeImpact.teamA.name : tradeImpact.teamB.name;
          const loser = tradeImpact.teamA.powerChange > tradeImpact.teamB.powerChange ? tradeImpact.teamB.name : tradeImpact.teamA.name;
          warnings.push({
            type: 'warning',
            message: `${winner} gains much more power score than ${loser}. This trade may be unbalanced.`
          });
        }

        // Check for trading stud for depth
        const teamAStars = tradeImpact.teamA.gives.filter(p => p.value > 6000);
        const teamBBench = tradeImpact.teamA.receives.filter(p => p.value < 3000);
        if (teamAStars.length > 0 && teamBBench.length >= 2 && tradeImpact.teamA.powerChange < 0) {
          warnings.push({
            type: 'danger',
            message: `${tradeImpact.teamA.name} is trading a star for bench depth. This weakens their starting lineup.`
          });
        }

        const teamBStars = tradeImpact.teamB.gives.filter(p => p.value > 6000);
        const teamABench = tradeImpact.teamB.receives.filter(p => p.value < 3000);
        if (teamBStars.length > 0 && teamABench.length >= 2 && tradeImpact.teamB.powerChange < 0) {
          warnings.push({
            type: 'danger',
            message: `${tradeImpact.teamB.name} is trading a star for bench depth. This weakens their starting lineup.`
          });
        }

        if (warnings.length === 0 && Math.abs(tradeImpact.teamA.powerChange - tradeImpact.teamB.powerChange) < 2) {
          warnings.push({
            type: 'success',
            message: 'This trade is roughly balanced in power score impact.'
          });
        }

        const noteClass = { danger: 'note--down', warning: 'note--brass', success: 'note--up' };
        return html`
          <div class="stack">
            ${warnings.map(w => html`<aside class="note ${noteClass[w.type]}">${w.message}</aside>`)}
          </div>
        `;
      })()}
    </div>
  `);
} else {
  display(html`
    <aside class="note">
      <b>No trade selected.</b> Pick at least one player from either team above to see the before-and-after power scores.
    </aside>
  `);
}
```

## Score components

```js
const componentData = rankings.flatMap(team => [
  { team: team.teamName, component: "Lineup value (50%)", score: team.lineupValueScore * 0.5, raw: team.lineupValueScore },
  { team: team.teamName, component: "Performance (30%)", score: team.performanceScore * 0.3, raw: team.performanceScore },
  { team: team.teamName, component: "Positional (15%)", score: team.positionalScore * 0.15, raw: team.positionalScore },
  { team: team.teamName, component: "Depth (5%)", score: team.depthScore * 0.05, raw: team.depthScore }
]);

const componentColors = {
  "Lineup value (50%)": T.brass,
  "Performance (30%)": T.slate,
  "Positional (15%)": T.ink4,
  "Depth (5%)": T.mauve
};

const stackedChartContent = html`
  <figure class="chart">
    <div class="chart__title">Power score components by team</div>
    <p class="chart__sub">Each bar stacks the four weighted components that make up the power score.</p>
    ${Plot.plot(plotTheme({
      marginLeft: 140,
      marginBottom: 40,
      height: rankings.length * 32 + 60,
      x: {
        label: "Contribution to power score",
        domain: [0, 100]
      },
      y: {
        label: null
      },
      color: {
        domain: Object.keys(componentColors),
        range: Object.values(componentColors),
        legend: true
      },
      marks: [
        Plot.barX(componentData, Plot.stackX({
          x: "score",
          y: "team",
          fill: "component",
          sort: {y: "-x", reduce: "sum"},
          tip: true,
          title: d => `${d.team}\n${d.component}: ${d.raw.toFixed(1)} raw → ${d.score.toFixed(1)}`
        })),
        Plot.ruleX([0], {stroke: T.hair2})
      ]
    }))}
  </figure>
`;

display(stackedChartContent);
```

## Team detail

```js
const teamSelector = Inputs.select(
  rankings.map(t => t.teamName),
  {
    label: "Team",
    value: rankings[0].teamName
  }
);
const selectedTeamName = Generators.input(teamSelector);
display(html`<div class="row">${teamSelector}</div>`);
```

```js
const selectedTeam = rankings.find(t => t.teamName === selectedTeamName);
const hasGames = (selectedTeam.wins + selectedTeam.losses) > 0;

const teamDeepDiveContent = html`
  <div class="stat-grid">
    <div class="stat stat--hero stat--brass">
      <div class="stat__k">Power score</div>
      <div class="stat__v">${selectedTeam.powerScore}</div>
      <div class="stat__l">#${selectedTeam.powerRank} of ${rankings.length}</div>
    </div>
    <div class="stat">
      <div class="stat__k">Total roster value</div>
      <div class="stat__v">${selectedTeam.totalRosterValue.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat__k">Record</div>
      <div class="stat__v">${selectedTeam.wins}-${selectedTeam.losses}</div>
      ${hasGames ? "" : html`<div class="stat__l">No games yet</div>`}
    </div>
    <div class="stat">
      <div class="stat__k">All-play record</div>
      <div class="stat__v">${selectedTeam.allPlayWins}-${selectedTeam.allPlayLosses}</div>
      <div class="stat__l">${selectedTeam.allPlayWinPct}% · appears after week 1</div>
    </div>
  </div>

  <h4>Component scores</h4>
  <div class="stat-grid">
    <div class="stat stat--brass"><div class="stat__k">Lineup value</div><div class="stat__v">${selectedTeam.lineupValueScore}</div></div>
    <div class="stat"><div class="stat__k">Performance</div><div class="stat__v">${selectedTeam.performanceScore}</div></div>
    <div class="stat"><div class="stat__k">Positional edge</div><div class="stat__v">${selectedTeam.positionalScore}</div></div>
    <div class="stat stat--muted"><div class="stat__k">Depth</div><div class="stat__v">${selectedTeam.depthScore}</div></div>
  </div>

  <h4>Optimal starting lineup</h4>
    <p class="muted text-sm">
      The best possible lineup by ${isDynasty ? 'dynasty trade value' : 'current-season value'}. This drives the lineup value score.
    </p>
    ${Inputs.table(selectedTeam.starters.sort((a, b) => b.value - a.value), {
      columns: ["slot", "name", "value"],
      header: {
        slot: "Slot",
        name: "Player",
        value: "Trade value"
      },
      format: {
        value: x => x.toLocaleString()
      },
      width: {
        slot: 100,
        name: 200,
        value: 100
      }
    })}
`;

display(teamDeepDiveContent);
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Beyond the record.</strong> Power rankings measure roster strength, not just wins and losses, so a lucky start does not mask a thin lineup.</li>
    <li><strong>Trades.</strong> Trading a star for several average players can look fair on paper but lowers your power score, because you can only start so many players. The lineup value component captures this.</li>
    <li><strong>Sources.</strong>
      ${isDynasty
        ? html`Values from <a href="https://github.com/dynastyprocess/data" target="_blank">DynastyProcess</a>.`
        : html`ECR from <a href="https://www.fantasycalc.com" target="_blank">FantasyCalc</a>; projections from Sleeper ROS.`}
      Scarcity by VOR (value over replacement). Updated ${new Date(powerData.lastUpdated || Date.now()).toLocaleDateString()}.
    </li>
  </ul>
</section>
