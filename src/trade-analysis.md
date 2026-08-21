<style>
  .trade { margin-bottom: var(--space-5); }
  .trade__head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-3); padding-bottom: var(--space-4); border-bottom: 1px solid var(--hair); }
  .trade__parties { font-family: var(--font-display); font-size: var(--text-xl); color: var(--ink); line-height: 1.2; }
  .trade__sides { margin: var(--space-4) 0; }
  .trade__side { padding: var(--space-4); border: 1px solid var(--hair); border-radius: var(--radius); }
  .trade__side.trade-side--win { border-left: 3px solid var(--brass); }
  .trade__side-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
  .trade__team { font-weight: 600; color: var(--ink); }
  .trade__list { font-size: var(--text-sm); color: var(--ink-2); }
  .trade__take { white-space: pre-wrap; line-height: 1.7; color: var(--ink-2); margin-top: var(--space-2); }
  .trade__foot { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--hair); }
  .filters { margin: var(--space-5) 0; }
  .pager { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-4); }
  .empty { text-align: center; padding: var(--space-6); }
  .empty code { display: inline-block; margin-top: var(--space-3); }
</style>

```js
import {mountSeasonPicker} from "./components/season.js";

// Load data first
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
const tradeAnalyses = await FileAttachment("data/trade-analysis.json").json();
const trades = await FileAttachment("data/trades.json").json();
const players = await FileAttachment("data/players.json").json();

// Load power rankings data for trade impact
let powerData = null;
try {
  powerData = await FileAttachment("data/power-rankings.json").json();
} catch (e) {
  console.log("Power rankings data not available");
}
const playerValues = powerData?.playerValues || {};
const powerRankings = powerData?.rankings || [];
const leagueInfo = powerData?.league || {};
const valueSource = leagueInfo.valueSource || {};
const scarcityMultipliers = valueSource.scarcityMultipliers || null;
const isDynasty = leagueInfo.leagueType === 'dynasty' || !leagueInfo.leagueType;
const isRedraft = leagueInfo.leagueType === 'redraft';

// Position badge classes for display
const posBadge = {
  QB: 'badge--pos-qb',
  RB: 'badge--pos-rb',
  WR: 'badge--pos-wr',
  TE: 'badge--pos-te',
  K: 'badge--pos-k',
  DEF: 'badge--pos-def',
  PICK: 'badge--slate'
};

// Default scarcity multipliers
const defaultScarcity = {
  QB: leagueInfo.isSuperFlex ? 140 : 80,
  RB: 150,
  WR: 100,
  TE: 120,
  K: 20,
  DEF: 25
};
const displayScarcity = scarcityMultipliers || defaultScarcity;

const leagueTypeLabel = isDynasty ? 'Dynasty' : 'Redraft';
```

```js
// Season bundle from the global picker: team names and rosters follow the chosen season
const S = seasonsData.by_season[season];
const rosters = S.rosters || [];
const users = S.users || [];
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · trade commentary</p>
    <h1>Every trade, <em>graded</em> after the fact</h1>
    <p class="lede">Each deal in league history, valued at the time it was made and narrated by a rotating panel of analyst personas.</p>
    <p class="meta">${leagueTypeLabel} values · ${isDynasty ? 'dynasty asset prices and long-term outlook' : 'VOR-weighted current-season production'}</p>
  </header>
`);
```

<div class="row filters">

```js
const searchInput = view(Inputs.text({
  label: "Search",
  placeholder: "Player, manager, or keyword",
  width: 280,
  value: ""
}));
```

```js
// Default follows the global picker; "All Seasons" only when the picker is on the current season
const seasonDefault = (season !== seasonsData.current && allSeasons.includes(season)) ? season : "All Seasons";
const selectedSeason = view(Inputs.select(
  ["All Seasons", ...allSeasons],
  { label: "Season", value: seasonDefault }
));
```

```js
const selectedPersona = view(Inputs.select(
  ["All Analysts", ...allPersonas],
  { label: "Analyst", value: "All Analysts" }
));
```

```js
const selectedManager = view(Inputs.select(
  ["All Managers", ...allManagers],
  { label: "Manager", value: "All Managers" }
));
```

```js
const sortOption = view(Inputs.select(
  ["Newest First", "Oldest First", "Biggest Wins", "Biggest Losses", "Most Lopsided", "Highest Value"],
  { label: "Sort by", value: "Newest First" }
));
```

</div>

```js
// Helper to get player name
function getPlayerName(playerId) {
  const player = players[playerId];
  if (!player) return playerId;
  return `${player.first_name} ${player.last_name}`;
}

