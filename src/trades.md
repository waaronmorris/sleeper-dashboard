<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Trade Evaluation
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Trade Analyzer
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Evaluate potential trades with data-driven player valuations. Compare roster values, analyze position impacts, and make informed decisions that improve your championship odds.
  </p>
</div>

```js
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";

// Load data
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
```

```js
// Helper function to get team roster
function getTeamRoster(userId) {
  const roster = rosters.find(r => r.owner_id === userId);
  if (!roster || !roster.players) return [];

  return roster.players.map(playerId => {
    const player = players[playerId];
    return {
      id: playerId,
      name: player ? `${player.first_name} ${player.last_name}` : playerId,
      position: player?.position || 'N/A',
      team: player?.team || 'FA',
      age: player?.age || 0,
      years_exp: player?.years_exp || 0,
      injury_status: player?.injury_status
    };
  }).filter(p => p.position !== 'DEF');
}

// Create player value map based on simple heuristics
function calculatePlayerValue(player) {
  let value = 100; // Base value

  // Position modifiers
  const positionValues = { QB: 1.2, RB: 1.5, WR: 1.3, TE: 1.0, K: 0.3 };
  value *= (positionValues[player.position] || 1.0);

  // Age penalty/bonus
  if (player.age > 0) {
    if (player.age < 25) value *= 1.2; // Young upside
    else if (player.age > 30) value *= 0.8; // Age decline
  }

  // Experience factor
  if (player.years_exp === 0) value *= 0.7; // Rookie discount
  else if (player.years_exp >= 2 && player.years_exp <= 5) value *= 1.1; // Prime years

  // Injury penalty
  if (player.injury_status) value *= 0.7;

  return Math.round(value);
}
```

```js
// Team selectors
const team1Select = Inputs.select(users, {
  label: "Team 1",
  format: u => u.display_name,
  value: users[0]
});
const team1 = Generators.input(team1Select);

const team2Select = Inputs.select(users.filter(u => u.user_id !== team1.user_id), {
  label: "Team 2",
  format: u => u.display_name,
  value: users.find(u => u.user_id !== team1.user_id)
});
const team2 = Generators.input(team2Select);
```

```js
// Get rosters for selected teams
const team1Roster = getTeamRoster(team1.user_id);
const team2Roster = getTeamRoster(team2.user_id);

// Add values to players
const team1PlayersWithValue = team1Roster.map(p => ({
  ...p,
  value: calculatePlayerValue(p)
})).sort((a, b) => b.value - a.value);

const team2PlayersWithValue = team2Roster.map(p => ({
  ...p,
  value: calculatePlayerValue(p)
})).sort((a, b) => b.value - a.value);
```

```js
// Player selection for trade
const team1PlayersSelect = Inputs.checkbox(team1PlayersWithValue, {
  label: `${team1.display_name}'s Players to Trade Away`,
  format: p => `${p.name} (${p.position}) - Value: ${p.value}`,
  value: []
});
const team1TradePlayers = Generators.input(team1PlayersSelect);

const team2PlayersSelect = Inputs.checkbox(team2PlayersWithValue, {
  label: `${team2.display_name}'s Players to Trade Away`,
  format: p => `${p.name} (${p.position}) - Value: ${p.value}`,
  value: []
});
const team2TradePlayers = Generators.input(team2PlayersSelect);

