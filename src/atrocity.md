<style>
  /* Severity tones: quiet for minor, brass for the ones worth a look, ember for the worst. */
  .sev-1 { color: var(--ink-3); }
  .sev-2 { color: var(--ink-2); }
  .sev-3 { color: var(--brass); }
  .sev-4, .sev-5 { color: var(--down); }
  .sev-rule-1 { border-left: 2px solid var(--ink-4); }
  .sev-rule-2 { border-left: 2px solid var(--ink-3); }
  .sev-rule-3 { border-left: 2px solid var(--brass); }
  .sev-rule-4, .sev-rule-5 { border-left: 2px solid var(--down); }

  /* Started vs. benched comparison */
  .versus { display: grid; grid-template-columns: 1fr auto 1fr; gap: var(--space-4); align-items: center; padding: var(--space-4) 0; border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); margin: var(--space-4) 0; }
  .versus__side { min-width: 0; }
  .versus__side--l { text-align: right; }
  .versus__name { font-family: var(--font-display); font-size: var(--text-lg); color: var(--ink); margin-top: var(--space-1); }
  .versus__mark { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-4); letter-spacing: 0.08em; }

  /* Score breakdown rows */
  .ledger-rows { display: grid; gap: var(--space-1); font-size: var(--text-sm); }
  .ledger-rows > div { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--hair); }
  .ledger-rows > div.is-total { border-bottom: 0; border-top: 1px solid var(--hair-2); color: var(--ink); }
  .shame-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); }
  .inner-collapse summary { cursor: pointer; font-family: var(--font-mono); font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); padding: var(--space-2) 0; }
  .inner-collapse summary:hover { color: var(--brass); }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme, tipStyle} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";
import {
  calculateRankingGap,
  calculateStartPctGap,
  calculateProjectionGap,
  calculateActualGap
} from "./components/helpers.js";

// Load data — atrocities are only graded for the season in progress
const atrocities = await FileAttachment("data/atrocities.json").json();
const users = await FileAttachment("data/users.json").json();
const league = await FileAttachment("data/league.json").json();
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));

// Severity level (1–5) -> chart color. Minor decisions stay quiet; the worst go ember.
const sevPalette = [T.ink4, T.ink3, T.sand, T.brass, T.down];
const sevColor = level => sevPalette[Math.min(Math.max((level || 1) - 1, 0), sevPalette.length - 1)];
const fmt1 = v => (Number.isFinite(v) ? v.toFixed(1) : "—");
```

```js
const S = seasonsData.by_season[season];
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${league.season} season · lineup decisions</p>
    <h1>Which lineup calls were <em>indefensible</em>?</h1>
    <p class="lede">Atrocity scores grade each start/sit call on what was knowable before kickoff — projections, rankings, and consensus — not just on how it turned out.</p>
  </header>
`);
display(html`<div>${S.is_current ? "" : html`<aside class="note note--brass"><b>Showing the ${seasonsData.current} season.</b> This page is only available for the season in progress.</aside>`}</div>`);
```

```js
const teamOptions = ['All Teams', ...Array.from(new Set(atrocities.map(a => a.userName))).sort()];
const weekOptions = ['All Weeks', ...Array.from(new Set(atrocities.map(a => a.week))).sort((a, b) => a - b).map(w => `Week ${w}`)];

const teamInput = Inputs.select(teamOptions, {label: "Team", value: "All Teams"});
const weekInput = Inputs.select(weekOptions, {label: "Week", value: "All Weeks"});
const selectedTeam = Generators.input(teamInput);
const selectedWeek = Generators.input(weekInput);
display(html`<div class="row">${teamInput}${weekInput}</div>`);
```

```js
// Process atrocity data by user
const atrocitiesByUser = d3.rollup(
  atrocities,
  v => ({
    count: v.length,
    totalScore: d3.sum(v, d => d.score),
    avgScore: d3.mean(v, d => d.score),
    totalPointsLeft: d3.sum(v, d => d.pointsLeft),
    worstDecision: v.sort((a, b) => b.score - a.score)[0],
    decisions: v
  }),
  d => d.userName
);

const userAtrocityStats = Array.from(atrocitiesByUser, ([userName, stats]) => ({
  userName,
  ...stats
})).sort((a, b) => b.totalScore - a.totalScore);
```

