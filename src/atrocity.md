<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Lineup Mistakes
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #ef4444 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Atrocity Score Analysis
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Track your worst lineup decisions throughout the season. Atrocity scores measure decision quality based on projections, rankings, and consensus - not just outcomes. Because sometimes you need to laugh at the pain.
  </p>
</div>

```js
// Load data
const atrocities = await FileAttachment("data/atrocities.json").json();
const users = await FileAttachment("data/users.json").json();
const league = await FileAttachment("data/league.json").json();
```

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {
  calculateRankingGap,
  calculateStartPctGap,
  calculateProjectionGap,
  calculateActualGap
} from "./components/helpers.js";
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
```

## League Overview

<div class="grid grid-4" style="margin: 2rem 0;">
  <div class="kpi-card" style="border-top: 4px solid #ef4444;">
    <div class="kpi-label">Total Atrocities</div>
    <div class="kpi-value" style="color: #ef4444;">${leagueStats.totalAtrocities}</div>
  </div>

  <div class="kpi-card" style="border-top: 4px solid #f59e0b;">
    <div class="kpi-label">Avg Score</div>
    <div class="kpi-value" style="color: #f59e0b;">${leagueStats.avgAtrocityScore.toFixed(1)}</div>
  </div>

  <div class="kpi-card" style="border-top: 4px solid #8b5cf6;">
    <div class="kpi-label">Points Left on Bench</div>
    <div class="kpi-value" style="color: #8b5cf6;">${leagueStats.totalPointsLeft.toFixed(1)}</div>
  </div>

  <div class="kpi-card" style="border-top: 4px solid #dc2626;">
    <div class="kpi-label">Legendary Atrocities</div>
    <div class="kpi-value" style="color: #dc2626;">${leagueStats.legendaryCount}</div>
  </div>
</div>

## Filters

```js
const teamOptions = ['All Teams', ...Array.from(new Set(atrocities.map(a => a.userName))).sort()];
const weekOptions = ['All Weeks', ...Array.from(new Set(atrocities.map(a => a.week))).sort((a, b) => a - b).map(w => `Week ${w}`)];

const selectedTeam = view(Inputs.select(teamOptions, {label: "Filter by Team", value: "All Teams"}));
const selectedWeek = view(Inputs.select(weekOptions, {label: "Filter by Week", value: "All Weeks"}));
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
```

<div class="card">

```js
// Show contextual summary based on filters
if (selectedTeam !== 'All Teams') {
  // Calculate position breakdown for this team
  const positionBreakdown = d3.rollup(
    filteredAtrocities,
    v => v.length,
    d => d.position
  );
  const mostProblematicPos = Array.from(positionBreakdown).sort((a, b) => b[1] - a[1])[0];

  display(html`
    <div style="margin: 0 0 1.5rem 0; padding: 1.5rem; background: var(--theme-background-alt); border-radius: 0.5rem; border-left: 4px solid var(--theme-accent);">
      <h3 style="margin: 0 0 1rem 0; color: var(--theme-accent);">📊 ${selectedTeam}'s Atrocity Profile</h3>
      <div style="display: grid; gap: 0.75rem; font-size: 0.875rem; line-height: 1.6;">
        <div><strong>Total Bad Decisions:</strong> ${filterSummary.count}</div>
        <div><strong>Average Atrocity Score:</strong> ${filterSummary.avgScore ? filterSummary.avgScore.toFixed(1) : 'N/A'}</div>
        <div><strong>Total Points Left on Bench:</strong> ${filterSummary.totalPointsLeft ? filterSummary.totalPointsLeft.toFixed(1) : 'N/A'}</div>
        ${mostProblematicPos ? html`<div><strong>Most Problematic Position:</strong> ${mostProblematicPos[0]} (${mostProblematicPos[1]} atrocities)</div>` : ''}
        ${filterSummary.worstDecision ? html`
          <div style="margin-top: 0.5rem; padding: 0.75rem; background: var(--theme-background); border-radius: 0.25rem; border-left: 3px solid ${filterSummary.worstDecision.severity.color};">
            <strong>Worst Decision:</strong> Week ${filterSummary.worstDecision.week} -
            Started ${filterSummary.worstDecision.startedPlayer.name} over ${filterSummary.worstDecision.benchedPlayer.name}
            (Score: ${filterSummary.worstDecision.score})
          </div>
        ` : ''}
      </div>
    </div>
  `);
}

