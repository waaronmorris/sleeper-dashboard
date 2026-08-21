<style>
  /* Page-local layout that has no component: the pick ledger rows and the pick-count chips. */
  .pick-list { display: flex; flex-direction: column; }
  .row--between { justify-content: space-between; }
  .card__meta { margin-top: var(--space-3); }
  .pick-row { display: grid; grid-template-columns: 3.5rem minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--hair); border-left: 2px solid var(--hair-2); }
  .pick-row:first-child { border-top: 1px solid var(--hair-2); }
  .pick-row--playoff { border-left-color: var(--ink-4); }
  .pick-row--traded { border-left-color: var(--brass); }
  .pick-row__team { font-weight: 600; color: var(--ink); }
  .pick-row__sub { font-size: var(--text-sm); color: var(--ink-3); margin-top: var(--space-1); }
  .pick-chip { display: inline-block; min-width: 1.75rem; padding: 0.2em 0.45em; border-radius: var(--radius); font-family: var(--font-mono); font-size: var(--text-xs); text-align: center; border: 1px solid var(--hair-2); color: var(--ink-2); }
  .pick-chip--none { color: var(--down); border-color: var(--down); }
  .pick-chip--acquired { color: var(--brass); border-color: var(--brass); background: var(--brass-soft); }
  .picks-table { width: max-content; min-width: 100%; }
  .picks-table .sticky-col { white-space: nowrap; }
  .picks-table thead th.sticky-col { z-index: 2; }
  .picks-table .rd-start { border-left: 1px solid var(--hair-2); }
  .picks-table .center { text-align: center; }
  .picks-table .year { color: var(--ink-4); font-weight: 400; }
  .legend-swatch { display: inline-block; width: 0.9rem; height: 0.9rem; border-radius: var(--radius); border: 1px solid var(--hair-2); vertical-align: middle; }
  .legend-swatch--acquired { background: var(--brass-soft); border-color: var(--brass); }
  .legend-swatch--none { border-color: var(--down); }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data
const draftOrderData = await FileAttachment("data/draft-order.json").json();
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
// This page only exists for the season in progress; the picker still mounts so the choice follows the reader.
const S = seasonsData.by_season[season];
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${draftOrderData.next_season} season · pre-season</p>
    <h1>Who picks <em>first</em> next year?</h1>
    <p class="lede">The ${draftOrderData.next_season} first-round order, who owns which picks, and how much draft capital each team holds for the next ${draftOrderData.future_seasons.length} seasons.</p>
    <p class="meta">Based on ${draftOrderData.season} results</p>
  </header>
  ${S.is_current ? '' : html`<aside class="note note--brass"><b>Showing the ${seasonsData.current} season.</b> This page is only available for the season in progress.</aside>`}
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Season</div><div class="stat__v">${draftOrderData.next_season}</div></div>
    <div class="stat"><div class="stat__k">Teams</div><div class="stat__v">${draftOrderData.total_teams}</div></div>
    <div class="stat"><div class="stat__k">Playoff teams</div><div class="stat__v">${draftOrderData.playoff_teams}</div></div>
    <div class="stat"><div class="stat__k">Non-playoff teams</div><div class="stat__v">${draftOrderData.total_teams - draftOrderData.playoff_teams}</div></div>
    <div class="stat"><div class="stat__k">Traded picks</div><div class="stat__v">${draftOrderData.traded_pick_count}</div></div>
  </div>
`);
```

## Round 1 draft order