```js
// Get league-wide stats
const leagueStats = {
  totalAtrocities: atrocities.length,
  avgAtrocityScore: d3.mean(atrocities, d => d.score),
  totalPointsLeft: d3.sum(atrocities, d => d.pointsLeft),
  worstDecision: atrocities.sort((a, b) => b.score - a.score)[0],
  legendaryCount: atrocities.filter(a => a.score >= 90).length,
  catastrophicCount: atrocities.filter(a => a.score >= 70 && a.score < 90).length
};
const hasAtrocities = atrocities.length > 0;
```

```js
// Apply filters
const filteredAtrocities = atrocities.filter(a => {
  const teamMatch = selectedTeam === 'All Teams' || a.userName === selectedTeam;
  const weekMatch = selectedWeek === 'All Weeks' || `Week ${a.week}` === selectedWeek;
  return teamMatch && weekMatch;
});

const filterSummary = {
  count: filteredAtrocities.length,
  totalScore: d3.sum(filteredAtrocities, d => d.score),
  avgScore: d3.mean(filteredAtrocities, d => d.score),
  totalPointsLeft: d3.sum(filteredAtrocities, d => d.pointsLeft),
  worstDecision: filteredAtrocities.sort((a, b) => b.score - a.score)[0]
};
const hasFiltered = filteredAtrocities.length > 0;
const filterContext = `${selectedTeam !== 'All Teams' ? ` for ${selectedTeam}` : ''}${selectedWeek !== 'All Weeks' ? ` in ${selectedWeek.toLowerCase()}` : ''}`;
```

## League overview

```js
if (hasAtrocities) {
  display(html`
    <div class="stat-grid">
      <div class="stat"><div class="stat__k">Atrocities</div><div class="stat__v">${leagueStats.totalAtrocities}</div></div>
      <div class="stat"><div class="stat__k">Average score</div><div class="stat__v">${fmt1(leagueStats.avgAtrocityScore)}</div></div>
      <div class="stat"><div class="stat__k">Points left on bench</div><div class="stat__v">${fmt1(leagueStats.totalPointsLeft)}</div></div>
      <div class="stat"><div class="stat__k">Legendary</div><div class="stat__v">${leagueStats.legendaryCount}</div><div class="stat__l">score 90+</div></div>
    </div>
  `);
} else {
  display(html`<aside class="note"><b>No lineup decisions graded yet.</b> Atrocities appear after week 1 finals, once started and benched players have actual scores.</aside>`);
}
```

```js
// Contextual summary for the current filters (only when there is something to summarize)
if (hasFiltered && selectedTeam !== 'All Teams') {
  const positionBreakdown = d3.rollup(
    filteredAtrocities,
    v => v.length,
    d => d.position
  );
  const mostProblematicPos = Array.from(positionBreakdown).sort((a, b) => b[1] - a[1])[0];
  const worst = filterSummary.worstDecision;

  display(html`
    <div class="card card--accent">
      <div class="card__title">${selectedTeam}</div>
      <dl class="ledger__facts">
        <dt>Bad decisions</dt><dd>${filterSummary.count}</dd>
        <dt>Average score</dt><dd>${fmt1(filterSummary.avgScore)}</dd>
        <dt>Points left on bench</dt><dd>${fmt1(filterSummary.totalPointsLeft)}</dd>
        ${mostProblematicPos ? html`<dt>Most trouble at</dt><dd>${mostProblematicPos[0]} <span class="muted">(${mostProblematicPos[1]} atrocities)</span></dd>` : ''}
      </dl>
      ${worst ? html`
        <p class="card__foot sev-rule-${worst.severity.level}">
          <strong>Worst call:</strong> week ${worst.week} — started ${worst.startedPlayer.name} over ${worst.benchedPlayer.name}
          <span class="mono sev-${worst.severity.level}">score ${worst.score}</span>
        </p>
      ` : ''}
    </div>
  `);
}

if (hasFiltered && (selectedTeam !== 'All Teams' || selectedWeek !== 'All Weeks')) {
  display(html`
    <div class="stat-grid">
      <div class="stat"><div class="stat__k">Filtered decisions</div><div class="stat__v">${filterSummary.count}</div></div>
      <div class="stat"><div class="stat__k">Average score</div><div class="stat__v">${fmt1(filterSummary.avgScore)}</div></div>
      <div class="stat"><div class="stat__k">Points left</div><div class="stat__v">${fmt1(filterSummary.totalPointsLeft)}</div></div>
      <div class="stat stat--down"><div class="stat__k">Worst score</div><div class="stat__v">${filterSummary.worstDecision.score}</div></div>
    </div>
  `);
}
```