// Helper to get user by roster ID
function getUserByRosterId(rosterId) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return null;
  return users.find(u => u.user_id === roster.owner_id);
}

// Calculate trade value impact
function calculateTradeImpact(trade) {
  if (!trade || !playerValues || Object.keys(playerValues).length === 0) return null;

  const rosterIds = new Set([
    ...Object.values(trade.adds || {}),
    ...Object.values(trade.drops || {})
  ]);

  const impacts = {};

  Array.from(rosterIds).forEach(rosterId => {
    const user = getUserByRosterId(rosterId);
    const userName = user?.display_name || `Team ${rosterId}`;

    let valueReceived = 0;
    let valueGiven = 0;
    const playersReceived = [];
    const playersGiven = [];

    if (trade.adds) {
      Object.entries(trade.adds).forEach(([playerId, rId]) => {
        if (rId === rosterId) {
          const pv = playerValues[playerId];
          if (pv) {
            valueReceived += pv.value;
            playersReceived.push({ name: pv.name, value: pv.value, position: pv.position });
          }
        }
      });
    }

    if (trade.drops) {
      Object.entries(trade.drops).forEach(([playerId, rId]) => {
        if (rId === rosterId) {
          const pv = playerValues[playerId];
          if (pv) {
            valueGiven += pv.value;
            playersGiven.push({ name: pv.name, value: pv.value, position: pv.position });
          }
        }
      });
    }

    const netValue = valueReceived - valueGiven;
    impacts[rosterId] = {
      userName,
      valueReceived,
      valueGiven,
      netValue,
      playersReceived,
      playersGiven,
      isWinner: netValue > 500,
      isLoser: netValue < -500
    };
  });

  return impacts;
}

// Match analyses to trade details
const enrichedAnalyses = tradeAnalyses.map(analysis => {
  const trade = trades.find(t => {
    return analysis.participants.every(participantName => {
      const rosterIds = new Set([
        ...Object.values(t.adds || {}),
        ...Object.values(t.drops || {})
      ]);
      return Array.from(rosterIds).some(rosterId => {
        const user = getUserByRosterId(rosterId);
        return user?.display_name === participantName;
      });
    }) && t.week === analysis.week && t.season === analysis.season;
  });

  const tradeImpact = calculateTradeImpact(trade);

  return {
    ...analysis,
    trade,
    tradeImpact
  };
});

// Filter options
const allSeasons = [...new Set(enrichedAnalyses.map(a => a.season))].sort((a, b) => b.localeCompare(a));
const allPersonas = [...new Set(enrichedAnalyses.map(a => a.persona))].sort();
const allManagers = [...new Set(enrichedAnalyses.flatMap(a => a.participants))].sort();
```

```js
// Summary Stats
const totalTrades = enrichedAnalyses.length;
const tradesBySeason = Object.fromEntries(
  allSeasons.map(s => [s, enrichedAnalyses.filter(a => a.season === s).length])
);
const totalWins = enrichedAnalyses.reduce((sum, a) => {
  if (!a.tradeImpact) return sum;
  return sum + Object.values(a.tradeImpact).filter(i => i.isWinner).length;
}, 0);
```

<div class="stat-grid">
  <div class="stat"><div class="stat__k">Trades analyzed</div><div class="stat__v">${totalTrades}</div></div>
  <div class="stat"><div class="stat__k">Seasons</div><div class="stat__v">${allSeasons.length}</div></div>
  <div class="stat"><div class="stat__k">Analysts</div><div class="stat__v">${allPersonas.length}</div></div>
  <div class="stat"><div class="stat__k">Managers involved</div><div class="stat__v">${allManagers.length}</div></div>
</div>

## Trades

```js
// Apply filters
let filteredAnalyses = enrichedAnalyses;

// Search filter
if (searchInput && searchInput.trim().length > 0) {
  const query = searchInput.toLowerCase().trim();
  filteredAnalyses = filteredAnalyses.filter(a => {
    // Search in participants
    const participantMatch = a.participants.some(p => p.toLowerCase().includes(query));
    // Search in analysis text
    const analysisMatch = a.analysis.toLowerCase().includes(query);
    // Search in player names from sides
    const playerMatch = a.sides?.some(side =>
      [...(side.receives || []), ...(side.gives || [])].some(p =>
        p.name?.toLowerCase().includes(query)
      )
    );
    return participantMatch || analysisMatch || playerMatch;
  });
}

// Season filter
if (selectedSeason !== "All Seasons") {
  filteredAnalyses = filteredAnalyses.filter(a => a.season === selectedSeason);
}