```js
const draftOrder = draftOrderData.draft_order;

display(draftOrder.length === 0
  ? html`<aside class="note">No draft order yet. It appears once the ${draftOrderData.season} season has a final standings and playoff result.</aside>`
  : html`
  <div class="pick-list">
    ${draftOrder.map((pick, i) => html`
      <div class="pick-row ${pick.is_traded ? 'pick-row--traded' : pick.category === 'playoff' ? 'pick-row--playoff' : ''}">
        <div class="hero-num ${pick.is_traded ? 'hero-num--brass' : ''}">${pick.draft_position}</div>
        <div>
          <div class="pick-row__team">
            ${pick.is_traded
              ? html`<span class="brass">${pick.current_owner}</span> <span class="muted text-sm">(via ${pick.original_team})</span>`
              : pick.original_team
            }
          </div>
          <div class="pick-row__sub">
            ${pick.category === 'playoff'
              ? `Playoff finish: ${pick.playoff_finish === 1 ? 'Champion' : pick.playoff_finish === 2 ? 'Runner-up' : `#${pick.playoff_finish}`}`
              : `Max PF: ${pick.max_pf.toFixed(2)}`
            }
            ${pick.is_traded ? html` <span class="badge badge--brass">Traded</span>` : ''}
          </div>
        </div>
        <div class="text-right">
          <div class="mono text-sm ink-2">${pick.wins}-${pick.losses}</div>
          <div class="mono text-xs muted">${pick.max_pf.toFixed(1)} pts</div>
        </div>
      </div>
    `)}
  </div>
`);
```

## Future draft picks by owner

```js
const futureSeasons = draftOrderData.future_seasons;
const futurePicksByOwner = draftOrderData.future_picks_by_owner;
const rounds = [1, 2, 3, 4, 5];

// Calculate picks per round for each team (across all future seasons)
function getPicksPerRound(owner) {
  const picksByRound = {};
  for (const round of rounds) {
    picksByRound[round] = { own: 0, acquired: 0, traded: 0 };
  }

  for (const season of futureSeasons) {
    const seasonPicks = owner.picks_by_season[season];
    if (seasonPicks) {
      for (const pick of seasonPicks.own || []) {
        picksByRound[pick.round].own++;
      }
      for (const pick of seasonPicks.acquired || []) {
        picksByRound[pick.round].acquired++;
      }
      for (const pick of seasonPicks.traded_away || []) {
        picksByRound[pick.round].traded++;
      }
    }
  }

  return picksByRound;
}

display(html`
  <p class="muted text-sm">
    Each team's draft capital by round for the next ${futureSeasons.length} seasons (${futureSeasons.join(', ')}). Numbers are total picks owned in that round. Brass means at least one pick came in by trade; ember means the team holds none.
  </p>
`);
```

```js
// Calculate picks per round AND per season for each team
function getPicksPerRoundAndSeason(owner) {
  const picksByRoundSeason = {};
  for (const round of rounds) {
    picksByRoundSeason[round] = {};
    for (const season of futureSeasons) {
      picksByRoundSeason[round][season] = { own: 0, acquired: 0, traded: 0 };
    }
  }

  for (const season of futureSeasons) {
    const seasonPicks = owner.picks_by_season[season];
    if (seasonPicks) {
      for (const pick of seasonPicks.own || []) {
        picksByRoundSeason[pick.round][season].own++;
      }
      for (const pick of seasonPicks.acquired || []) {
        picksByRoundSeason[pick.round][season].acquired++;
      }
      for (const pick of seasonPicks.traded_away || []) {
        picksByRoundSeason[pick.round][season].traded++;
      }
    }
  }

  return picksByRoundSeason;
}

// Only show first 3 rounds for cleaner display
const displayRounds = rounds.slice(0, 3);

// Build table HTML as a raw string to avoid Observable's span wrapping issue
const roundHeaders = displayRounds.map(round =>
  `<th colspan="${futureSeasons.length}" class="center rd-start">Rd ${round}</th>`
).join('');

const yearHeaders = displayRounds.flatMap(round =>
  futureSeasons.map((season, sIdx) =>
    `<th class="center year${sIdx === 0 ? ' rd-start' : ''}">${season}</th>`
  )
).join('');

const tableRows = futurePicksByOwner.map((owner, idx) => {
  const picksByRoundSeason = getPicksPerRoundAndSeason(owner);
  const dataCells = displayRounds.flatMap(round =>
    futureSeasons.map((season, sIdx) => {
      const data = picksByRoundSeason[round][season];
      const total = data.own + data.acquired;
      const hasAcquired = data.acquired > 0;
      const chipClass = total === 0 ? 'pick-chip--none' : hasAcquired ? 'pick-chip--acquired' : '';
      const title = `${season} Round ${round}: ${data.own} own + ${data.acquired} acquired${data.traded > 0 ? ` (${data.traded} traded away)` : ''}`;
      return `<td class="center${sIdx === 0 ? ' rd-start' : ''}">
        <span class="pick-chip ${chipClass}" title="${title}">${total}</span>
      </td>`;
    })
  ).join('');

  const netClass = owner.net_picks > 0 ? 'up' : owner.net_picks < 0 ? 'down' : 'muted';

  return `<tr>
    <td class="sticky-col">${owner.team}</td>
    ${dataCells}
    <td class="num rd-start">${owner.total_picks}</td>
    <td class="num ${netClass}">${owner.net_picks > 0 ? '+' : ''}${owner.net_picks}</td>
  </tr>`;
}).join('');

const tableHtml = `
  <div class="table-wrap">
    <table class="picks-table">
      <thead>
        <tr>
          <th rowspan="2" class="sticky-col">Team</th>
          ${roundHeaders}
          <th rowspan="2" class="num rd-start">Total</th>
          <th rowspan="2" class="num">Net</th>
        </tr>
        <tr>
          ${yearHeaders}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
