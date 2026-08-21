```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme, multiLine, tipStyle} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data — every season in the league chain, plus current-season projections and KTC values
const seasonsData = await FileAttachment("data/seasons.json").json();
const teamProjectionsCurrent = await FileAttachment("data/team-projections.json").json();
const ktcValuesCurrent = await FileAttachment("data/ktc-values.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
const S = seasonsData.by_season[season];
const league = S.league;
const rosters = S.rosters;
const users = S.users;
const matchups = S.matchups;
// Projections and trade values only exist for the season in progress
const emptyProjections = { season, actual_weight: 1, played_weeks: [], remaining_weeks: [], replacement_ppg: 0, teams: [] };
const emptyKtc = { format: "—", ktc_players_loaded: 0, pick_seasons: [], roster_size: 0, replacement_roster_value: 0, teams: [] };
const teamProjections = S.is_current ? teamProjectionsCurrent : emptyProjections;
const ktcValues = S.is_current ? ktcValuesCurrent : emptyKtc;
```

```js
// Calculate detailed standings with additional metrics
const standings = rosters.map(roster => {
  const user = users.find(u => u.user_id === roster.owner_id);
  const proj = teamProjections.teams.find(t => t.roster_id === roster.roster_id);
  const ktc = ktcValues.teams.find(t => t.roster_id === roster.roster_id);
  const st = roster.settings || {};
  const totalGames = (st.wins || 0) + (st.losses || 0) + (st.ties || 0);
  const pointsFor = (st.fpts || 0) + ((st.fpts_decimal || 0) / 100);
  const pointsAgainst = (st.fpts_against || 0) + ((st.fpts_against_decimal || 0) / 100);

  return {
    roster_id: roster.roster_id,
    team: user?.display_name || roster.owner_id,
    wins: st.wins || 0,
    losses: st.losses || 0,
    ties: st.ties || 0,
    points_for: pointsFor,
    points_against: pointsAgainst,
    win_pct: totalGames > 0 ? (st.wins || 0) / totalGames : 0,
    ppg: totalGames > 0 ? pointsFor / totalGames : 0,
    papg: totalGames > 0 ? pointsAgainst / totalGames : 0,
    point_diff: pointsFor - pointsAgainst,
    total_games: totalGames,
    projected_ros_points: proj?.projected_ros_points ?? 0,
    projected_ros_ppg: proj?.projected_ros_ppg ?? 0,
    blended_points: proj?.blended_points ?? pointsFor,
    blended_ppg: proj?.blended_ppg ?? (totalGames > 0 ? pointsFor / totalGames : 0),
    ktc_total: ktc?.total_value ?? 0,
    ktc_players: ktc?.player_value ?? 0,
    ktc_picks: ktc?.pick_value ?? 0,
    ktc_top: ktc?.top_players ?? [],
    ktc_replacement: ktcValues.replacement_roster_value ?? 0,
    replacement_ros_points: proj?.replacement_ros_points ?? 0,
    replacement_actual_points: proj?.replacement_actual_points ?? 0,
    replacement_blended_points: proj?.replacement_blended_points ?? 0
  };
}).sort((a, b) => b.win_pct - a.win_pct || b.points_for - a.points_for);
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? league.status.replace(/_/g, " ") : "final"}</p>
    <h1>${league.name}: the <em>ledger</em></h1>
    <p class="lede">Standings, scoring, and how evenly the league's strength is spread.</p>
  </header>
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Teams</div><div class="stat__v">${rosters.length}</div></div>
    <div class="stat"><div class="stat__k">Scoring</div><div class="stat__v stat--text">${league.scoring_settings?.rec ? league.scoring_settings.rec + " PPR" : "Standard"}</div></div>
    <div class="stat"><div class="stat__k">Playoff teams</div><div class="stat__v">${league.settings?.playoff_teams || "—"}</div></div>
    <div class="stat"><div class="stat__k">Regular season</div><div class="stat__v">${(league.settings?.playoff_week_start || 15) - 1}<small>wks</small></div></div>
  </div>
`);
```

## Standings

```js
display(Inputs.table(standings, {
  columns: ["team", "wins", "losses", "win_pct", "points_for", "points_against", "ppg", "point_diff"],
  header: {
    team: "Team",
    wins: "W",
    losses: "L",
    win_pct: "Win %",
    points_for: "PF",
    points_against: "PA",
    ppg: "PPG",
    point_diff: "Diff"
  },
  format: {
    win_pct: x => (x * 100).toFixed(1) + "%",
    points_for: x => x.toFixed(2),
    points_against: x => x.toFixed(2),
    ppg: x => x.toFixed(2),
    point_diff: x => x.toFixed(2)
  },
  width: {
    team: 180,
    wins: 40,
    losses: 40,
    win_pct: 80,
    points_for: 80,
    points_against: 80,
    ppg: 70,
    point_diff: 80
  }
}));
```

## Power rankings

```js
// Calculate power ranking score (combination of win % and points)
const powerRankings = standings.map((team, index) => ({
  ...team,
  rank: index + 1,
  power_score: (team.win_pct * 100) + (team.ppg * 0.5)
})).sort((a, b) => b.power_score - a.power_score);

