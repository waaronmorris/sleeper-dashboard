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
      <li><strong>Picks 1-${draftOrderData.total_teams - draftOrderData.playoff_teams}:</strong> Non-playoff teams, ordered by <em>lowest Max PF</em> (total season points)</li>
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
                : `Max PF: ${pick.max_pf.toFixed(2)}`
              }
              ${pick.is_traded ? ' • Traded' : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; color: var(--theme-foreground-alt);">${pick.wins}-${pick.losses}</div>
            <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 2px;">${pick.max_pf.toFixed(1)} pts</div>
          </div>
        </div>
      `)}
    </div>
  </div>
`);
```

## Future Draft Picks by Owner

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
  <p style="color: var(--theme-foreground-alt); margin-bottom: 20px;">
    Overview of each team's draft capital by round for the next ${futureSeasons.length} seasons (${futureSeasons.join(', ')}). Numbers show total picks owned per round.
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

display(html`
  <div style="overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed;">
      <thead>
        <tr style="background: var(--theme-background-alt);">
          <th rowspan="2" style="padding: 12px; text-align: left; font-weight: 600; position: sticky; left: 0; background: var(--theme-background-alt); z-index: 2; border-bottom: 2px solid var(--theme-accent); width: 120px;">TEAM</th>
          ${displayRounds.map(round => html`
            <th colspan="${futureSeasons.length}" style="padding: 8px 4px; text-align: center; font-weight: 600; border-left: 2px solid rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.1);">RD ${round}</th>
          `)}
          <th rowspan="2" style="padding: 12px 8px; text-align: center; font-weight: 600; border-left: 2px solid rgba(255,255,255,0.2); border-bottom: 2px solid var(--theme-accent); width: 55px;">Total</th>
          <th rowspan="2" style="padding: 12px 8px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--theme-accent); width: 50px;">Net</th>
        </tr>
        <tr style="background: var(--theme-background-alt); border-bottom: 2px solid var(--theme-accent);">
          ${displayRounds.flatMap((round, rIdx) => futureSeasons.map((season, sIdx) => html`
            <th style="padding: 6px 2px; text-align: center; font-weight: 500; font-size: 10px; color: var(--theme-foreground-alt); ${sIdx === 0 ? 'border-left: 2px solid rgba(255,255,255,0.2);' : ''} width: 42px;">${season}</th>
          `))}
        </tr>
      </thead>
      <tbody>
        ${futurePicksByOwner.map((owner, idx) => {
          const picksByRoundSeason = getPicksPerRoundAndSeason(owner);
          return html`
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
              <td style="padding: 10px 8px; font-weight: 600; position: sticky; left: 0; background: ${idx % 2 === 0 ? 'var(--theme-background)' : 'rgba(26, 31, 41, 0.98)'}; z-index: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px;">
                ${owner.team}
              </td>
              ${displayRounds.flatMap((round, rIdx) => futureSeasons.map((season, sIdx) => {
                const data = picksByRoundSeason[round][season];
                const total = data.own + data.acquired;
                const hasAcquired = data.acquired > 0;
                return html`
                  <td style="padding: 6px 2px; text-align: center; ${sIdx === 0 ? 'border-left: 2px solid rgba(255,255,255,0.2);' : ''}">
                    <span style="
                      display: inline-block;
                      min-width: 26px;
                      padding: 4px 6px;
                      border-radius: 4px;
                      font-size: 13px;
                      font-weight: 600;
                      background: ${total === 0 ? 'rgba(239, 68, 68, 0.2)' : hasAcquired ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)'};
                      color: ${total === 0 ? '#ef4444' : hasAcquired ? '#f59e0b' : '#22c55e'};
                    " title="${season} Round ${round}: ${data.own} own + ${data.acquired} acquired${data.traded > 0 ? ` (${data.traded} traded away)` : ''}">
                      ${total}
                    </span>
                  </td>
                `;
              }))}
              <td style="padding: 10px 4px; text-align: center; font-weight: 600; font-size: 15px; color: var(--theme-accent); border-left: 2px solid rgba(255,255,255,0.2);">
                ${owner.total_picks}
              </td>
              <td style="padding: 10px 4px; text-align: center; font-weight: 600; font-size: 15px; color: ${owner.net_picks > 0 ? '#22c55e' : owner.net_picks < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'};">
                ${owner.net_picks > 0 ? '+' : ''}${owner.net_picks}
              </td>
            </tr>
          `;
        })}
      </tbody>
    </table>
  </div>
`);
```

## Draft Capital Summary

```js
display(html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 30px 0;">
    ${futurePicksByOwner.slice(0, 6).map(owner => html`
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid ${owner.net_picks > 0 ? '#22c55e' : owner.net_picks < 0 ? '#ef4444' : 'var(--theme-accent)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 16px; font-weight: 600;">${owner.team}</div>
          <div style="font-size: 24px; font-weight: bold; color: var(--theme-accent);">${owner.total_picks}</div>
        </div>
        <div style="display: flex; gap: 16px; font-size: 13px;">
          <div>
            <span style="color: var(--theme-foreground-muted);">Acquired:</span>
            <span style="color: #f59e0b; font-weight: 600;"> ${owner.total_acquired}</span>
          </div>
          <div>
            <span style="color: var(--theme-foreground-muted);">Traded:</span>
            <span style="color: #ef4444; font-weight: 600;"> ${owner.total_traded_away}</span>
          </div>
          <div>
            <span style="color: var(--theme-foreground-muted);">Net:</span>
            <span style="color: ${owner.net_picks > 0 ? '#22c55e' : owner.net_picks < 0 ? '#ef4444' : 'var(--theme-foreground-alt)'}; font-weight: 600;">
              ${owner.net_picks > 0 ? '+' : ''}${owner.net_picks}
            </span>
          </div>
        </div>
      </div>
    `)}
  </div>
`);
```

## Picks by Owner (${draftOrderData.next_season} Round 1)

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
    Summary of first-round pick ownership for the upcoming ${draftOrderData.next_season} draft.
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
    Teams that missed the playoffs, ordered by lowest Max PF (total season points).
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

## Max PF Distribution

```js
display(html`<h3 style="margin-top: 40px;">Max PF Comparison (Total Season Points)</h3>`);

display(Plot.plot({
  marginLeft: 150,
  height: Math.max(400, draftOrder.length * 35),
  x: {
    label: "Max PF (Total Season Points)",
    grid: true
  },
  y: {
    label: null
  },
  marks: [
    Plot.barX(draftOrder, {
      x: "max_pf",
      y: "original_team",
      fill: d => d.category === 'playoff' ? "#22c55e" : "#ef4444",
      sort: { y: "-x" }
    }),
    Plot.text(draftOrder, {
      x: "max_pf",
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
  <h3 style="margin-top: 0;">Draft Capital Legend</h3>
  <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 16px; height: 16px; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 4px;"></span>
      <span>Own Pick</span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 16px; height: 16px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 4px;"></span>
      <span>Acquired via Trade</span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="color: #ef4444;">Traded Away</span>
      <span>- Pick sent to another team</span>
    </div>
  </div>
</div>