### How atrocity scores work

```js
display(html`
  <div class="stack">
    <p class="ink-2">
      Atrocity scores measure <strong>decision quality</strong>, not just outcomes. They focus on what you could have known before kickoff — projections, rankings, and consensus — to identify genuinely bad lineup decisions.
    </p>

    <div class="grid grid-2">
      <div>
        <h4>Score components</h4>
        <ul class="text-sm ink-2">
          <li><strong>Projections gap (35%):</strong> how obvious the better choice was</li>
          <li><strong>Consensus gap (35%):</strong> how many managers made the right call</li>
          <li><strong>Rankings gap (30%):</strong> position rank difference</li>
          <li><strong>Actual gap (15%):</strong> only when pre-game signals were strong</li>
        </ul>
      </div>

      <div>
        <h4>Severity levels</h4>
        <dl class="ledger__facts text-sm">
          <dt><span class="badge">Questionable</span></dt><dd>0–20 points</dd>
          <dt><span class="badge">Bad decision</span></dt><dd>20–40 points</dd>
          <dt><span class="badge badge--brass">Egregious</span></dt><dd>40–70 points</dd>
          <dt><span class="badge badge--down">Catastrophic</span></dt><dd>70–90 points</dd>
          <dt><span class="badge badge--down badge--solid">Legendary</span></dt><dd>90–100 points</dd>
        </dl>
      </div>
    </div>

    <aside class="note note--brass">
      <strong>Gut calls are protected.</strong> If pre-game signals were weak (score ≤ 20), the actual outcome doesn't count against you. Obvious mistakes — benching studs, starting injured players — are penalized in full.
    </aside>

    <details class="inner-collapse">
      <summary>Worked example: week 3, Joe Milton over Josh Allen</summary>
      <div class="card">
        <div class="versus">
          <div class="versus__side versus__side--l">
            <div class="eyebrow">Started</div>
            <div class="versus__name">Joe Milton</div>
            <div class="mono down">−0.36 pts</div>
            <div class="text-xs muted">Rank #45 · 10% start</div>
          </div>
          <div class="versus__mark">over</div>
          <div class="versus__side">
            <div class="eyebrow">Benched</div>
            <div class="versus__name">Josh Allen</div>
            <div class="mono up">23.02 pts</div>
            <div class="text-xs muted">Rank #5 · 88% start</div>
          </div>
        </div>

        <div class="ledger-rows">
          <div><span>Projections gap: Milton 8.8 vs Allen 17.9</span><span class="num">15.8 pts</span></div>
          <div><span>Consensus gap: 10% vs 88% start rate</span><span class="num">27.3 pts</span></div>
          <div><span>Rankings gap: #45 vs #5 (40 positions)</span><span class="num">12.0 pts</span></div>
          <div><span>Pre-game score (obvious mistake)</span><span class="num">55.1 pts</span></div>
          <div><span>Actual outcome confirms it</span><span class="num">+3.9 pts</span></div>
          <div class="is-total"><span>Final atrocity score</span><span class="num brass">59 · egregious</span></div>
        </div>
        <div class="card__foot">Cost: 23.4 points left on the bench.</div>
      </div>
    </details>
  </div>
`);
```

## Severity of filtered decisions