const tradeEvaluatorContent = html`
  <div>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Select two teams and the players involved to evaluate trade fairness based on position scarcity, age, experience, and injury status.
    </p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
      <div>${team1Select}</div>
      <div>${team2Select}</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        ${team1PlayersSelect}
      </div>
      <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
        ${team2PlayersSelect}
      </div>
    </div>
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Trade Evaluator</summary>
  <div class="section-content">
    ${tradeEvaluatorContent}
  </div>
</details>`);
```

```js
if (team1TradePlayers.length > 0 || team2TradePlayers.length > 0) {
  const team1Value = team1TradePlayers.reduce((sum, p) => sum + p.value, 0);
  const team2Value = team2TradePlayers.reduce((sum, p) => sum + p.value, 0);
  const valueDiff = Math.abs(team1Value - team2Value);
  const diffPercent = team1Value > 0 ? (valueDiff / Math.max(team1Value, team2Value) * 100) : 0;

  const isFair = diffPercent < 20; // Consider trade fair if within 20% value
  const winner = team1Value > team2Value ? team1.display_name : team2Value > team1Value ? team2.display_name : "Even";

  // Position analysis
  const team1Positions = d3.rollup(team1TradePlayers, v => v.length, d => d.position);
  const team2Positions = d3.rollup(team2TradePlayers, v => v.length, d => d.position);

  const tradeAnalysisContent = html`
    <div>
      <div style="margin: 0 0 30px 0; padding: 30px; background: ${isFair ? '#22c55e20' : '#f59e0b20'}; border-left: 4px solid ${isFair ? '#22c55e' : '#f59e0b'}; border-radius: 8px;">
        <h2 style="margin-top: 0;">${isFair ? '✅' : '⚠️'} Trade Evaluation</h2>

        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 30px; align-items: center; margin: 30px 0;">
          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">${team1.display_name}</div>
            <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 15px;">Gives Up:</div>
            <div style="background: var(--theme-background); padding: 15px; border-radius: 8px; min-height: 80px;">
              ${team1TradePlayers.length > 0 ? team1TradePlayers.map(p => html`
                <div style="margin: 5px 0;">${p.name} (${p.position})</div>
              `) : html`<div style="color: var(--theme-foreground-alt);">No players selected</div>`}
            </div>
            <div style="margin-top: 20px; font-size: 24px; font-weight: bold; color: var(--theme-accent);">
              Total Value: ${team1Value}
            </div>
          </div>

          <div style="text-align: center;">
            <div style="font-size: 32px;">⇄</div>
          </div>

          <div style="text-align: center;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">${team2.display_name}</div>
            <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 15px;">Gives Up:</div>
            <div style="background: var(--theme-background); padding: 15px; border-radius: 8px; min-height: 80px;">
              ${team2TradePlayers.length > 0 ? team2TradePlayers.map(p => html`
                <div style="margin: 5px 0;">${p.name} (${p.position})</div>
              `) : html`<div style="color: var(--theme-foreground-alt);">No players selected</div>`}
            </div>
            <div style="margin-top: 20px; font-size: 24px; font-weight: bold; color: var(--theme-accent);">
              Total Value: ${team2Value}
            </div>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background: var(--theme-background); border-radius: 8px;">
          <div style="font-size: 16px; margin-bottom: 10px;">
            <strong>Value Difference:</strong> ${valueDiff} points (${diffPercent.toFixed(1)}%)
          </div>
          <div style="font-size: 16px; margin-bottom: 10px;">
            <strong>Trade Fairness:</strong> ${isFair ? 'Fair Trade' : 'Potentially Unbalanced'}
          </div>
          ${winner !== "Even" ? html`
            <div style="font-size: 16px; color: var(--theme-accent);">
              <strong>Advantage:</strong> ${winner}
            </div>
          ` : html`
            <div style="font-size: 16px; color: var(--theme-accent);">
              <strong>Result:</strong> Even Trade
            </div>
          `}
        </div>
      </div>

      <div style="margin: 20px 0;">
        <h3>Position Impact</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <strong>${team1.display_name} Loses:</strong>
            <ul style="margin: 10px 0;">
              ${Array.from(team1Positions, ([pos, count]) => html`<li>${count} ${pos}</li>`)}
            </ul>
            <strong>Gains:</strong>
            <ul style="margin: 10px 0;">
              ${Array.from(team2Positions, ([pos, count]) => html`<li>${count} ${pos}</li>`)}
            </ul>
          </div>
          <div style="padding: 15px; background: var(--theme-background-alt); border-radius: 8px;">
            <strong>${team2.display_name} Loses:</strong>
            <ul style="margin: 10px 0;">
              ${Array.from(team2Positions, ([pos, count]) => html`<li>${count} ${pos}</li>`)}
            </ul>
            <strong>Gains:</strong>
            <ul style="margin: 10px 0;">
              ${Array.from(team1Positions, ([pos, count]) => html`<li>${count} ${pos}</li>`)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  display(html`<details open class="section-collapse">
    <summary class="section-summary">Trade Analysis Results</summary>
    <div class="section-content">
      ${tradeAnalysisContent}
    </div>
  </details>`);
}
```

```js
// Calculate total roster values
const allTeamValues = users.map(user => {
  const roster = getTeamRoster(user.user_id);
  const totalValue = roster.reduce((sum, p) => sum + calculatePlayerValue(p), 0);
  const avgValue = roster.length > 0 ? totalValue / roster.length : 0;

  return {
    team: user.display_name,
    total_value: totalValue,
    avg_value: avgValue,
    roster_size: roster.length
  };
}).sort((a, b) => b.total_value - a.total_value);

const rosterValueContent = html`
  <div>
    <h3 style="margin-top: 0; margin-bottom: 1rem;">League Roster Values</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Compare total roster values across the league to identify teams positioned for trades or playoff runs.
    </p>
    ${Plot.plot({
      marginLeft: 150,
      height: users.length * 40,
      x: {
        label: "Total Roster Value",
        grid: true
      },
      y: {
        label: null
      },
      marks: [
        Plot.barX(allTeamValues, {
          x: "total_value",
          y: "team",
          fill: "var(--theme-accent)",
          sort: { y: "-x" }
        }),
        Plot.text(allTeamValues, {
          x: "total_value",
          y: "team",
          text: d => d.total_value,
          dx: -10,
          fill: "white",
          textAnchor: "end"
        })
      ]
    })}
    <h3 style="margin: 2rem 0 1rem 0;">Team Value Breakdown</h3>
    ${Inputs.table(allTeamValues, {
      columns: ["team", "total_value", "avg_value", "roster_size"],
      header: {
        team: "Team",
        total_value: "Total Value",
        avg_value: "Avg Player Value",
        roster_size: "Roster Size"
      },
      format: {
        avg_value: x => x.toFixed(1)
      }
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Roster Value Comparison</summary>
  <div class="section-content">
    ${rosterValueContent}
  </div>
</details>`);
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">💡 Trade Analysis Notes</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Value Calculation:</strong> Based on position scarcity, age, experience, and injury status</li>
    <li><strong>Fair Trade Threshold:</strong> Trades within 20% value difference are considered fair</li>
    <li><strong>Position Needs:</strong> Consider your team's positional depth when evaluating trades</li>
    <li><strong>Context Matters:</strong> This tool provides a starting point - consider playoff schedules, bye weeks, and team needs</li>
    <li><strong>Dynasty Considerations:</strong> Young players may have higher long-term value than this tool reflects</li>
  </ul>
</div>