`;

// Create a container and set innerHTML to render the raw HTML string
const tableContainer = document.createElement('div');
tableContainer.innerHTML = tableHtml;
display(tableContainer);
```

## Draft capital summary

```js
display(html`
  <div class="grid grid-3">
    ${futurePicksByOwner.slice(0, 6).map(owner => html`
      <div class="card card--tight">
        <div class="row row--between">
          <div class="card__title mb-0">${owner.team}</div>
          <div class="card__v">${owner.total_picks}</div>
        </div>
        <div class="row text-sm card__meta">
          <div><span class="muted">Acquired</span> <span class="mono">${owner.total_acquired}</span></div>
          <div><span class="muted">Traded</span> <span class="mono">${owner.total_traded_away}</span></div>
          <div><span class="muted">Net</span> ${owner.net_picks === 0 ? html`<span class="mono muted">0</span>` : html`<span class="delta ${owner.net_picks > 0 ? 'up' : 'down'}">${owner.net_picks > 0 ? '+' : ''}${owner.net_picks}</span>`}</div>
        </div>
      </div>
    `)}
  </div>
`);
```

## Round 1 picks by owner <span class="section-meta">${draftOrderData.next_season}</span>

```js
const picksByOwner = draftOrderData.picks_by_owner
  .map(owner => ({
    ...owner,
    total_picks: owner.own_picks.length + owner.acquired_picks.length,
    picks_traded_away: draftOrder.filter(p => p.original_roster_id === owner.roster_id && p.is_traded).length
  }))
  .sort((a, b) => b.total_picks - a.total_picks);

display(html`
  <p class="muted text-sm">
    Who holds each first-round pick in the ${draftOrderData.next_season} draft.
  </p>
`);

display(html`
  <div class="grid grid-3">
    ${picksByOwner.map(owner => html`
      <div class="card card--tight">
        <div class="card__title">${owner.team}</div>
        <div class="row">
          <div>
            <div class="card__v">${owner.total_picks}</div>
            <div class="card__k">Total picks</div>
            ${owner.total_picks !== 1 ? html`<span class="delta ${owner.total_picks > 1 ? 'up' : 'down'}">${owner.total_picks > 1 ? '+' : ''}${owner.total_picks - 1}</span>` : ''}
          </div>
          ${owner.own_picks.length > 0 ? html`
            <div class="text-sm ink-2">Own: ${owner.own_picks.map(p => `#${p.draft_position}`).join(', ')}</div>
          ` : ''}
          ${owner.acquired_picks.length > 0 ? html`
            <div class="text-sm brass">Acquired: ${owner.acquired_picks.map(p => `#${p.draft_position} (${p.from_team})`).join(', ')}</div>
          ` : ''}
          ${owner.picks_traded_away > 0 ? html`
            <div class="text-sm ink-2">Traded away: ${owner.picks_traded_away}</div>
          ` : ''}
        </div>
      </div>
    `)}
  </div>
`);
```

## Draft order by category

```js
const nonPlayoffTeams = draftOrder.filter(t => t.category === 'non-playoff');
const playoffTeams = draftOrder.filter(t => t.category === 'playoff');
```