display(html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1.5rem; background: var(--theme-background-alt); border-radius: 0.5rem;">
    <div>
      <div style="font-size: 0.75rem; color: var(--theme-foreground-alt); margin-bottom: 0.25rem;">Filtered Results</div>
      <div style="font-size: 1.75rem; font-weight: bold; color: var(--theme-accent);">${filterSummary.count}</div>
    </div>
    <div>
      <div style="font-size: 0.75rem; color: var(--theme-foreground-alt); margin-bottom: 0.25rem;">Avg Score</div>
      <div style="font-size: 1.75rem; font-weight: bold; color: #f59e0b;">${filterSummary.avgScore ? filterSummary.avgScore.toFixed(1) : 'N/A'}</div>
    </div>
    <div>
      <div style="font-size: 0.75rem; color: var(--theme-foreground-alt); margin-bottom: 0.25rem;">Total Points Left</div>
      <div style="font-size: 1.75rem; font-weight: bold; color: #ef4444;">${filterSummary.totalPointsLeft ? filterSummary.totalPointsLeft.toFixed(1) : 'N/A'}</div>
    </div>
    <div>
      <div style="font-size: 0.75rem; color: var(--theme-foreground-alt); margin-bottom: 0.25rem;">Worst Score</div>
      <div style="font-size: 1.75rem; font-weight: bold; color: #dc2626;">${filterSummary.worstDecision ? filterSummary.worstDecision.score : 'N/A'}</div>
    </div>
  </div>
`);
```

</div>

```js
const howItWorksContent = html`
  <div>
    <p style="margin: 0 0 1.5rem 0; font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6;">
      Atrocity scores measure <strong>decision quality</strong>, not just outcomes. They focus on what you could have known before kickoff - projections, rankings, and consensus - to identify genuinely bad lineup decisions.
    </p>

    <div class="grid grid-2" style="margin: 1.5rem 0;">
      <div>
        <h4 style="margin: 0 0 0.75rem 0; color: var(--color-text-primary); font-size: 1rem;">Score Components</h4>
        <ul style="margin: 0; padding-left: 1.25rem; line-height: 1.8; font-size: 0.875rem; color: var(--color-text-secondary);">
          <li><strong>Projections Gap (35%):</strong> How obvious the better choice was</li>
          <li><strong>Consensus Gap (35%):</strong> How many managers made the right call</li>
          <li><strong>Rankings Gap (30%):</strong> Position rank difference</li>
          <li><strong>Actual Gap (15%):</strong> Only when pre-game signals were strong</li>
        </ul>
      </div>

      <div>
        <h4 style="margin: 0 0 0.75rem 0; color: var(--color-text-primary); font-size: 1rem;">Severity Levels</h4>
        <div style="display: grid; gap: 0.5rem; font-size: 0.875rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">🟡</span>
            <span><strong style="color: #f59e0b;">Questionable:</strong> 0-20 points</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">🟠</span>
            <span><strong style="color: #fb923c;">Bad Decision:</strong> 20-40 points</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">🔴</span>
            <span><strong style="color: #ef4444;">Egregious:</strong> 40-70 points</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">⚠️</span>
            <span><strong style="color: #dc2626;">Catastrophic:</strong> 70-90 points</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.25rem;">💀</span>
            <span><strong style="color: #7c2d12;">LEGENDARY:</strong> 90-100 points</span>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top: 1.5rem; padding: 1rem; background: var(--color-background-elevated); border-left: 3px solid var(--color-primary); border-radius: 0.5rem;">
      <p style="margin: 0; font-size: 0.875rem; line-height: 1.6; color: var(--color-text-secondary);">
        <strong style="color: var(--color-primary);">Key Insight:</strong> Gut calls are protected - if pre-game signals were weak (score ≤ 20), the actual outcome doesn't count against you. But obvious mistakes (benching studs, starting injured players) are penalized appropriately.
      </p>
    </div>

    <div style="margin-top: 1.5rem; padding: 1.25rem; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(251, 146, 60, 0.05) 100%); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 0.5rem;">
      <h4 style="margin: 0 0 1rem 0; color: #ef4444; font-size: 1rem;">Example: Week 3 - Joe Milton over Josh Allen</h4>

      <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; margin: 1rem 0; padding: 1rem; background: rgba(10, 14, 20, 0.5); border-radius: 0.5rem;">
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Started</div>
          <div style="font-weight: bold; margin-top: 0.25rem;">Joe Milton</div>
          <div style="font-size: 0.875rem; color: #ef4444; margin-top: 0.25rem;">-0.36 pts</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem;">Rank #45, 10% start</div>
        </div>
        <div style="font-size: 1.5rem;">❌</div>
        <div style="text-align: left;">
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Benched</div>
          <div style="font-weight: bold; margin-top: 0.25rem;">Josh Allen</div>
          <div style="font-size: 0.875rem; color: #22c55e; margin-top: 0.25rem;">23.02 pts</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem;">Rank #5, 88% start</div>
        </div>
      </div>

      <div style="font-size: 0.8125rem; line-height: 1.6; color: var(--color-text-secondary); margin-top: 1rem;">
        <div style="margin-bottom: 0.5rem;"><strong style="color: var(--color-text-primary);">Score Breakdown:</strong></div>
        <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; list-style: none;">
          <li style="margin: 0.25rem 0;">• Projections Gap: Milton 8.8 vs Allen 17.9 → <strong>15.8 pts</strong></li>
          <li style="margin: 0.25rem 0;">• Consensus Gap: 10% vs 88% start rate → <strong>27.3 pts</strong></li>
          <li style="margin: 0.25rem 0;">• Rankings Gap: #45 vs #5 (40 positions) → <strong>12.0 pts</strong></li>
          <li style="margin: 0.25rem 0;">• Pre-game score: <strong>55.1 pts</strong> (obvious mistake!)</li>
          <li style="margin: 0.25rem 0;">• Actual outcome validates decision: <strong>+3.9 pts</strong></li>
        </ul>
        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.15); border-radius: 0.25rem; text-align: center;">
          <strong style="color: #ef4444; font-size: 1rem;">Final Atrocity Score: 59 points (🔴 Egregious)</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem;">Cost: 23.4 points on the bench</div>
        </div>
      </div>
    </div>
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">How Atrocity Scores Work</summary>
  <div class="section-content">
    ${howItWorksContent}
  </div>