if (!powerRankings.some(d => d.power_score > 0)) {
  display(html`<aside class="note"><b>No games played yet.</b> Power rankings appear after week 1 finals.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Power score by team</div>
  <p class="chart__sub">Win percentage plus half of points per game. Top three in brass, bottom three in ember.</p>
  ${Plot.plot(plotTheme({
    width: Math.min(width, 800),
    marginLeft: width < 640 ? 110 : 150,
    height: Math.min(450, rosters.length * 36 + 40),
    x: { label: "Power score", domain: [0, Math.max(1, d3.max(powerRankings, d => d.power_score))] },
    y: { label: null },
    marks: [
      Plot.barX(powerRankings, {
        x: "power_score",
        y: "team",
        fill: (d, i) => i < 3 ? T.brass : i >= powerRankings.length - 3 ? T.down : T.ink4,
        sort: { y: "-x" }
      }),
      Plot.text(powerRankings, { x: "power_score", y: "team", text: (d, i) => `${i + 1}`, dx: -14, fill: T.ground, fontWeight: "500" })
    ]
  }))}
</figure>`);
```

## Weekly scoring

```js
// Aggregate scoring by week
const weeklyScoring = matchups.flatMap(weekData => {
  return weekData.matchups.map(m => ({
    week: weekData.week,
    points: m.points || 0,
    team: standings.find(s => s.roster_id === m.roster_id)?.team || `Team ${m.roster_id}`
  }));
});

if (!weeklyScoring.some(d => d.points > 0)) {
  display(html`<aside class="note"><b>No games played yet.</b> Weekly scoring appears after week 1 finals.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">Points by week, every team</div>
  <p class="chart__sub">One line per team. Hover a point for the team and score.</p>
  ${Plot.plot(plotTheme({
    width: Math.min(width, 800),
    height: 360,
    x: { label: "Week", tickFormat: d => `Wk ${d}` },
    y: { label: "Points" },
    marks: [
      Plot.line(weeklyScoring, { x: "week", y: "points", z: "team", curve: "catmull-rom", ...multiLine }),
      Plot.dot(weeklyScoring, { x: "week", y: "points", z: "team", fill: T.brass, r: 2.5, tip: true, title: d => `${d.team}\nWeek ${d.week}: ${d.points.toFixed(1)}` })
    ]
  }))}
</figure>`);
```

## League averages

```js
const leagueAvgPF = d3.mean(standings, d => d.points_for);
const leagueAvgPA = d3.mean(standings, d => d.points_against);
const leagueAvgPPG = d3.mean(standings, d => d.ppg);
const highestScorer = standings[0];
const lowestScorer = standings[standings.length - 1];

display(html`
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Avg points for</div><div class="stat__v">${leagueAvgPF.toFixed(1)}</div></div>
    <div class="stat"><div class="stat__k">Avg points against</div><div class="stat__v">${leagueAvgPA.toFixed(1)}</div></div>
    <div class="stat"><div class="stat__k">Avg per game</div><div class="stat__v">${leagueAvgPPG.toFixed(1)}</div></div>
    <div class="stat stat--brass"><div class="stat__k">Most points</div><div class="stat__v stat--text">${highestScorer.team}</div><div class="stat__l">${highestScorer.points_for.toFixed(1)} pts</div></div>
    <div class="stat stat--down"><div class="stat__k">Fewest points</div><div class="stat__v stat--text">${lowestScorer.team}</div><div class="stat__l">${lowestScorer.points_for.toFixed(1)} pts</div></div>
  </div>
`);
```

## Competitive balance

```js
// Calculate competitive balance metrics
const scoringVariance = d3.variance(standings, d => d.ppg);
const winPctSpread = d3.max(standings, d => d.win_pct) - d3.min(standings, d => d.win_pct);

const competitiveBalance = {
  high: scoringVariance < 10 && winPctSpread < 0.5,
  medium: scoringVariance < 20 && winPctSpread < 0.7,
  low: true
};

const balanceLevel = competitiveBalance.high ? "High" : competitiveBalance.medium ? "Medium" : "Low";
const balanceClass = competitiveBalance.high ? "note--up" : competitiveBalance.medium ? "note--brass" : "note--down";

display(html`
  <aside class="note ${balanceClass}">
    <p><b>Competitive balance: ${balanceLevel.toLowerCase()}.</b>
    Scoring variance ${scoringVariance.toFixed(1)} (lower is more competitive) ·
    win% spread ${(winPctSpread * 100).toFixed(0)} points (smaller is a closer race).
    The ledger below measures the same idea more carefully.</p>
  </aside>
`);
```

```js
// Gini coefficient: 0 = perfect equality, 1 = one team has everything.
// With n teams the raw maximum is (n-1)/n, so we apply the standard n/(n-1) small-sample
// correction so that a 12-team league can actually reach 1.0.
function gini(values, { corrected = true } = {}) {
  const x = values.filter(v => Number.isFinite(v)).map(v => Math.max(0, v)).sort((a, b) => a - b);
  const n = x.length;
  const total = d3.sum(x);
  if (n < 2 || total <= 0) return 0;
  const weighted = d3.sum(x, (v, i) => (i + 1) * v);
  const raw = (2 * weighted) / (n * total) - (n + 1) / n;
  return corrected ? raw * n / (n - 1) : raw;
}

// Lorenz curve points: cumulative share of teams (x) vs cumulative share of metric (y)
function lorenz(items, accessor) {
  const sorted = items.slice().sort((a, b) => accessor(a) - accessor(b));
  const n = sorted.length;
  const total = d3.sum(sorted, accessor);
  let cum = 0;
  return [{ x: 0, y: 0, y0: 0, team: null, value: null }].concat(
    sorted.map((d, i) => {
      const y0 = total > 0 ? cum / total : i / n;
      cum += accessor(d);
      return { x: (i + 1) / n, y: total > 0 ? cum / total : (i + 1) / n, y0, team: d.team, value: accessor(d), share: total > 0 ? accessor(d) / total : 1 / n, record: d };
    })
  );
}

const actualWeight = teamProjections.actual_weight ?? 0;
const playedCount = teamProjections.played_weeks?.length ?? 0;
const remainingCount = teamProjections.remaining_weeks?.length ?? 0;

const fmtPts = v => v.toFixed(1) + " pts";
const fmtKtc = v => d3.format(",")(Math.round(v)) + " KTC";

// Each metric: raw accessor, its replacement-level baseline (shared floor every team gets for
// free), and formatting. Gini/Lorenz run on (raw - baseline) by default.
const lorenzMetricOptions = new Map([
  ["Blended points", { short: "Blended", what: "actual points to date plus projected rest-of-season points", raw: d => d.blended_points, replacement: d => d.replacement_blended_points, format: fmtPts }],
  ["Projected ROS", { short: "Projected", what: "projected rest-of-season points", raw: d => d.projected_ros_points, replacement: d => d.replacement_ros_points, format: fmtPts }],
  ["Actual points", { short: "Actual", what: "points scored so far", raw: d => d.points_for, replacement: d => d.replacement_actual_points, format: fmtPts }],
  ["Wins", { short: "Wins", what: "wins", raw: d => d.wins, replacement: () => 0, format: v => `${v} W` }],
  ["KTC players + picks", { short: "KTC total", what: "KeepTradeCut value of players and future picks", raw: d => d.ktc_total, replacement: d => d.ktc_replacement, format: fmtKtc,
    detail: d => `Players ${fmtKtc(d.ktc_players)} · Picks ${fmtKtc(d.ktc_picks)}\nTop: ${d.ktc_top.slice(0, 3).map(p => p.name).join(", ")}` }],
  ["KTC players only", { short: "KTC players", what: "KeepTradeCut value of rostered players", raw: d => d.ktc_players, replacement: d => d.ktc_replacement, format: fmtKtc,
    detail: d => `Top: ${d.ktc_top.slice(0, 3).map(p => `${p.name} (${d3.format(",")(p.value)})`).join(", ")}` }]
]);

const lorenzBaselineOptions = new Map([
  ["Above replacement", {
    phrase: "above replacement level",
    floor: (m, items) => m.replacement,
    blurb: "Surplus over a replacement-level team: the best lineup you could build from unrostered players (for points) or the best unrostered players' value (for KTC). This removes the floor every full roster gets for free."
  }],
  ["Above worst team", {
    phrase: "above the last-place team",
    floor: (m, items) => { const min = d3.min(items, m.raw); return () => min; },
    blurb: "Surplus over the league's lowest team. Simple, but it moves whenever the worst team changes."
  }],
  ["Raw totals", {
    phrase: "on raw totals",
    floor: () => () => 0,
    blurb: "Classic Gini on raw totals. Understates inequality in fantasy because every full roster scores a lot; shown for reference."
  }]
]);

// Default to Blended; fall back to actuals if projections are empty or the season is over
const hasProjections = remainingCount > 0 && standings.some(d => d.projected_ros_points > 0);
const hasKtc = standings.some(d => d.ktc_total > 0);
const availableMetrics = Array.from(lorenzMetricOptions.keys()).filter(name =>
  (hasProjections || !/Blended|Projected/.test(name)) && (hasKtc || !/KTC/.test(name)));
const metricInput = Inputs.radio(availableMetrics, {
  label: "Measure",
  value: hasProjections ? "Blended points" : "Actual points"
});
const availableBaselines = Array.from(lorenzBaselineOptions.keys()).filter(name => S.is_current || name !== "Above replacement");
const baselineInput = Inputs.radio(availableBaselines, {
  label: "Baseline",
  value: S.is_current ? "Above replacement" : "Above worst team"
});
const lorenzMetricName = Generators.input(metricInput);
const lorenzBaselineName = Generators.input(baselineInput);

display(html`
  <section class="ledger" aria-labelledby="ledger-title">
    <div class="ledger__head">
      <h2 class="ledger__title" id="ledger-title">Who holds the <em>surplus</em>?</h2>
      <div class="ledger__season">${season} · ${S.is_current ? `${playedCount} of ${playedCount + remainingCount} weeks played` : "final"}</div>
    </div>
    <div class="ledger__controls">${metricInput}${baselineInput}</div>
  </section>
`);
```

```js
const lorenzMetric = lorenzMetricOptions.get(lorenzMetricName);
const lorenzBaseline = lorenzBaselineOptions.get(lorenzBaselineName);
const isRawBaseline = lorenzBaselineName === "Raw totals";
const nTeams = standings.length;

// Surplus accessor for a metric under the selected baseline
function surplusAccessor(m) {
  const floor = lorenzBaseline.floor(m, standings);
  return d => Math.max(0, m.raw(d) - floor(d));
}
const lorenzAccessor = surplusAccessor(lorenzMetric);
const lorenzPoints = lorenz(standings, lorenzAccessor);
const giniValue = gini(standings.map(lorenzAccessor));
const giniRawTotals = gini(standings.map(lorenzMetric.raw));
const giniUncorrected = gini(standings.map(lorenzAccessor), { corrected: false });
const hasData = d3.sum(standings, lorenzMetric.raw) > 0;

// Context for all metrics so the user can compare at a glance
const giniByMetric = Array.from(lorenzMetricOptions).filter(([name]) => availableMetrics.includes(name)).map(([name, m]) => ({
  name,
  short: m.short,
  gini: gini(standings.map(surplusAccessor(m))),
  hasData: d3.sum(standings, m.raw) > 0
}));

// Interpretation thresholds. Surplus-based Gini lives on a much wider scale than raw totals,
// where a fantasy league's guaranteed scoring floor compresses everything toward 0.
const giniThresholds = isRawBaseline
  ? [[0.05, "very balanced"], [0.10, "balanced"], [0.15, "moderately unequal"]]
  : [[0.10, "very balanced"], [0.20, "balanced"], [0.30, "moderately unequal"]];
function giniLabel(g) {
  for (const [cut, label] of giniThresholds) if (g < cut) return { label, ember: false };
  return { label: "top-heavy", ember: true };
}
const giniInfo = giniLabel(giniValue);

// Top / bottom shares for the verdict sentence
const teamsSorted = lorenzPoints.filter(d => d.team);
const topThree = teamsSorted.slice(-3);
const topThreeShare = d3.sum(topThree, d => d.share);
const bottomThree = teamsSorted.slice(0, 3);
const bottomThreeShare = d3.sum(bottomThree, d => d.share);

// --- Chart geometry shared by the ladder and the Lorenz plot ---------------------------------
const chartSize = Math.max(300, Math.min(width - 40, 520));
const margin = { top: 12, right: 16, bottom: 44, left: 44 };
const innerH = chartSize - margin.top - margin.bottom;
const yScale = d3.scaleLinear([0, 1], [margin.top + innerH, margin.top]);

// The share ladder: each team's slice of the surplus, stacked worst -> best along the y-axis.
// Segment boundaries are exactly the Lorenz curve's y-values; ticks mark a fair 1/n share.
const ladderW = 34;
const ladder = html`<svg width=${ladderW} height=${chartSize} viewBox="0 0 ${ladderW} ${chartSize}" role="img" aria-label="Share ladder: each team's share of the surplus, stacked from last place to first">
  <title>Share ladder</title>
  ${teamsSorted.map((d, i) => {
    const y1 = yScale(d.y0), y2 = yScale(d.y);
    const h = Math.max(0, y1 - y2);
    const opacity = 0.3 + 0.7 * (i / Math.max(1, nTeams - 1));
    return svg`<rect x="8" y="${y2}" width="${ladderW - 8}" height="${Math.max(h - 1, 0.5)}" fill="var(--brass)" fill-opacity="${opacity}"><title>${d.team}\n${(d.share * 100).toFixed(1)}% of the surplus · fair share ${(100 / nTeams).toFixed(1)}%</title></rect>`;
  })}
  ${d3.range(1, nTeams).map(i => svg`<line x1="0" x2="6" y1="${yScale(i / nTeams)}" y2="${yScale(i / nTeams)}" stroke="var(--ink)" stroke-opacity="0.7" stroke-width="1" />`)}
  <line x1="7" x2="7" y1="${margin.top}" y2="${margin.top + innerH}" stroke="var(--ink)" stroke-opacity="0.25" />
</svg>`;

const lorenzPlot = Plot.plot({
  width: chartSize,
  height: chartSize,
  marginTop: margin.top, marginRight: margin.right, marginBottom: margin.bottom, marginLeft: margin.left,
  style: { background: "transparent", fontFamily: "var(--font-mono)", fontSize: "11px", overflow: "visible" },
  x: { label: "Share of teams, worst → best", domain: [0, 1], ticks: 4, tickFormat: ".0%", grid: true, labelAnchor: "center", labelOffset: 36 },
  y: { label: null, domain: [0, 1], ticks: 4, tickFormat: ".0%", grid: true },
  marks: [
    Plot.areaY(lorenzPoints, { x: "x", y1: "y", y2: "x", fill: "var(--brass)", fillOpacity: 0.14, curve: "linear" }),
    Plot.line([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: "x", y: "y", stroke: "var(--slate)", strokeWidth: 1 }),
    Plot.text([{ x: 0.58, y: 0.58 }], { x: "x", y: "y", text: ["equal shares"], dx: -6, dy: -10, rotate: -45, fill: "var(--slate)", fontSize: 10, fontFamily: "var(--font-mono)", textAnchor: "middle" }),
    Plot.line(lorenzPoints, { x: "x", y: "y", stroke: "var(--brass)", strokeWidth: 2, curve: "linear" }),
    Plot.dot(teamsSorted, { x: "x", y: "y", fill: "var(--ground-2)", stroke: "var(--brass)", strokeWidth: 1.5, r: 3.5 }),
    Plot.tip(teamsSorted, Plot.pointer({
      x: "x", y: "y",
      title: d => [
        d.team,
        `${lorenzMetric.format(lorenzMetric.raw(d.record))}${isRawBaseline ? "" : ` · surplus ${lorenzMetric.format(d.value)}`}`,
        `${(d.share * 100).toFixed(1)}% of the surplus`,
        lorenzMetric.detail ? lorenzMetric.detail(d.record) : null,
        `Bottom ${(d.x * 100).toFixed(0)}% of teams hold ${(d.y * 100).toFixed(1)}%`
      ].filter(Boolean).join("\n"),
      fill: "var(--ground-2)", stroke: "var(--hair)", fontFamily: "var(--font-mono)", fontSize: 11
    }))
  ]
});

display(html`
  <section class="ledger" aria-label="Parity ledger results">
    <div class="ledger__body">
      <div class="ledger__verdict">
        ${hasData ? html`
          <div class="ledger__gini" aria-label="Gini coefficient ${giniValue.toFixed(3)}">${giniValue.toFixed(3)}<small>Gini</small></div>
          <p class="ledger__read">
            ${lorenzMetric.short} ${lorenzBaseline.phrase} is <b class=${giniInfo.ember ? "is-ember" : ""}>${giniInfo.label}</b>.
            <span>The top three teams hold ${(topThreeShare * 100).toFixed(0)}% of the surplus; the bottom three hold ${(bottomThreeShare * 100).toFixed(0)}%. Fair share is ${(300 / nTeams).toFixed(0)}% each.</span>
          </p>
        ` : html`
          <div class="ledger__gini">—<small>Gini</small></div>
          <p class="ledger__read">No ${lorenzMetric.what} yet. <span>Switch to Blended or KTC to read the league before kickoff.</span></p>
        `}
        <dl class="ledger__facts">
          ${isRawBaseline ? "" : html`<dt>Raw totals</dt><dd>${giniRawTotals.toFixed(3)}</dd>`}
          <dt>Uncorrected</dt><dd>${giniUncorrected.toFixed(3)} <span class="muted">(max ${((nTeams - 1) / nTeams).toFixed(3)})</span></dd>
          <dt>Leader</dt><dd>${teamsSorted.at(-1)?.team ?? "—"} · ${((teamsSorted.at(-1)?.share ?? 0) * 100).toFixed(1)}%</dd>
          <dt>Last</dt><dd>${teamsSorted[0]?.team ?? "—"} · ${((teamsSorted[0]?.share ?? 0) * 100).toFixed(1)}%</dd>
        </dl>
      </div>
      <div class="ledger__chart">
        <div class="ledger__ladder">${ladder}</div>
        ${lorenzPlot}
      </div>
    </div>

    <div class="ledger__strip" role="list" aria-label="Gini by measure">
      ${giniByMetric.map(m => html`
        <div class="ledger__strip-item ${m.name === lorenzMetricName ? "is-current" : ""} ${m.hasData ? "" : "is-empty"}" role="listitem">
          <div class="ledger__strip-k">${m.short}</div>
          <div class="ledger__strip-v">${m.hasData ? m.gini.toFixed(3) : "—"}</div>
          <div class="ledger__strip-l">${m.hasData ? giniLabel(m.gini).label : "no games yet"}</div>
        </div>
      `)}
    </div>

    <div class="ledger__note">
      <p><b>How to read it.</b> Teams are sorted from last to first. The ladder on the left stacks each team's slice of the league's total ${lorenzMetric.what}; the hairlines mark an equal 1/${nTeams} share, so a slice thinner than the gap between hairlines is below par. The curve plots the same slices cumulatively — the further it sags below the diagonal, the more the surplus is concentrated. Gini is twice the shaded gap: 0 is every team identical, 1 is one team holding everything.</p>
      <p><b>Baseline — ${lorenzBaselineName.toLowerCase()}.</b> ${lorenzBaseline.blurb} Values are scaled by n/(n−1) so a ${nTeams}-team league can reach 1.0.</p>
      ${S.is_current ? html`<p><b>Sources.</b> Projections score each roster's optimal lineup per week from Sleeper projections and this league's scoring; replacement level is ${(teamProjections.replacement_ppg ?? 0).toFixed(1)} PPG from the best free-agent lineup. KTC values are KeepTradeCut ${ktcValues.format} (${ktcValues.ktc_players_loaded} ranked players; ${ktcValues.pick_seasons.join("/")} picks at the mid-round tier); the replacement roster is ${d3.format(",")(ktcValues.replacement_roster_value ?? 0)} KTC for a ${ktcValues.roster_size}-man roster of the best unrostered players.</p>` : html`<p><b>Sources.</b> Final ${season} results from Sleeper. Projections and trade values are only shown for the season in progress.</p>`}
    </div>
  </section>
`);
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Power rankings</strong> combine record and scoring to separate contenders from lucky starts.</li>
    <li><strong>Points per game</strong> predicts playoff success better than total points.</li>
    <li><strong>The ledger</strong> shows whether the league is anyone's to win or already top-heavy.</li>
  </ul>
</section>