### Non-playoff teams

```js
display(html`
  <p class="muted text-sm">
    Teams that missed the playoffs, ordered by lowest max PF (total season points).
  </p>
`);

display(Inputs.table(nonPlayoffTeams, {
  columns: ["draft_position", "current_owner", "original_team", "is_traded", "max_pf", "wins", "losses"],
  header: {
    draft_position: "Pick",
    current_owner: "Owner",
    original_team: "Original",
    is_traded: "Traded?",
    max_pf: "Max PF",
    wins: "W",
    losses: "L"
  },
  format: {
    is_traded: x => x ? "Yes" : "No",
    max_pf: x => x.toFixed(2)
  },
  width: {
    draft_position: 60,
    current_owner: 140,
    original_team: 140,
    is_traded: 70,
    max_pf: 100,
    wins: 50,
    losses: 50
  }
}));
```

### Playoff teams

```js
display(html`
  <p class="muted text-sm">
    Teams that made the playoffs, picking in reverse order of playoff finish. The champion picks last.
  </p>
`);

display(Inputs.table(playoffTeams, {
  columns: ["draft_position", "current_owner", "original_team", "is_traded", "playoff_finish", "wins", "losses"],
  header: {
    draft_position: "Pick",
    current_owner: "Owner",
    original_team: "Original",
    is_traded: "Traded?",
    playoff_finish: "Playoff finish",
    wins: "W",
    losses: "L"
  },
  format: {
    is_traded: x => x ? "Yes" : "No",
    playoff_finish: x => x === 1 ? "Champion" : x === 2 ? "Runner-up" : `#${x}`
  },
  width: {
    draft_position: 60,
    current_owner: 140,
    original_team: 140,
    is_traded: 70,
    playoff_finish: 100,
    wins: 50,
    losses: 50
  }
}));
```

## Maximum points distribution

```js
const maxPfMax = d3.max(draftOrder, d => d.max_pf) || 0;

display(maxPfMax === 0
  ? html`<aside class="note">No season points yet. This chart fills in once the ${draftOrderData.season} season has scored games.</aside>`
  : html`<figure class="chart">
      <div class="chart__title">Maximum points by team, highest to lowest</div>
      <p class="chart__sub">Playoff teams in ink, non-playoff teams in ember. The label on each bar is the team's ${draftOrderData.next_season} pick.</p>
      ${Plot.plot(plotTheme({
        marginLeft: 150,
        height: Math.max(400, draftOrder.length * 35),
        x: {
          label: "Maximum points (total season points)",
          domain: [0, Math.max(1, maxPfMax)]
        },
        y: {
          label: null
        },
        marks: [
          Plot.barX(draftOrder, {
            x: "max_pf",
            y: "original_team",
            fill: d => d.category === 'playoff' ? T.ink4 : T.down,
            sort: { y: "-x" }
          }),
          Plot.text(draftOrder, {
            x: "max_pf",
            y: "original_team",
            text: d => `#${d.draft_position}`,
            dx: -16,
            fill: T.ink,
            fontWeight: "500"
          }),
          Plot.ruleX([0], {stroke: T.hair2})
        ]
      }))}
    </figure>`);
```

```js
display(html`<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Picks 1–${draftOrderData.total_teams - draftOrderData.playoff_teams}:</strong> non-playoff teams, ordered by <em>lowest max PF</em> (total season points).</li>
    <li><strong>Picks ${draftOrderData.total_teams - draftOrderData.playoff_teams + 1}–${draftOrderData.total_teams}:</strong> playoff teams, in reverse order of playoff finish. The champion picks last.</li>
    <li><strong>Traded picks</strong> show the current owner. Picks may have changed hands since the season ended.</li>
    <li><span class="legend-swatch"></span> <strong>Own picks.</strong> The team still holds its native pick in that round.</li>
    <li><span class="legend-swatch legend-swatch--acquired"></span> <strong>Acquired by trade.</strong> At least one pick in that round came from another team.</li>
    <li><span class="legend-swatch legend-swatch--none"></span> <strong>None.</strong> The team holds no pick in that round; its own pick was sent to another team.</li>
  </ul>
</section>`);
```
