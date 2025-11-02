<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #22c55e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Trade Analysis
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #22c55e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    AI-Powered Trade Commentary
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Expert analysis of every trade in your league history, featuring commentary from legendary NFL draft and personnel analysts. See trades through the eyes of Mel Kiper Jr., Adam Schefter, and other top talent evaluators.
  </p>
</div>

```js
// Load data
const tradeAnalyses = await FileAttachment("data/trade-analysis.json").json();
const trades = await FileAttachment("data/trades.json").json();
const players = await FileAttachment("data/players.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();

// Debug logging
console.log(`Loaded ${tradeAnalyses.length} trade analyses`);
console.log(`Loaded ${trades.length} trades`);
```

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

// Match analyses to trade details
const enrichedAnalyses = tradeAnalyses.map(analysis => {
  // Find the corresponding trade
  const trade = trades.find(t => {
    // Match by created timestamp and participants
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

  return {
    ...analysis,
    trade
  };
});

// Filter options
const allSeasons = [...new Set(enrichedAnalyses.map(a => a.season))].sort((a, b) => b - a);
const allPersonas = [...new Set(enrichedAnalyses.map(a => a.persona))].sort();
```

## Filters

<div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">

```js
const selectedSeason = view(Inputs.select(
  ["All Seasons", ...allSeasons],
  { label: "Season", value: "All Seasons" }
));
```

```js
const selectedPersona = view(Inputs.select(
  ["All Analysts", ...allPersonas],
  { label: "Analyst", value: "All Analysts" }
));
```

```js
const searchQuery = view(Inputs.search(enrichedAnalyses, {
  placeholder: "Search trades by player or manager...",
  query: (query, analysis) => {
    const lowerQuery = query.toLowerCase();
    return analysis.participants.some(p => p.toLowerCase().includes(lowerQuery)) ||
           analysis.analysis.toLowerCase().includes(lowerQuery);
  }
}));
```

</div>

```js
// Apply filters
let filteredAnalyses = searchQuery.length > 0 ? searchQuery : enrichedAnalyses;

if (selectedSeason !== "All Seasons") {
  filteredAnalyses = filteredAnalyses.filter(a => a.season === selectedSeason);
}

if (selectedPersona !== "All Analysts") {
  filteredAnalyses = filteredAnalyses.filter(a => a.persona === selectedPersona);
}
```

<div style="margin-bottom: 1rem; color: #94a3b8; font-size: 0.875rem;">
  Showing ${filteredAnalyses.length} trade ${filteredAnalyses.length === 1 ? 'analysis' : 'analyses'}
</div>

```js
// Display analyses
if (tradeAnalyses.length === 0) {
  display(html`
    <div style="padding: 3rem; text-align: center; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 0.5rem; margin: 2rem 0;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
      <h3 style="margin: 0 0 0.5rem 0; color: #22c55e;">No Trade Analyses Yet</h3>
      <p style="color: #cbd5e1; margin: 0 0 1.5rem 0;">Generate AI-powered trade commentary to see expert analysis here.</p>
      <div style="background: #1a1f29; padding: 1rem; border-radius: 0.375rem; font-family: monospace; font-size: 0.875rem; text-align: left; max-width: 500px; margin: 0 auto;">
        <code style="color: #22c55e;">node src/data/generate-trade-analysis.js</code>
      </div>
      <p style="color: #94a3b8; font-size: 0.875rem; margin: 1rem 0 0 0;">
        Make sure you've set your <code style="background: rgba(34, 197, 94, 0.2); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">ANTHROPIC_API_KEY</code> in your .env file
      </p>
    </div>
  `);
} else if (filteredAnalyses.length === 0) {
  display(html`
    <div style="padding: 2rem; text-align: center; color: #94a3b8;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
      <p>No trades match your current filters</p>
    </div>
  `);
} else {
  filteredAnalyses.forEach((analysis, index) => {
    display(html`
      <div style="margin-bottom: 2rem; background: #1a1f29; border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
              Week ${analysis.week} • ${analysis.season} Season
            </div>
            <div style="font-size: 1.25rem; font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem;">
              ${analysis.participants.join(' ⇄ ')}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 0.25rem 0.75rem; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 1rem; font-size: 0.75rem; font-weight: 600; color: #22c55e;">
              ${analysis.persona}
            </div>
          </div>
        </div>

        <!-- Trade Details -->
        ${analysis.trade ? html`
          <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 0.5rem; font-size: 0.875rem;">
            ${(() => {
              const rosterIds = new Set([
                ...Object.values(analysis.trade.adds || {}),
                ...Object.values(analysis.trade.drops || {})
              ]);

              return Array.from(rosterIds).map(rosterId => {
                const user = getUserByRosterId(rosterId);
                const userName = user?.display_name || `Team ${rosterId}`;

                // Get what this roster receives
                const receives = [];
                if (analysis.trade.adds) {
                  Object.entries(analysis.trade.adds).forEach(([playerId, rId]) => {
                    if (rId === rosterId) {
                      receives.push(getPlayerName(playerId));
                    }
                  });
                }

                // Get what this roster gives
                const gives = [];
                if (analysis.trade.drops) {
                  Object.entries(analysis.trade.drops).forEach(([playerId, rId]) => {
                    if (rId === rosterId) {
                      gives.push(getPlayerName(playerId));
                    }
                  });
                }

                // Add draft picks
                if (analysis.trade.draft_picks) {
                  analysis.trade.draft_picks.forEach(pick => {
                    if (pick.owner_id === rosterId) {
                      receives.push(`${pick.season} Rd ${pick.round} pick`);
                    }
                    if (pick.previous_owner_id === rosterId) {
                      gives.push(`${pick.season} Rd ${pick.round} pick`);
                    }
                  });
                }

                return html`
                  <div style="margin-bottom: 1rem;">
                    <div style="font-weight: 600; color: #22c55e; margin-bottom: 0.5rem;">
                      ${userName}
                    </div>
                    ${receives.length > 0 ? html`
                      <div style="margin-bottom: 0.25rem;">
                        <span style="color: #94a3b8;">Receives:</span>
                        <span style="color: #cbd5e1; margin-left: 0.5rem;">
                          ${receives.join(', ')}
                        </span>
                      </div>
                    ` : ''}
                    ${gives.length > 0 ? html`
                      <div>
                        <span style="color: #94a3b8;">Gives:</span>
                        <span style="color: #cbd5e1; margin-left: 0.5rem;">
                          ${gives.join(', ')}
                        </span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('');
            })()}
          </div>
        ` : ''}

        <!-- Analysis -->
        <div style="color: #e2e8f0; line-height: 1.7; white-space: pre-wrap; font-size: 0.9375rem;">
${analysis.analysis}
        </div>

        <!-- Footer -->
        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(148, 163, 184, 0.1); font-size: 0.75rem; color: #64748b;">
          Generated: ${new Date(analysis.generatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    `);
  });
}
```

---

## About the Analysts

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem;">

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Mel Kiper Jr.</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    Draft expert known for detailed player evaluations, rankings, and passionate analysis. Focuses on talent assessment and upside.
  </p>
</div>

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Adam Schefter</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    NFL insider with breaking news style. Provides context, league-wide implications, and behind-the-scenes perspective.
  </p>
</div>

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Daniel Jeremiah</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    Former scout with analytical perspective. Evaluates trades through talent metrics, scheme fit, and production analysis.
  </p>
</div>

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Todd McShay</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    Draft analyst focused on value and team needs. Evaluates trades through roster construction and team-building strategy.
  </p>
</div>

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Louis Riddick</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    Former GM with executive perspective. Analyzes asset management, championship windows, and organizational strategy.
  </p>
</div>

<div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 0.5rem;">
  <h4 style="margin: 0 0 0.5rem 0; color: #22c55e;">Ian Rapoport</h4>
  <p style="margin: 0; font-size: 0.875rem; color: #cbd5e1; line-height: 1.5;">
    NFL insider with quick, punchy analysis. Provides insider context and future implications of personnel moves.
  </p>
</div>

</div>