</details>`);
```

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
    displayLabel: String(d.emoji || '') + ' ' + String(d.label || ''),
    displayText: `${d.count} (${d.avgScore.toFixed(1)} avg)`
  }));

  display(Plot.plot({
    marginLeft: 120,
    height: Math.max(200, severityDataForPlot.length * 60),
    x: {
      label: "Number of Decisions",
      grid: true
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(severityDataForPlot, {
        x: "count",
        y: "displayLabel",
        fill: d => d.color,
        sort: { y: d => -d.level }
      }),
      Plot.text(severityDataForPlot, {
        x: "count",
        y: "displayLabel",
        text: "displayText",
        dx: 10,
        textAnchor: "start",
        fontSize: 12,
        fontWeight: "bold"
      })
    ]
  }));

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
      display(html`<h4 style="margin-top: 30px; margin-bottom: 16px;">Weekly Trend for ${selectedTeam}</h4>`);

      display(Plot.plot({
        height: 300,
        x: {
          label: "Week",
          tickFormat: d => `Wk ${d}`
        },
        y: {
          label: "Atrocity Score",
          grid: true
        },
        marks: [
          Plot.line(weeklyData, {
            x: "week",
            y: "avgScore",
            stroke: "#ef4444",
            strokeWidth: 2,
            curve: "catmull-rom"
          }),
          Plot.dot(weeklyData, {
            x: "week",
            y: "maxScore",
            fill: d => d.maxScore > 70 ? "#dc2626" : "#f59e0b",
            r: 5,
            title: d => `Week ${d.week}: Max score ${d.maxScore.toFixed(0)}`
          }),
          Plot.text(weeklyData, {
            x: "week",
            y: "maxScore",
            text: d => d.count,
            dy: -12,
            fontSize: 10
          })
        ]
      }));
    }
  }
}
```

```js
// This section was previously attempting to create a collapsible "Deep Dive" section,
// but it was empty. The actual filter results are displayed below as cards and charts.
// We'll just keep the existing display pattern since filters are interactive inputs.
```

```js
const hallOfShame = filteredAtrocities
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