// Persona filter
if (selectedPersona !== "All Analysts") {
  filteredAnalyses = filteredAnalyses.filter(a => a.persona === selectedPersona);
}

// Manager filter
if (selectedManager !== "All Managers") {
  filteredAnalyses = filteredAnalyses.filter(a => a.participants.includes(selectedManager));
}

// Helper to get max net value from a trade (for sorting)
function getMaxNetValue(analysis) {
  if (!analysis.tradeImpact) return 0;
  return Math.max(...Object.values(analysis.tradeImpact).map(i => i.netValue || 0));
}

function getMinNetValue(analysis) {
  if (!analysis.tradeImpact) return 0;
  return Math.min(...Object.values(analysis.tradeImpact).map(i => i.netValue || 0));
}

function getLopsidedValue(analysis) {
  if (!analysis.tradeImpact) return 0;
  const values = Object.values(analysis.tradeImpact).map(i => i.netValue || 0);
  return Math.abs(Math.max(...values) - Math.min(...values));
}

function getTotalValue(analysis) {
  if (!analysis.tradeImpact) return 0;
  return Object.values(analysis.tradeImpact).reduce((sum, i) => sum + (i.valueReceived || 0), 0);
}

// Apply sorting
switch (sortOption) {
  case "Newest First":
    filteredAnalyses = filteredAnalyses.sort((a, b) => {
      if (b.season !== a.season) return b.season.localeCompare(a.season);
      return b.week - a.week;
    });
    break;
  case "Oldest First":
    filteredAnalyses = filteredAnalyses.sort((a, b) => {
      if (a.season !== b.season) return a.season.localeCompare(b.season);
      return a.week - b.week;
    });
    break;
  case "Biggest Wins":
    filteredAnalyses = filteredAnalyses.sort((a, b) => getMaxNetValue(b) - getMaxNetValue(a));
    break;
  case "Biggest Losses":
    filteredAnalyses = filteredAnalyses.sort((a, b) => getMinNetValue(a) - getMinNetValue(b));
    break;
  case "Most Lopsided":
    filteredAnalyses = filteredAnalyses.sort((a, b) => getLopsidedValue(b) - getLopsidedValue(a));
    break;
  case "Highest Value":
    filteredAnalyses = filteredAnalyses.sort((a, b) => getTotalValue(b) - getTotalValue(a));
    break;
}

