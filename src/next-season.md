# Next Season

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

// Load data
const draftOrderData = await FileAttachment("data/draft-order.json").json();
```

## ${draftOrderData.next_season} Draft Order

```js
display(html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0;">
    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Season</div>
      <div style="font-size: 22px; font-weight: bold;">${draftOrderData.next_season}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Total Teams</div>
      <div style="font-size: 22px; font-weight: bold;">${draftOrderData.total_teams}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Playoff Teams</div>
      <div style="font-size: 22px; font-weight: bold;">${draftOrderData.playoff_teams}</div>
    </div>

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid var(--theme-accent);">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Non-Playoff Teams</div>
      <div style="font-size: 22px; font-weight: bold;">${draftOrderData.total_teams - draftOrderData.playoff_teams}</div>
    </div>
  </div>
`);
```

### How Draft Order is Determined

```js
display(html`
  <div style="margin: 30px 0; padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid var(--theme-accent);">
    <h4 style="margin-top: 0; color: var(--theme-accent);">Draft Order Rules</h4>
    <ul style="line-height: 1.8; margin-bottom: 0;">
      <li><strong>Picks 1-${draftOrderData.total_teams - draftOrderData.playoff_teams}:</strong> Non-playoff teams, ordered by <em>lowest maximum weekly score</em> (prevents tanking by rewarding consistent effort)</li>
      <li><strong>Picks ${draftOrderData.total_teams - draftOrderData.playoff_teams + 1}-${draftOrderData.total_teams}:</strong> Playoff teams, in reverse order of playoff finish (champion picks last)</li>
    </ul>
  </div>
`);
```

## Complete Draft Order

```js
const draftOrder = draftOrderData.draft_order;

display(html`
  <div style="margin: 30px 0;">
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${draftOrder.map((team, i) => html`
        <div style="
          display: grid;
          grid-template-columns: 60px 1fr auto;
          align-items: center;
          padding: 16px 20px;
          background: ${team.category === 'playoff' ? 'rgba(34, 197, 94, 0.1)' : 'var(--theme-background-alt)'};
          border-radius: 8px;
          border-left: 4px solid ${team.category === 'playoff' ? '#22c55e' : '#ef4444'};
        ">
          <div style="font-size: 28px; font-weight: 800; color: var(--theme-accent);">${team.draft_position}</div>
          <div>
            <div style="font-size: 18px; font-weight: 600;">${team.team}</div>
            <div style="font-size: 13px; color: var(--theme-foreground-alt); margin-top: 4px;">
              ${team.category === 'playoff'
                ? `Playoff Finish: ${team.playoff_finish === 1 ? '🏆 Champion' : team.playoff_finish === 2 ? '🥈 Runner-up' : `#${team.playoff_finish}`}`
                : `Max Weekly Score: ${team.max_points.toFixed(2)}`
              }
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; color: var(--theme-foreground-alt);">${team.wins}-${team.losses}</div>
            <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 2px;">${team.total_points.toFixed(1)} pts</div>
          </div>
        </div>
      `)}
    </div>
  </div>
`);
```

## Draft Order by Category

```js
const nonPlayoffTeams = draftOrder.filter(t => t.category === 'non-playoff');
const playoffTeams = draftOrder.filter(t => t.category === 'playoff');
```

### Non-Playoff Teams (Lottery)

```js
display(html`
  <p style="color: var(--theme-foreground-alt); margin-bottom: 20px;">
    Teams that missed the playoffs, ordered by lowest maximum weekly score. This system rewards teams that competed all season rather than those who tanked.
  </p>
`);

display(Inputs.table(nonPlayoffTeams, {
  columns: ["draft_position", "team", "max_points", "wins", "losses", "total_points"],
  header: {
    draft_position: "Pick",
    team: "Team",
    max_points: "Max Weekly",
    wins: "W",
    losses: "L",
    total_points: "Total Pts"
  },
  format: {
    max_points: x => x.toFixed(2),
    total_points: x => x.toFixed(1)
  },
  width: {
    draft_position: 60,
    team: 180,
    max_points: 100,
    wins: 50,
    losses: 50,
    total_points: 90
  }
}));
```

### Playoff Teams

```js
display(html`
  <p style="color: var(--theme-foreground-alt); margin-bottom: 20px;">
    Teams that made the playoffs, picking in reverse order of their playoff finish. The champion picks last.
  </p>
`);

display(Inputs.table(playoffTeams, {
  columns: ["draft_position", "team", "playoff_finish", "wins", "losses", "total_points"],
  header: {
    draft_position: "Pick",
    team: "Team",
    playoff_finish: "Playoff Finish",
    wins: "W",
    losses: "L",
    total_points: "Total Pts"
  },
  format: {
    playoff_finish: x => x === 1 ? "🏆 Champion" : x === 2 ? "🥈 Runner-up" : `#${x}`,
    total_points: x => x.toFixed(1)
  },
  width: {
    draft_position: 60,
    team: 180,
    playoff_finish: 120,
    wins: 50,
    losses: 50,
    total_points: 90
  }
}));
```

## Max Weekly Score Distribution

```js
display(html`<h3 style="margin-top: 40px;">Max Weekly Score Comparison</h3>`);

display(Plot.plot({
  marginLeft: 150,
  height: Math.max(400, draftOrder.length * 35),
  x: {
    label: "Max Weekly Score",
    grid: true
  },
  y: {
    label: null
  },
  marks: [
    Plot.barX(draftOrder, {
      x: "max_points",
      y: "team",
      fill: d => d.category === 'playoff' ? "#22c55e" : "#ef4444",
      sort: { y: "-x" }
    }),
    Plot.text(draftOrder, {
      x: "max_points",
      y: "team",
      text: d => `#${d.draft_position}`,
      dx: -25,
      fill: "white",
      fontWeight: "bold"
    }),
    Plot.ruleX([0])
  ]
}));
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">📋 Draft Order Summary</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Anti-Tanking Measure:</strong> Using max weekly score instead of total points prevents teams from intentionally losing</li>
    <li><strong>Playoff Advantage:</strong> Making the playoffs means picking later, rewarding competitive success</li>
    <li><strong>Champion Penalty:</strong> The championship winner picks last, maintaining league parity</li>
  </ul>
</div>
