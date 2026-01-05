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
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin: 30px 0;">
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

    <div style="padding: 25px; background: var(--theme-background-alt); border-radius: 8px; border-top: 4px solid #f59e0b;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 8px;">Traded Picks</div>
      <div style="font-size: 22px; font-weight: bold; color: #f59e0b;">${draftOrderData.traded_pick_count}</div>
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
      <li><strong style="color: #f59e0b;">Traded Picks:</strong> Shown with current owner - picks may have changed hands via trades</li>
    </ul>
  </div>
`);
```

## Complete Draft Order (Round 1)

```js
const draftOrder = draftOrderData.draft_order;

display(html`
  <div style="margin: 30px 0;">
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${draftOrder.map((pick, i) => html`
        <div style="
          display: grid;
          grid-template-columns: 60px 1fr auto;
          align-items: center;
          padding: 16px 20px;
          background: ${pick.is_traded ? 'rgba(245, 158, 11, 0.1)' : pick.category === 'playoff' ? 'rgba(34, 197, 94, 0.1)' : 'var(--theme-background-alt)'};
          border-radius: 8px;
          border-left: 4px solid ${pick.is_traded ? '#f59e0b' : pick.category === 'playoff' ? '#22c55e' : '#ef4444'};
        ">
          <div style="font-size: 28px; font-weight: 800; color: ${pick.is_traded ? '#f59e0b' : 'var(--theme-accent)'};">${pick.draft_position}</div>
          <div>
            <div style="font-size: 18px; font-weight: 600;">
              ${pick.is_traded
                ? html`<span style="color: #f59e0b;">${pick.current_owner}</span> <span style="color: var(--theme-foreground-muted); font-size: 14px;">(via ${pick.original_team})</span>`
                : pick.original_team
              }
            </div>
            <div style="font-size: 13px; color: var(--theme-foreground-alt); margin-top: 4px;">
              ${pick.category === 'playoff'
                ? `Playoff Finish: ${pick.playoff_finish === 1 ? '🏆 Champion' : pick.playoff_finish === 2 ? '🥈 Runner-up' : `#${pick.playoff_finish}`}`
                : `Max Weekly Score: ${pick.max_points.toFixed(2)}`
              }
              ${pick.is_traded ? ' • Traded' : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; color: var(--theme-foreground-alt);">${pick.wins}-${pick.losses}</div>
            <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 2px;">${pick.total_points.toFixed(1)} pts</div>
          </div>
        </div>
      `)}
    </div>
  </div>
`);
```

## Picks by Owner

```js
const picksByOwner = draftOrderData.picks_by_owner
  .map(owner => ({
    ...owner,
    total_picks: owner.own_picks.length + owner.acquired_picks.length,
    picks_traded_away: draftOrder.filter(p => p.original_roster_id === owner.roster_id && p.is_traded).length
  }))
  .sort((a, b) => b.total_picks - a.total_picks);

display(html`
  <p style="color: var(--theme-foreground-alt); margin-bottom: 20px;">
    Summary of first-round pick ownership after trades.
  </p>
`);

display(html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 20px 0;">
    ${picksByOwner.map(owner => html`
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid ${owner.total_picks > 1 ? '#22c55e' : owner.total_picks === 0 ? '#ef4444' : 'var(--theme-accent)'};">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${owner.team}</div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${owner.total_picks}</div>
            <div style="font-size: 12px; color: var(--theme-foreground-alt);">Total Picks</div>
          </div>
          ${owner.own_picks.length > 0 ? html`
            <div>
              <div style="font-size: 14px; color: var(--theme-foreground-alt);">Own: ${owner.own_picks.map(p => `#${p.draft_position}`).join(', ')}</div>
            </div>
          ` : ''}
          ${owner.acquired_picks.length > 0 ? html`
            <div>
              <div style="font-size: 14px; color: #f59e0b;">Acquired: ${owner.acquired_picks.map(p => `#${p.draft_position} (${p.from_team})`).join(', ')}</div>
            </div>
          ` : ''}
          ${owner.picks_traded_away > 0 ? html`
            <div>
              <div style="font-size: 14px; color: #ef4444;">Traded Away: ${owner.picks_traded_away}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `)}
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
  columns: ["draft_position", "current_owner", "original_team", "is_traded", "max_points", "wins", "losses"],
  header: {
    draft_position: "Pick",
    current_owner: "Owner",
    original_team: "Original",
    is_traded: "Traded?",
    max_points: "Max Weekly",
    wins: "W",
    losses: "L"
  },
  format: {
    is_traded: x => x ? "Yes" : "No",
    max_points: x => x.toFixed(2)
  },
  width: {
    draft_position: 60,
    current_owner: 140,
    original_team: 140,
    is_traded: 70,
    max_points: 100,
    wins: 50,
    losses: 50
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
  columns: ["draft_position", "current_owner", "original_team", "is_traded", "playoff_finish", "wins", "losses"],
  header: {
    draft_position: "Pick",
    current_owner: "Owner",
    original_team: "Original",
    is_traded: "Traded?",
    playoff_finish: "Playoff Finish",
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
      y: "original_team",
      fill: d => d.category === 'playoff' ? "#22c55e" : "#ef4444",
      sort: { y: "-x" }
    }),
    Plot.text(draftOrder, {
      x: "max_points",
      y: "original_team",
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
  <h3 style="margin-top: 0;">Draft Order Summary</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Anti-Tanking Measure:</strong> Using max weekly score instead of total points prevents teams from intentionally losing</li>
    <li><strong>Playoff Advantage:</strong> Making the playoffs means picking later, rewarding competitive success</li>
    <li><strong>Champion Penalty:</strong> The championship winner picks last, maintaining league parity</li>
    <li><strong style="color: #f59e0b;">Traded Picks:</strong> ${draftOrderData.traded_pick_count} pick(s) have changed hands - shown with current owner</li>
  </ul>
</div>