// Pagination
const PAGE_SIZE = 5;
const totalPages = Math.max(1, Math.ceil(filteredAnalyses.length / PAGE_SIZE));
```

```js
const currentPage = view(Inputs.range([1, totalPages], {
  label: "Page",
  step: 1,
  value: 1,
  width: 150
}));
```

```js
const startIndex = (currentPage - 1) * PAGE_SIZE;
const endIndex = Math.min(startIndex + PAGE_SIZE, filteredAnalyses.length);
const paginatedAnalyses = filteredAnalyses.slice(startIndex, endIndex);
```

```js
// Display analyses
if (tradeAnalyses.length === 0) {
  display(html`
    <aside class="note empty">
      <p><b>No trade commentary yet.</b> Analyses appear once they are generated from the league's trade log.</p>
      <code class="mono">node src/data/generate-trade-analysis.js</code>
    </aside>
  `);
} else if (filteredAnalyses.length === 0) {
  display(html`
    <aside class="note empty">
      <p><b>No trades match.</b> Clear the search or widen the season, analyst, or manager filters.</p>
    </aside>
  `);
} else {
  display(html`
    <div class="pager">
      <div class="muted text-sm">Showing <span class="ink-2 num">${startIndex + 1}–${endIndex}</span> of <span class="ink-2 num">${filteredAnalyses.length}</span> trades</div>
      <div class="eyebrow mb-0">Page ${currentPage} of ${totalPages}</div>
    </div>
  `);
  paginatedAnalyses.forEach((analysis) => {
    // Determine winner/loser for styling
    let hasWinner = false;
    let hasLoser = false;
    if (analysis.tradeImpact) {
      hasWinner = Object.values(analysis.tradeImpact).some(i => i.isWinner);
      hasLoser = Object.values(analysis.tradeImpact).some(i => i.isLoser);
    }

    display(html`
      <article class="card trade">
        <div class="trade__head">
          <div>
            <div class="eyebrow">${analysis.season} season · Week ${analysis.week}</div>
            <div class="trade__parties">${analysis.participants.join(' ⇄ ')}</div>
          </div>
          <div class="row">
            ${hasWinner && hasLoser ? html`<span class="badge badge--brass">Lopsided</span>` : ''}
            <span class="badge">${analysis.persona}</span>
          </div>
        </div>

        ${analysis.sides ? html`
          <div class="grid grid-2 trade__sides">
            ${analysis.sides.map(side => {
              const impact = side.tradeImpact;
              const isWinner = impact?.netValueChange > 500;
              const isLoser = impact?.netValueChange < -500;
              const netClass = impact ? (impact.netValueChange > 0 ? 'up' : impact.netValueChange < 0 ? 'down' : 'muted') : '';

              return html`
                <div class="trade__side ${isWinner ? 'trade-side--win' : ''}">
                  <div class="trade__side-head">
                    <div class="trade__team ${isWinner ? 'brass' : ''}">${side.teamName}</div>
                    ${impact ? html`
                      <div class="row">
                        <span class="num text-sm ${netClass}">${impact.netValueChange > 0 ? '+' : ''}${impact.netValueChange.toLocaleString()}</span>
                        ${isWinner ? html`<span class="badge badge--brass">Won</span>` : ''}
                      </div>
                    ` : ''}
                  </div>

                  ${side.powerScore ? html`
                    <div class="muted text-xs mono">Power rank #${side.powerScore.powerRank} (${side.powerScore.powerScore}) · ${side.teamContext || ''}</div>
                  ` : ''}

                  ${side.receives?.length > 0 ? html`
                    <div>
                      <h4 class="up">Receives</h4>
                      <div class="trade__list">${side.receives.map(a => a.position === 'PICK' ? a.name : `${a.name} (${a.position})`).join(', ')}</div>
                      ${impact ? html`<div class="text-xs num up">+${impact.valueGained.toLocaleString()} value</div>` : ''}
                    </div>
                  ` : ''}

                  ${side.gives?.length > 0 ? html`
                    <div>
                      <h4 class="down">Gives</h4>
                      <div class="trade__list">${side.gives.map(a => a.position === 'PICK' ? a.name : `${a.name} (${a.position})`).join(', ')}</div>
                      ${impact ? html`<div class="text-xs num down">-${impact.valueLost.toLocaleString()} value</div>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>
        ` : ''}

        <div>
          <h4>${analysis.persona}'s take</h4>
          <div class="trade__take">${analysis.analysis}</div>
        </div>

        <div class="trade__foot muted text-xs mono">
          Generated ${new Date(analysis.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </article>
    `);
  });
}
```

## The analysts

<div class="grid grid-3">

<div class="card card--tight">
  <div class="card__title">Mel Kiper Jr.</div>
  <p class="text-sm muted mb-0">Draft expert with detailed player evaluations. Focuses on talent assessment, rankings, and player upside.</p>
</div>

<div class="card card--tight">
  <div class="card__title">Adam Schefter</div>
  <p class="text-sm muted mb-0">NFL insider with a breaking-news style. Provides context, league implications, and behind-the-scenes perspective.</p>
</div>

<div class="card card--tight">
  <div class="card__title">Daniel Jeremiah</div>
  <p class="text-sm muted mb-0">Former scout with an analytical lens. Evaluates through talent metrics, scheme fit, and production.</p>
</div>

<div class="card card--tight">
  <div class="card__title">Todd McShay</div>
  <p class="text-sm muted mb-0">Draft analyst focused on value and team needs. Evaluates roster construction and team-building strategy.</p>
</div>

<div class="card card--tight">
  <div class="card__title">Louis Riddick</div>
  <p class="text-sm muted mb-0">Former GM with an executive perspective. Analyzes asset management and championship windows.</p>
</div>

<div class="card card--tight">
  <div class="card__title">Ian Rapoport</div>
  <p class="text-sm muted mb-0">NFL insider with quick, punchy analysis. Provides insider context and future implications.</p>
</div>

</div>

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Values.</strong> Each asset is priced at the time of the deal using ${isDynasty ? 'DynastyProcess dynasty values, which weigh age, talent, and situation over a multi-year outlook' : 'VOR-weighted current-season production with position scarcity applied'}. The signed number on each side is value received minus value given.</li>
    <li><strong>Who won.</strong> A side with a net gain over 500 gets the brass rule and the "Won" badge. No mark on the other side means the deal was within noise.</li>
    <li><strong>Lopsided.</strong> A trade where one side cleared +500 and the other fell below -500.</li>
    <li><strong>Team names.</strong> Names follow the season picker in the header, so an owner who renamed their team shows under the name they used that season.</li>
    <li><strong>The takes.</strong> Commentary is generated by analyst personas from the trade details; it is color, not a valuation model.</li>
  </ul>
</section>