```js
// Visualize filtered data by severity
if (filteredAtrocities.length > 0) {
  const severityBreakdown = d3.rollup(
    filteredAtrocities,
    v => ({
      count: v.length,
      avgScore: d3.mean(v, d => d.score),
      totalPointsLeft: d3.sum(v, d => d.pointsLeft)
    }),
    d => d.severity.label
  );

  const severityData = Array.from(severityBreakdown, ([label, stats]) => {
    const severityInfo = filteredAtrocities.find(a => a.severity.label === label).severity;
    return {
      label,
      ...stats,
      emoji: severityInfo.emoji,
      color: severityInfo.color,
      level: severityInfo.level
    };
  }).sort((a, b) => b.level - a.level);

  // Add displayLabel for plotting
  const severityDataForPlot = severityData.map(d => ({
    ...d,
    displayLabel: String(d.label || ''),
    displayText: `${d.count} (${d.avgScore.toFixed(1)} avg)`
  }));

  display(Plot.plot(plotTheme({
    width: Math.min(width, 800),
    marginLeft: width < 640 ? 90 : 120,
    marginRight: 110,
    height: Math.max(200, severityDataForPlot.length * 60),
    x: {
      label: "Decisions",
      domain: [0, Math.max(1, d3.max(severityDataForPlot, d => d.count))]
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(severityDataForPlot, {
        x: "count",
        y: "displayLabel",
        fill: d => sevColor(d.level),
        sort: { y: d => -d.level }
      }),
      Plot.text(severityDataForPlot, {
        x: "count",
        y: "displayLabel",
        text: "displayText",
        dx: 10,
        textAnchor: "start",
        fill: T.ink2,
        fontSize: 11
      })
    ]
  })));

  // If a specific team is selected, show their weekly trend
  if (selectedTeam !== 'All Teams') {
    const weeklyTrend = d3.rollup(
      filteredAtrocities,
      v => ({
        count: v.length,
        avgScore: d3.mean(v, d => d.score),
        maxScore: d3.max(v, d => d.score),
        totalPointsLeft: d3.sum(v, d => d.pointsLeft)
      }),
      d => d.week
    );

    const weeklyData = Array.from(weeklyTrend, ([week, stats]) => ({
      week,
      ...stats
    })).sort((a, b) => a.week - b.week);

    if (weeklyData.length > 0) {
      display(html`<figure class="chart">
        <div class="chart__title">Week by week for ${selectedTeam}</div>
        <p class="chart__sub">Line is the average score each week; dots mark the worst single call, labeled with the number of decisions.</p>
        ${Plot.plot(plotTheme({
          width: Math.min(width, 800),
          height: 300,
          x: {
            label: "Week",
            tickFormat: d => `Wk ${d}`
          },
          y: {
            label: "Atrocity score"
          },
          marks: [
            Plot.line(weeklyData, {
              x: "week",
              y: "avgScore",
              stroke: T.brass,
              strokeWidth: 2,
              curve: "catmull-rom"
            }),
            Plot.dot(weeklyData, {
              x: "week",
              y: "maxScore",
              fill: d => d.maxScore > 70 ? T.down : T.ink3,
              r: 5,
              title: d => `Week ${d.week}: max score ${d.maxScore.toFixed(0)}`
            }),
            Plot.text(weeklyData, {
              x: "week",
              y: "maxScore",
              text: d => d.count,
              dy: -12,
              fill: T.ink2,
              fontSize: 10
            })
          ]
        }))}
      </figure>`);
    }
  }
} else {
  display(html`<aside class="note"><b>Nothing to chart.</b> ${hasAtrocities ? "No decisions match these filters — widen the team or week filter." : "Severity breakdown appears once the first week's lineups are graded."}</aside>`);
}
```

## Twenty worst decisions

```js
// Pagination for the worst-decisions list
const SHAME_PAGE_SIZE = 5;
const allHallOfShame = filteredAtrocities.sort((a, b) => b.score - a.score);
const shamePages = Math.max(1, Math.ceil(Math.min(allHallOfShame.length, 20) / SHAME_PAGE_SIZE));
```

```js
const shamePageInput = Inputs.range([1, shamePages], {
  step: 1,
  value: 1,
  label: "Page",
  width: 150
});
const shamePage = Generators.input(shamePageInput);
display(html`<div>${shamePages > 1 ? shamePageInput : ""}</div>`);
```