// Build all entries as a single HTML block
const hallOfShameEntries = hallOfShame.length === 0
  ? html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; color: var(--theme-foreground-alt); margin: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">No atrocities to display</div>
      <div style="font-size: 14px;">Try adjusting your filters to see lineup decisions.</div>
    </div>
  `
  : html`${hallOfShame.map((atrocity, index) => {
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

  return html`
    <div style="
      padding: 24px;
      background: var(--theme-background-alt);
      border-left: 4px solid ${severity.color};
      border-radius: 8px;
      margin: 20px 0;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <div>
          <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 4px;">
            #${index + 1} • Week ${atrocity.week} • ${atrocity.userName}
          </div>
          <h3 style="margin: 0; color: ${severity.color};">
            ${severity.emoji} ${severity.label}
          </h3>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 48px; font-weight: bold; color: ${severity.color};">
            ${atrocity.score}
          </div>
          <div style="font-size: 14px; color: var(--theme-foreground-alt);">
            Atrocity Score
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin: 20px 0; padding: 20px; background: var(--theme-background); border-radius: 8px;">
        <div style="text-align: right;">
          <div style="color: var(--theme-foreground-alt); font-size: 12px;">Started</div>
          <div style="font-weight: bold; font-size: 16px; margin-top: 4px;">${atrocity.startedPlayer.name}</div>
          <div style="font-size: 14px; color: #ef4444; margin-top: 4px;">${atrocity.startedPlayer.actual.toFixed(1)} pts</div>
          <div style="font-size: 11px; color: var(--theme-foreground-alt); margin-top: 4px;">
            ${status !== 'Active' ? `⚠️ ${status}` : ''}
            ${atrocity.startedPlayer.rank > 0 ? ` • Rank #${atrocity.startedPlayer.rank}` : ''}
          </div>
        </div>
        <div style="font-size: 32px; text-align: center;">❌</div>
        <div style="text-align: left;">
          <div style="color: var(--theme-foreground-alt); font-size: 12px;">Should Have Started</div>
          <div style="font-weight: bold; font-size: 16px; margin-top: 4px; color: ${severity.color};">
            ${atrocity.benchedPlayer.name}
          </div>
          <div style="font-size: 14px; color: #22c55e; margin-top: 4px;">${atrocity.benchedPlayer.actual.toFixed(1)} pts</div>
          <div style="font-size: 11px; color: var(--theme-foreground-alt); margin-top: 4px;">
            ${atrocity.benchedPlayer.rank > 0 ? `Rank #${atrocity.benchedPlayer.rank}` : ''}
          </div>
        </div>
      </div>

      <div style="padding: 16px; background: var(--theme-background); border-radius: 8px; border-left: 3px solid ${severity.color};">
        <div style="font-size: 14px; line-height: 1.6;">
          ${atrocity.explanation}
        </div>
        <div style="margin-top: 12px; font-size: 18px; font-weight: bold; color: ${severity.color};">
          Cost: ${atrocity.pointsLeft.toFixed(1)} points
        </div>
      </div>

      <details style="margin-top: 16px;">
        <summary style="cursor: pointer; padding: 12px; background: var(--theme-background); border-radius: 8px; font-weight: 600; color: var(--theme-accent);">
          📊 Score Calculation Breakdown
        </summary>
        <div style="padding: 20px; background: var(--theme-background); border-radius: 0 0 8px 8px; margin-top: -8px;">

          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; color: var(--theme-accent); font-size: 14px;">Decision Quality Score (Pre-Game Factors)</h4>
            <div style="display: grid; gap: 8px;">
              <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                <span>Projections Gap (35%):</span>
                <span style="font-weight: bold;">${projectionScore} pts</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                <span>Consensus Gap (35%):</span>
                <span style="font-weight: bold;">${consensusScore} pts</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                <span>Rankings Gap (30%):</span>
                <span style="font-weight: bold;">${rankingScore} pts</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px; background: #3b82f615; border-radius: 4px; border: 1px dashed #3b82f6;">
                <span style="font-weight: 600;">Pre-Game Score:</span>
                <span style="font-weight: 600; color: #3b82f6;">${preGameScore.toFixed(1)} pts</span>
              </div>
              ${preGameScore > 20 ? html`
                <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px; opacity: 0.7;">
                  <span>Actual Points Gap <em style="font-size: 11px;">(15% of total - validates bad decision)</em>:</span>
                  <span style="font-weight: bold;">+${(parseFloat(actualScore) * 0.15).toFixed(1)} pts</span>
                </div>
              ` : html`
                <div style="padding: 8px; background: #22c55e15; border-radius: 4px; font-size: 12px; color: #22c55e; text-align: center;">
                  ✓ Gut call - pre-game signals were weak, actual outcome not used
                </div>
              `}
              <div style="display: flex; justify-content: space-between; padding: 12px; background: ${severity.color}20; border-radius: 4px; border-top: 2px solid ${severity.color};">
                <span style="font-weight: bold;">Base Score:</span>
                <span style="font-weight: bold; color: ${severity.color};">${baseScore} pts</span>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; color: var(--theme-accent); font-size: 14px;">Adjustments & Multipliers</h4>
            <div style="display: grid; gap: 8px;">
              ${statusBonus > 0 ? html`
                <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                  <span>Player Status Bonus (${status}):</span>
                  <span style="font-weight: bold; color: #f59e0b;">+${statusBonus} pts</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                <span>Position Volatility (${atrocity.position}):</span>
                <span style="font-weight: bold;">${positionVolatility}x</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--theme-background-alt); border-radius: 4px;">
                <span>Week Context (Week ${atrocity.week}${atrocity.isChampionship ? ' - Championship' : ''}${atrocity.week <= 6 ? (isObviousMistake ? ' - obvious mistake' : ' - early season') : ''}):</span>
                <span style="font-weight: bold;">${weekMultiplier}x</span>
              </div>
            </div>
          </div>

          <div style="padding: 16px; background: ${severity.color}15; border: 2px solid ${severity.color}; border-radius: 8px;">
            <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-bottom: 4px;">Final Calculation:</div>
            <div style="font-family: monospace; font-size: 13px; line-height: 1.8; color: var(--theme-foreground);">
              (${baseScore} base ${statusBonus > 0 ? `+ ${statusBonus} status` : ''}) × ${positionVolatility} position × ${weekMultiplier} week = <strong style="color: ${severity.color}; font-size: 16px;">${atrocity.score}</strong>
            </div>
          </div>

        </div>
      </details>
    </div>
  `;
  })}`;

// Display the entire Hall of Shame section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">🏆 Hall of Shame - Worst Decisions ${selectedTeam !== 'All Teams' ? `for ${selectedTeam}` : ''}${selectedWeek !== 'All Weeks' ? ` in ${selectedWeek}` : ''}</summary>
  <div class="section-content">
    ${hallOfShameEntries}
  </div>
</details>`);
```

```js
// Build Complete List section content
const completeListContent = filteredAtrocities.length === 0
  ? html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; color: var(--theme-foreground-alt);">
      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">No Atrocities Found!</div>
      <div style="font-size: 14px;">Either perfect decisions were made, or try adjusting your filters.</div>
    </div>
  `
  : html`
    <div style="margin-bottom: 16px; color: var(--theme-foreground-alt);">
      Showing ${filteredAtrocities.length} atrocit${filteredAtrocities.length === 1 ? 'y' : 'ies'} sorted by score (highest first)
    </div>
    ${Inputs.table(filteredAtrocities.sort((a, b) => b.score - a.score), {
      columns: ["week", "userName", "position", "startedPlayer", "benchedPlayer", "score", "pointsLeft", "severity"],
      header: {
        week: "Week",
        userName: "Team",
        position: "Pos",
        startedPlayer: "Started",
        benchedPlayer: "Should Have Started",
        score: "Score",
        pointsLeft: "Pts Left",
        severity: "Severity"
      },
      format: {
        startedPlayer: d => `${d.name} (${d.actual.toFixed(1)} pts)`,
        benchedPlayer: d => `${d.name} (${d.actual.toFixed(1)} pts)`,
        pointsLeft: d => d.toFixed(1),
        severity: d => `${d.emoji} ${d.label}`
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
  `;

// Display the entire Complete List section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">📋 Complete List - All Atrocities ${selectedTeam !== 'All Teams' ? `for ${selectedTeam}` : ''}${selectedWeek !== 'All Weeks' ? ` in ${selectedWeek}` : ''}</summary>
  <div class="section-content">
    ${completeListContent}
  </div>
</details>`);
```

```js
// Build Team Atrocity Rankings section content
const teamRankingsContent = html`
  <h3 style="margin-top: 40px;">Who Made the Worst Decisions?</h3>
  ${Plot.plot({
    marginLeft: 150,
    height: userAtrocityStats.length * 50,
    x: {
      label: "Total Atrocity Score",
      grid: true
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(userAtrocityStats, {
        x: "totalScore",
        y: "userName",
        fill: d => {
          if (d.avgScore >= 70) return "#dc2626";
          if (d.avgScore >= 50) return "#ef4444";
          if (d.avgScore >= 30) return "#f59e0b";
          return "#fb923c";
        },
        sort: { y: "-x" }
      }),
      Plot.text(userAtrocityStats, {
        x: "totalScore",
        y: "userName",
        text: d => `${d.totalScore.toFixed(0)} (${d.count} decisions)`,
        dx: -10,
        fill: "white",
        textAnchor: "end",
        fontSize: 12
      })
    ]
  })}
`;

// Display the entire Team Atrocity Rankings section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">Team Atrocity Rankings</summary>
  <div class="section-content">
    ${teamRankingsContent}
  </div>
</details>`);
```

```js
// Build Detailed Team Stats section content
const teamStatsContent = html`${Inputs.table(userAtrocityStats, {
  columns: ["userName", "count", "avgScore", "totalScore", "totalPointsLeft"],
  header: {
    userName: "Team",
    count: "Bad Decisions",
    avgScore: "Avg Score",
    totalScore: "Total Score",
    totalPointsLeft: "Points Left"
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
})}`;

// Display the entire Detailed Team Stats section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">Detailed Team Stats</summary>
  <div class="section-content">
    ${teamStatsContent}
  </div>
</details>`);
```

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

// Build Weekly Atrocity Trends section content
const weeklyTrendsContent = html`
  <h3 style="margin-top: 40px;">Atrocity Trends by Week</h3>
  ${Plot.plot({
    height: 350,
    x: {
      label: "Week",
      tickFormat: d => `Wk ${d}`
    },
    y: {
      label: "Average Atrocity Score",
      grid: true
    },
    marks: [
      Plot.line(weeklyData, {
        x: "week",
        y: "avgScore",
        stroke: "#ef4444",
        strokeWidth: 3,
        curve: "catmull-rom"
      }),
      Plot.dot(weeklyData, {
        x: "week",
        y: "avgScore",
        fill: d => d.avgScore > 50 ? "#dc2626" : "#f59e0b",
        r: 6
      }),
      Plot.text(weeklyData, {
        x: "week",
        y: "avgScore",
        text: d => d.count,
        dy: -15,
        fontSize: 11
      })
    ]
  })}
`;

// Display the entire Weekly Atrocity Trends section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">Weekly Atrocity Trends</summary>
  <div class="section-content">
    ${weeklyTrendsContent}
  </div>
</details>`);
```

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

// Build Position Breakdown section content
const positionBreakdownContent = html`
  <h3 style="margin-top: 40px;">Atrocities by Position</h3>
  ${Plot.plot({
    marginLeft: 80,
    height: 300,
    x: {
      label: "Average Atrocity Score",
      grid: true
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(positionData, {
        x: "avgScore",
        y: "position",
        fill: d => {
          const colors = {
            QB: '#3b82f6',
            RB: '#22c55e',
            WR: '#f59e0b',
            TE: '#8b5cf6',
            K: '#ef4444',
            FLEX: '#fb923c'
          };
          return colors[d.position] || '#6b7280';
        },
        sort: { y: "-x" }
      }),
      Plot.text(positionData, {
        x: "avgScore",
        y: "position",
        text: d => `${d.avgScore.toFixed(1)} (${d.count} decisions)`,
        dx: 10,
        textAnchor: "start",
        fontSize: 12
      })
    ]
  })}
`;

// Display the entire Position Breakdown section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">Position Breakdown</summary>
  <div class="section-content">
    ${positionBreakdownContent}
  </div>
</details>`);
```

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
  displayLabel: String(d.emoji || '') + ' ' + String(d.label || '')
}));

// Build Severity Distribution section content
const severityDistributionContent = html`
  <h3 style="margin-top: 40px;">Atrocity Severity Distribution</h3>
  ${Plot.plot({
    marginLeft: 120,
    height: 300,
    x: {
      label: "Number of Decisions",
      grid: true
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(severityDataWithLabels, {
        x: "count",
        y: "displayLabel",
        fill: d => d.color,
        sort: { y: d => d.level }
      }),
      Plot.text(severityDataWithLabels, {
        x: "count",
        y: "displayLabel",
        text: d => d.count,
        dx: 15,
        fontSize: 14,
        fontWeight: "bold"
      })
    ]
  })}
`;

// Display the entire Severity Distribution section as one block
display(html`<details open class="section-collapse">
  <summary class="section-summary">Severity Distribution</summary>
  <div class="section-content">
    ${severityDistributionContent}
  </div>
</details>`);
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">💡 Tips to Avoid Atrocities</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Check Injury Reports:</strong> Always verify player status before Sunday morning</li>
    <li><strong>Follow Expert Consensus:</strong> If 90% of managers are starting someone, there's probably a reason</li>
    <li><strong>Trust Projections:</strong> They're not perfect, but they're better than gut feelings</li>
    <li><strong>Don't Overthink:</strong> Start your studs, even in "tough matchups"</li>
    <li><strong>Avoid Recency Bias:</strong> Last week's 30-point game doesn't predict this week</li>
    <li><strong>Set Reminders:</strong> Update your lineup Thursday night AND Sunday morning</li>
  </ul>
</div>
