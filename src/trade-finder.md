<style>
  .trade-side { display: flex; flex-direction: column; gap: var(--space-3); }
  .trade-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .trade-player { display: flex; justify-content: space-between; gap: var(--space-3); padding-left: var(--space-3); }
  .trade-upgrades { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--hair); }
  .need-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
  .need-score { margin-bottom: var(--space-2); }
  .trade-stack > * + * { margin-top: var(--space-4); }
  .row--between { justify-content: space-between; }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme, diverging} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";
```

```js
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
const S = seasonsData.by_season[season];
```

```js
const tradeData = await FileAttachment("data/trade-recommendations.json").json();
const recommendations = tradeData.recommendations;
const teams = tradeData.teams;
const league = tradeData.league;
```

```js
// Stats
const winWinTrades = recommendations.filter(t => t.bothHaveUpgrades).length;
const totalTrades = recommendations.length;
const teamsWithNeeds = teams.filter(t =>
  Object.values(t.needs).some(n => n.isNeed)
).length;
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${seasonsData.current} season · ${(seasonsData.by_season[seasonsData.current]?.status ?? "in season").replace(/_/g, " ")} · ${league.name}${league.isSuperFlex ? " · superflex" : ""}</p>
    <h1>Trades where <em>both</em> sides get better</h1>
    <p class="lede">Pairs each team's positional needs with another team's surplus, scored by power value, to surface fair trades worth proposing.</p>
    <p class="meta">Based on current rosters and power values · ${teams.length} teams</p>
  </header>
  ${S.is_current ? '' : html`<aside class="note note--brass"><b>Showing the ${seasonsData.current} season.</b> This page is only available for the season in progress.</aside>`}
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Win-win trades</div><div class="stat__v">${winWinTrades}</div><div class="stat__l">Both teams get a starter upgrade</div></div>
    <div class="stat"><div class="stat__k">Trade options</div><div class="stat__v">${totalTrades}</div><div class="stat__l">Fair-value exchanges found</div></div>
    <div class="stat"><div class="stat__k">Teams with a need</div><div class="stat__v">${teamsWithNeeds}</div><div class="stat__l">Could benefit from a trade</div></div>
  </div>
`);
```

## Team needs

```js
const teamOptions = [
  { value: "all", label: "All teams" },
  ...teams.map(t => ({ value: t.rosterId.toString(), label: t.teamName }))
];

const teamSelector = Inputs.select(teamOptions, {
  label: "Team",
  format: d => d.label,
  value: teamOptions[0]
});

const selectedTeam = Generators.input(teamSelector);
```

<div class="row">
  ${teamSelector}
</div>

```js
// Filter recommendations based on selected team
const filteredRecs = selectedTeam.value === "all"
  ? recommendations
  : recommendations.filter(r =>
      r.team1Id.toString() === selectedTeam.value ||
      r.team2Id.toString() === selectedTeam.value
    );

// Get selected team's needs if specific team selected
const selectedTeamData = selectedTeam.value !== "all"
  ? teams.find(t => t.rosterId.toString() === selectedTeam.value)
  : null;
```