```js
const shameStart = (shamePage - 1) * SHAME_PAGE_SIZE;
const shameEnd = Math.min(shameStart + SHAME_PAGE_SIZE, allHallOfShame.length, 20);
const hallOfShame = allHallOfShame.slice(shameStart, shameEnd);

if (hallOfShame.length === 0) {
  display(html`
    <aside class="note">
      <b>No atrocities to show.</b> ${hasAtrocities ? "Widen the team or week filter to see lineup decisions." : "The worst twenty calls appear here after week 1 finals."}
    </aside>
  `);
} else {
  display(html`
    <div class="pagination-container">
      <div class="pagination-info">
        Showing ${shameStart + 1}–${shameEnd} of ${Math.min(allHallOfShame.length, 20)} worst decisions${filterContext}
      </div>
      <div class="pagination-controls">
        <span class="muted text-xs mono">Page ${shamePage} of ${shamePages}</span>
      </div>
    </div>
  `);

  display(html`<div class="stack">${hallOfShame.map((atrocity, index) => {
  const { severity } = atrocity;

  // Calculate component scores for display
  const rankingGap = calculateRankingGap(
    atrocity.startedPlayer.rank || 999,
    atrocity.benchedPlayer.rank || 999,
    atrocity.position
  );
  const startPctGap = calculateStartPctGap(
    atrocity.startedPlayer.startPct || 0,
    atrocity.benchedPlayer.startPct || 0
  );
  const projectionGap = calculateProjectionGap(
    atrocity.startedPlayer.projection || 0,
    atrocity.benchedPlayer.projection || 0,
    atrocity.positionAvgProj || 10
  );
  const actualGap = calculateActualGap(
    atrocity.startedPlayer.actual,
    atrocity.benchedPlayer.actual,
    atrocity.positionStdDev || 8
  );

  // Calculate weighted components (pre-game decision quality)
  const rankingScore = (rankingGap * 0.30 * 100).toFixed(1);
  const consensusScore = (startPctGap * 0.35 * 100).toFixed(1);
  const projectionScore = (projectionGap * 0.35 * 100).toFixed(1);
  const actualScore = (actualGap * 100).toFixed(1);

  // Pre-game decision score (what you should have known)
  const preGameScore = (parseFloat(rankingScore) + parseFloat(consensusScore) + parseFloat(projectionScore));

  // Only add actual outcome if pre-game signals were already bad
  const baseScore = preGameScore > 20
    ? (preGameScore * 0.85 + parseFloat(actualScore) * 0.15).toFixed(1)
    : preGameScore.toFixed(1);

  // Calculate bonuses/multipliers
  const status = atrocity.startedPlayer.status;
  let statusBonus = 0;
  if (status === 'Out' || status === 'IR' || status === 'Suspended') {
    statusBonus = 40;
  } else if (status === 'Doubtful') {
    statusBonus = 20;
  } else if (status === 'Questionable') {
    statusBonus = 5;
  }

  const positionVolatility = {
    QB: 0.85, RB: 1.15, WR: 1.20, TE: 1.10, K: 0.90, DEF: 1.00, FLEX: 1.15
  }[atrocity.position] || 1.0;

  // Week multiplier with protection for obvious mistakes
  const isObviousMistake = (parseFloat(baseScore) + statusBonus) > 40;
  let weekMultiplier = 1.0;
  if (atrocity.week <= 6) {
    weekMultiplier = isObviousMistake ? 0.8 : 0.5;
  } else if (atrocity.week >= 14) {
    weekMultiplier = 2.0;
  }
  if (atrocity.isChampionship) weekMultiplier *= 1.5;

  const sev = severity.level;

  return html`
    <article class="card sev-rule-${sev}">
      <div class="shame-head">
        <div>
          <div class="eyebrow">#${shameStart + index + 1} · Week ${atrocity.week} · ${atrocity.userName}</div>
          <div class="card__title sev-${sev}">${severity.label}</div>
        </div>
        <div class="text-right">
          <div class="hero-num sev-${sev}">${atrocity.score}</div>
          <div class="eyebrow">Atrocity score</div>
        </div>
      </div>

      <div class="versus">
        <div class="versus__side versus__side--l">
          <div class="eyebrow">Started</div>
          <div class="versus__name">${atrocity.startedPlayer.name}</div>
          <div class="mono down">${atrocity.startedPlayer.actual.toFixed(1)} pts</div>
          <div class="text-xs muted">
            ${status !== 'Active' ? html`<span class="badge badge--down">${status}</span>` : ''}
            ${atrocity.startedPlayer.rank > 0 ? ` Rank #${atrocity.startedPlayer.rank}` : ''}
          </div>
        </div>
        <div class="versus__mark">over</div>
        <div class="versus__side">
          <div class="eyebrow">Should have started</div>
          <div class="versus__name sev-${sev}">${atrocity.benchedPlayer.name}</div>
          <div class="mono up">${atrocity.benchedPlayer.actual.toFixed(1)} pts</div>
          <div class="text-xs muted">
            ${atrocity.benchedPlayer.rank > 0 ? `Rank #${atrocity.benchedPlayer.rank}` : ''}
          </div>
        </div>
      </div>

      <p class="text-sm ink-2">${atrocity.explanation}</p>
      <div class="card__v sev-${sev}">Cost: ${atrocity.pointsLeft.toFixed(1)} points</div>

      <details class="inner-collapse">
        <summary>Score calculation</summary>
        <div class="stack">

          <div>
            <h4>Decision quality (pre-game factors)</h4>
            <div class="ledger-rows">
              <div><span>Projections gap (35%)</span><span class="num">${projectionScore} pts</span></div>
              <div><span>Consensus gap (35%)</span><span class="num">${consensusScore} pts</span></div>
              <div><span>Rankings gap (30%)</span><span class="num">${rankingScore} pts</span></div>
              <div class="is-total"><span>Pre-game score</span><span class="num slate">${preGameScore.toFixed(1)} pts</span></div>
              ${preGameScore > 20 ? html`
                <div><span class="muted">Actual points gap <em class="text-xs">(15% of total; confirms a bad decision)</em></span><span class="num muted">+${(parseFloat(actualScore) * 0.15).toFixed(1)} pts</span></div>
              ` : html`
                <div><span class="up text-xs">Gut call — pre-game signals were weak, so the actual outcome is not used</span><span></span></div>
              `}
              <div class="is-total"><span>Base score</span><span class="num sev-${sev}">${baseScore} pts</span></div>
            </div>
          </div>

          <div>
            <h4>Adjustments and multipliers</h4>
            <div class="ledger-rows">
              ${statusBonus > 0 ? html`
                <div><span>Player status bonus (${status})</span><span class="num brass">+${statusBonus} pts</span></div>
              ` : ''}
              <div><span>Position volatility (${atrocity.position})</span><span class="num">${positionVolatility}×</span></div>
              <div><span>Week context (week ${atrocity.week}${atrocity.isChampionship ? ', championship' : ''}${atrocity.week <= 6 ? (isObviousMistake ? ', obvious mistake' : ', early season') : ''})</span><span class="num">${weekMultiplier}×</span></div>
            </div>
          </div>

          <aside class="note">
            <div class="eyebrow">Final calculation</div>
            <div class="mono text-sm">
              (${baseScore} base ${statusBonus > 0 ? `+ ${statusBonus} status` : ''}) × ${positionVolatility} position × ${weekMultiplier} week = <strong class="sev-${sev}">${atrocity.score}</strong>
            </div>
          </aside>

        </div>
      </details>
    </article>
  `;
  })}</div>`);
}
```

## All atrocities

```js
// Pagination for the complete list
const LIST_PAGE_SIZE = 15;
const sortedAtrocities = filteredAtrocities.sort((a, b) => b.score - a.score);
const listPages = Math.max(1, Math.ceil(sortedAtrocities.length / LIST_PAGE_SIZE));
```

```js
const listPageInput = Inputs.range([1, listPages], {
  step: 1,
  value: 1,
  label: "Page",
  width: 150
});
const listPage = Generators.input(listPageInput);
display(html`<div>${listPages > 1 ? listPageInput : ""}</div>`);
```

```js
const listStart = (listPage - 1) * LIST_PAGE_SIZE;
const listEnd = Math.min(listStart + LIST_PAGE_SIZE, sortedAtrocities.length);
const paginatedAtrocities = sortedAtrocities.slice(listStart, listEnd);

if (filteredAtrocities.length === 0) {
  display(html`
    <aside class="note">
      <b>No atrocities found.</b> ${hasAtrocities ? "Either every call was defensible, or the filters are too narrow." : "The full list appears once the first week's lineups are graded."}
    </aside>
  `);
} else {
  display(html`
    <div class="pagination-container">
      <div class="pagination-info">
        Showing ${listStart + 1}–${listEnd} of ${sortedAtrocities.length} atrocit${sortedAtrocities.length === 1 ? 'y' : 'ies'}${filterContext}
      </div>
      <div class="pagination-controls">
        <span class="muted text-xs mono">Page ${listPage} of ${listPages}</span>
      </div>
    </div>
    <div class="table-wrap">
    ${Inputs.table(paginatedAtrocities, {
      columns: ["week", "userName", "position", "startedPlayer", "benchedPlayer", "score", "pointsLeft", "severity"],
      header: {
        week: "Week",
        userName: "Team",
        position: "Pos",
        startedPlayer: "Started",
        benchedPlayer: "Should have started",
        score: "Score",
        pointsLeft: "Pts left",
        severity: "Severity"
      },
      format: {
        startedPlayer: d => `${d.name} (${d.actual.toFixed(1)} pts)`,
        benchedPlayer: d => `${d.name} (${d.actual.toFixed(1)} pts)`,
        pointsLeft: d => d.toFixed(1),
        severity: d => d.label
      },
      width: {
        week: 60,
        userName: 120,
        position: 50,
        startedPlayer: 180,
        benchedPlayer: 200,
        score: 70,
        pointsLeft: 80,
        severity: 140
      }
    })}
    </div>
  `);
}
```

## Season-long patterns

### Team rankings

```js
const nTeamsRanked = userAtrocityStats.length;
if (userAtrocityStats.length === 0) {
  display(html`<aside class="note"><b>No teams ranked yet.</b> Team totals appear after week 1 finals.</aside>`);
} else {
  display(html`<figure class="chart">
    <div class="chart__title">Who made the worst decisions?</div>
    <p class="chart__sub">Total atrocity score across the season. The three worst offenders in ember, the three cleanest in brass.</p>
    ${Plot.plot(plotTheme({
      width: Math.min(width, 800),
      marginLeft: width < 640 ? 110 : 150,
      height: Math.min(500, Math.max(120, userAtrocityStats.length * 40)),
      x: {
        label: "Total atrocity score",
        domain: [0, Math.max(1, d3.max(userAtrocityStats, d => d.totalScore))]
      },
      y: {
        label: null
      },
      marks: [
        Plot.barX(userAtrocityStats, {
          x: "totalScore",
          y: "userName",
          fill: (d, i) => i < 3 ? T.down : i >= nTeamsRanked - 3 ? T.brass : T.ink4,
          sort: { y: "-x" }
        }),
        Plot.text(userAtrocityStats, {
          x: "totalScore",
          y: "userName",
          text: d => `${d.totalScore.toFixed(0)} (${d.count} decisions)`,
          dx: -10,
          fill: T.ground,
          textAnchor: "end",
          fontSize: 11
        })
      ]
    }))}
  </figure>`);
}
```

### Team stats

```js
if (userAtrocityStats.length === 0) {
  display(html`<aside class="note"><b>No team stats yet.</b> Per-team counts and averages appear after week 1 finals.</aside>`);
} else {
  display(html`<div class="table-wrap">${Inputs.table(userAtrocityStats, {
    columns: ["userName", "count", "avgScore", "totalScore", "totalPointsLeft"],
    header: {
      userName: "Team",
      count: "Bad decisions",
      avgScore: "Avg score",
      totalScore: "Total score",
      totalPointsLeft: "Points left"
    },
    format: {
      avgScore: x => x.toFixed(1),
      totalScore: x => x.toFixed(1),
      totalPointsLeft: x => x.toFixed(1)
    },
    width: {
      userName: 180,
      count: 120,
      avgScore: 100,
      totalScore: 100,
      totalPointsLeft: 120
    }
  })}</div>`);
}
```

### Weekly trends

```js
// Aggregate by week
const weeklyAtrocities = d3.rollup(
  atrocities,
  v => ({
    count: v.length,
    avgScore: d3.mean(v, d => d.score),
    maxScore: d3.max(v, d => d.score),
    totalPointsLeft: d3.sum(v, d => d.pointsLeft)
  }),
  d => d.week
);

const weeklyData = Array.from(weeklyAtrocities, ([week, stats]) => ({
  week,
  ...stats
})).sort((a, b) => a.week - b.week);

if (weeklyData.length === 0) {
  display(html`<aside class="note"><b>No weekly trend yet.</b> The week-by-week line starts after week 1 finals.</aside>`);
} else {
  display(html`<figure class="chart">
    <div class="chart__title">Average score by week</div>
    <p class="chart__sub">Dots are labeled with the number of decisions that week; weeks averaging above 50 are marked in ember.</p>
    ${Plot.plot(plotTheme({
      width: Math.min(width, 800),
      height: 350,
      x: {
        label: "Week",
        tickFormat: d => `Wk ${d}`
      },
      y: {
        label: "Average atrocity score"
      },
      marks: [
        Plot.line(weeklyData, {
          x: "week",
          y: "avgScore",
          stroke: T.brass,
          strokeWidth: 2,
          curve: "catmull-rom"
        }),
        Plot.dot(weeklyData, {
          x: "week",
          y: "avgScore",
          fill: d => d.avgScore > 50 ? T.down : T.brass,
          r: 5,
          tip: true,
          title: d => `Week ${d.week}\nAvg ${d.avgScore.toFixed(1)} · max ${d.maxScore.toFixed(0)} · ${d.count} decisions`
        }),
        Plot.text(weeklyData, {
          x: "week",
          y: "avgScore",
          text: d => d.count,
          dy: -15,
          fill: T.ink2,
          fontSize: 11
        })
      ]
    }))}
  </figure>`);
}
```

### By position

```js
// Analyze by position
const positionAtrocities = d3.rollup(
  atrocities,
  v => ({
    count: v.length,
    avgScore: d3.mean(v, d => d.score),
    totalPointsLeft: d3.sum(v, d => d.pointsLeft)
  }),
  d => d.position
);

const positionData = Array.from(positionAtrocities, ([position, stats]) => ({
  position,
  ...stats
})).sort((a, b) => b.avgScore - a.avgScore);

if (positionData.length === 0) {
  display(html`<aside class="note"><b>No position breakdown yet.</b> Appears after week 1 finals.</aside>`);
} else {
  display(html`<figure class="chart">
    <div class="chart__title">Average score by position</div>
    <p class="chart__sub">The position with the highest average is in brass.</p>
    ${Plot.plot(plotTheme({
      width: Math.min(width, 800),
      marginLeft: width < 640 ? 60 : 80,
      marginRight: 120,
      height: 300,
      x: {
        label: "Average atrocity score",
        domain: [0, Math.max(1, d3.max(positionData, d => d.avgScore))]
      },
      y: {
        label: null
      },
      marks: [
        Plot.barX(positionData, {
          x: "avgScore",
          y: "position",
          fill: (d, i) => i === 0 ? T.brass : T.ink4,
          sort: { y: "-x" }
        }),
        Plot.text(positionData, {
          x: "avgScore",
          y: "position",
          text: d => `${d.avgScore.toFixed(1)} (${d.count} decisions)`,
          dx: 10,
          textAnchor: "start",
          fill: T.ink2,
          fontSize: 11
        })
      ]
    }))}
  </figure>`);
}
```

### Severity distribution

```js
// Count by severity level
const severityCount = d3.rollup(
  atrocities,
  v => v.length,
  d => d.severity.label
);

const severityData = Array.from(severityCount, ([label, count]) => {
  const severityInfo = atrocities.find(a => a.severity.label === label).severity;
  return {
    label,
    count,
    emoji: severityInfo.emoji,
    color: severityInfo.color,
    level: severityInfo.level
  };
}).sort((a, b) => a.level - b.level);

// Add displayLabel for plotting
const severityDataWithLabels = severityData.map(d => ({
  ...d,
  displayLabel: String(d.label || '')
}));

if (severityDataWithLabels.length === 0) {
  display(html`<aside class="note"><b>No severity distribution yet.</b> Appears after week 1 finals.</aside>`);
} else {
  display(html`<figure class="chart">
    <div class="chart__title">How bad were they?</div>
    <p class="chart__sub">Number of decisions at each severity level, across the whole league.</p>
    ${Plot.plot(plotTheme({
      width: Math.min(width, 800),
      marginLeft: width < 640 ? 90 : 120,
      marginRight: 40,
      height: 300,
      x: {
        label: "Decisions",
        domain: [0, Math.max(1, d3.max(severityDataWithLabels, d => d.count))]
      },
      y: {
        label: null
      },
      marks: [
        Plot.barX(severityDataWithLabels, {
          x: "count",
          y: "displayLabel",
          fill: d => sevColor(d.level),
          sort: { y: d => d.level }
        }),
        Plot.text(severityDataWithLabels, {
          x: "count",
          y: "displayLabel",
          text: d => d.count,
          dx: 12,
          textAnchor: "start",
          fill: T.ink2,
          fontSize: 12
        })
      ]
    }))}
  </figure>`);
}
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Scores grade the decision, not the result.</strong> Projections (35%), consensus start rate (35%), and rankings (30%) set a pre-game score; the actual points gap only adds 15% when those signals were already strong.</li>
    <li><strong>Severity bands.</strong> Questionable 0–20, bad decision 20–40, egregious 40–70 (brass), catastrophic 70–90 and legendary 90+ (ember).</li>
    <li><strong>Multipliers.</strong> Starting an Out/IR player adds 40, doubtful 20, questionable 5; volatile positions (WR, RB) scale up; weeks 1–6 are discounted unless the mistake was obvious, and weeks 14+ (and the championship) count double or more.</li>
    <li><strong>Filters.</strong> The team and week selects at the top apply to the severity chart, the twenty worst decisions, and the full list. Season-long patterns always cover the whole league.</li>
    <li><strong>Staying off the list.</strong> Check injury reports, follow consensus, trust projections, start your studs, and set lineup reminders for Thursday night and Sunday morning.</li>
  </ul>
</section>