```js
// Display team needs if a specific team is selected
function renderTeamNeeds(team) {
  if (!team) return html`<aside class="note">Pick a team above to see where it is short and where it has depth to trade.</aside>`;

  const positions = ['QB', 'RB', 'WR', 'TE'];

  return html`
    <div class="card">
      <div class="card__title">${team.teamName} by position</div>
      <div class="grid grid-4">
        ${positions.map(pos => {
          const need = team.needs[pos];
          const status = need.isNeed ? 'Need' : need.isSurplus ? 'Surplus' : 'OK';
          const badgeClass = need.isNeed ? 'badge badge--down' : need.isSurplus ? 'badge badge--brass' : 'badge';

          return html`
            <div class="card card--tight">
              <div class="need-head">
                <span class="badge badge--pos-${pos.toLowerCase()}">${pos}</span>
                <span class="${badgeClass}">${status}</span>
              </div>
              <div class="need-score mono text-sm muted">Score ${need.needScore}</div>
              <div class="text-xs ink-2">
                Starters: ${need.starters.map(p => p.name.split(' ').pop()).join(', ') || 'none'}
              </div>
              ${need.bench.length > 0 ? html`
                <div class="text-xs muted">
                  Bench: ${need.bench.slice(0, 3).map(p => p.name.split(' ').pop()).join(', ')}${need.bench.length > 3 ? '…' : ''}
                </div>
              ` : ''}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

display(renderTeamNeeds(selectedTeamData));
```

## Suggested trades

```js
const showOnlyWinWin = Inputs.toggle({label: "Win-win only", value: false});
const winWinFilter = Generators.input(showOnlyWinWin);
```

<div class="row">
  ${showOnlyWinWin}
</div>

```js
const displayRecs = winWinFilter
  ? filteredRecs.filter(r => r.bothHaveUpgrades)
  : filteredRecs;
```

```js
function renderPlayer(p, showStar) {
  return html`
    <div class="trade-player text-sm">
      <span class="ink-2">${p.name} <span class="muted">(${p.position})</span>${showStar && p.isStarter ? html` <span class="badge badge--brass">starter</span>` : ''}</span>
      <span class="mono muted num">${p.value.toLocaleString()}</span>
    </div>
  `;
}

function renderSide(name, gives, receives, impact) {
  return html`
    <div class="card card--tight trade-side">
      <div class="card__title">${name}</div>
      <div>
        <div class="eyebrow down">Gives</div>
        <div class="trade-list">${gives.map(p => renderPlayer(p, true))}</div>
      </div>
      <div>
        <div class="eyebrow up">Receives</div>
        <div class="trade-list">${receives.map(p => renderPlayer(p, false))}</div>
      </div>
      ${impact.starterUpgrades?.length > 0 ? html`
        <div class="trade-upgrades">
          <div class="eyebrow up">Lineup upgrades</div>
          ${impact.starterUpgrades.map(u => html`
            <div class="text-xs muted trade-player">
              <span>${u.newPlayer.split(' ').pop()} replaces ${u.replaces.split(' ').pop()}</span>
              <span class="mono up">+${u.improvement}</span>
            </div>
          `)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderTradeCard(trade, index) {
  const badges = [];
  if (trade.bothHaveUpgrades) badges.push({ text: 'Win-win', cls: 'badge badge--brass badge--solid' });
  else if (trade.bothImprove) badges.push({ text: 'Mutual benefit', cls: 'badge badge--slate' });
  if (trade.fairExchange) badges.push({ text: 'Fair value', cls: 'badge' });

  return html`
    <div class="card">
      <div class="row row--between">
        <div>
          <span class="rank">${index + 1}</span>
          <span class="text-sm ink-2">${trade.type} · ${trade.positionSwap}</span>
        </div>
        <div class="row">
          ${badges.map(b => html`<span class="${b.cls}">${b.text}</span>`)}
        </div>
      </div>

      <div class="grid grid-2">
        ${renderSide(trade.team1Name, trade.team1Gives, trade.team2Gives, trade.team1Impact)}
        ${renderSide(trade.team2Name, trade.team2Gives, trade.team1Gives, trade.team2Impact)}
      </div>

      <div class="card__foot row row--between">
        <span>Trade score <strong class="mono">${trade.score}</strong></span>
        <span class="mono">${trade.team1Impact.valueGiven.toLocaleString()} ↔ ${trade.team2Impact.valueGiven.toLocaleString()}</span>
      </div>
    </div>
  `;
}

const shown = displayRecs.slice(0, 20);
const firstFive = shown.slice(0, 5);
const rest = shown.slice(5);

display(html`
  <div class="trade-stack">
    ${shown.length === 0
      ? html`<aside class="note">No trades match these filters. Clear the win-win toggle or pick another team; new suggestions appear when rosters or values change.</aside>`
      : firstFive.map((trade, i) => renderTradeCard(trade, i))
    }
    ${rest.length > 0 ? html`
      <details class="section-collapse" open>
        <summary class="section-summary">More suggestions <small>${rest.length} more of ${displayRecs.length}</small></summary>
        <div class="section-content trade-stack">
          ${rest.map((trade, i) => renderTradeCard(trade, i + 5))}
        </div>
      </details>
      ${displayRecs.length > 20 ? html`<p class="text-sm muted">Showing the top 20 of ${displayRecs.length} suggestions</p>` : ''}
    ` : ''}
  </div>
`);
```

## Needs across the league

```js
const needsData = [];
teams.forEach(team => {
  ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
    const need = team.needs[pos];
    needsData.push({
      team: team.teamName,
      position: pos,
      needScore: need.needScore,
      status: need.isNeed ? 'Need' : need.isSurplus ? 'Surplus' : 'OK'
    });
  });
});
```

```js
display(html`<figure class="chart">
  <div class="chart__title">Need score by team and position</div>
  <p class="chart__sub">Negative (ember) is a need, positive (green) is a surplus; the letter in each cell states it outright.</p>
  ${Plot.plot(plotTheme({
    width: Math.min(width, 720),
    marginLeft: width < 640 ? 90 : 120,
    marginBottom: 40,
    height: teams.length * 35 + 80,
    x: { label: null, domain: ['QB', 'RB', 'WR', 'TE'], grid: false },
    y: { label: null, grid: false },
    color: {
      type: "diverging",
      domain: [-50, 50],
      pivot: 0,
      clamp: true,
      range: diverging,
      legend: true,
      label: "Need score (negative = need, positive = surplus)"
    },
    marks: [
      Plot.cell(needsData, {
        x: "position",
        y: "team",
        fill: "needScore",
        inset: 1,
        tip: true,
        title: d => `${d.team}\n${d.position}: ${d.status}\nScore: ${d.needScore}`
      }),
      Plot.text(needsData, {
        x: "position",
        y: "team",
        text: d => d.status === 'Need' ? 'N' : d.status === 'Surplus' ? 'S' : '·',
        fill: d => Math.abs(d.needScore) > 35 ? T.ground : T.ink,
        fontSize: 12,
        fontWeight: 600
      })
    ]
  }))}
</figure>`);
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Needs and surpluses.</strong> Each roster is scored by position; a negative score is a need, a positive score is depth that could be traded.</li>
    <li><strong>Pairing.</strong> Teams with complementary gaps are matched and each exchange is scored for fairness using power value, so the numbers on both sides should be close.</li>
    <li><strong>Win-win.</strong> A trade is win-win when both teams receive a player who would start for them right away. "Mutual benefit" means both improve on value without a guaranteed new starter.</li>
    <li><strong>Current season only.</strong> Suggestions are built from current rosters and values; there is no history for past seasons.</li>
  </ul>
</section>
