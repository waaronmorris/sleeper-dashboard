# Ring of Honor

<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(251, 146, 60, 0.15); border: 1px solid rgba(251, 146, 60, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #fb923c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Fantasy Alumni
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #fb923c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Ring of Honor
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Celebrate the legacy of players who once wore your team's colors. These fantasy legends made their mark and moved on, but their contributions live forever in your team's Ring of Honor.
  </p>
</div>

```js
import * as d3 from "npm:d3";

// Load data
const retirees = await FileAttachment("data/ring-of-honor.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const players = await FileAttachment("data/players.json").json();
```

```js
// Helper function to get user by roster ID
function getUserByRosterId(rosterId) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return null;
  return users.find(u => u.user_id === roster.owner_id);
}

// Helper function to get player info
function getPlayerInfo(playerId) {
  const player = players[playerId];
  if (!player) return { name: playerId, position: 'N/A', team: 'FA' };
  return {
    name: `${player.first_name} ${player.last_name}`,
    position: player.position || 'N/A',
    team: player.team || 'FA',
    age: player.age,
    status: player.status
  };
}

// Group retirees by their last roster
const retireesByTeam = d3.group(retirees, d => d.lastRosterId);

// Calculate summary stats
const totalRetirees = retirees.length;
const totalPointsAllRetirees = d3.sum(retirees, d => d.totalPoints);
const avgPointsPerRetiree = totalRetirees > 0 ? totalPointsAllRetirees / totalRetirees : 0;

// Find the most impactful retiree overall
const mostImpactfulRetiree = retirees.reduce((max, r) =>
  r.totalPoints > (max?.totalPoints || 0) ? r : max,
  null
);
```

## League Summary

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
  <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #fb923c;">
    <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Total Retirees</div>
    <div style="font-size: 32px; font-weight: bold; color: #fb923c;">${totalRetirees}</div>
  </div>
  <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid var(--theme-accent);">
    <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Total Points Scored</div>
    <div style="font-size: 32px; font-weight: bold; color: var(--theme-accent);">${totalPointsAllRetirees.toFixed(0)}</div>
  </div>
  <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #8b5cf6;">
    <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Avg Points/Player</div>
    <div style="font-size: 32px; font-weight: bold; color: #8b5cf6;">${avgPointsPerRetiree.toFixed(1)}</div>
  </div>
  ${mostImpactfulRetiree ? html`
    <div style="padding: 20px; background: var(--theme-background-alt); border-radius: 8px; border-left: 4px solid #f59e0b;">
      <div style="font-size: 14px; color: var(--theme-foreground-alt); margin-bottom: 5px;">Most Impactful</div>
      <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">${getPlayerInfo(mostImpactfulRetiree.playerId).name}</div>
      <div style="font-size: 12px; color: var(--theme-foreground-muted); margin-top: 4px;">${mostImpactfulRetiree.totalPoints.toFixed(1)} pts</div>
    </div>
  ` : ''}
</div>

```js
// Process teams with their retirees, grouped by retirement year
const teamsWithRetirees = Array.from(retireesByTeam, ([rosterId, teamRetirees]) => {
  const user = getUserByRosterId(rosterId);
  const totalPoints = d3.sum(teamRetirees, d => d.totalPoints);
  const totalGames = d3.sum(teamRetirees, d => d.gamesPlayed);

  // Group retirees by their retirement year (last season)
  const retireeByCohort = d3.group(teamRetirees, d => d.lastWeek.season);

  // Create cohorts sorted by year (newest first)
  const cohorts = Array.from(retireeByCohort, ([season, cohortRetirees]) => {
    // Sort retirees within cohort by total points (most impactful first)
    const sortedRetirees = [...cohortRetirees].sort((a, b) => b.totalPoints - a.totalPoints);

    return {
      season,
      retirees: sortedRetirees,
      count: cohortRetirees.length,
      totalPoints: d3.sum(cohortRetirees, d => d.totalPoints),
      totalGames: d3.sum(cohortRetirees, d => d.gamesPlayed)
    };
  }).sort((a, b) => b.season.localeCompare(a.season)); // Sort cohorts by year (newest first)

  return {
    rosterId,
    teamName: user?.display_name || `Team ${rosterId}`,
    cohorts,
    count: teamRetirees.length,
    totalPoints,
    totalGames
  };
}).sort((a, b) => b.totalPoints - a.totalPoints); // Sort teams by total impact

console.log('Teams with retirees:', teamsWithRetirees.length);
console.log('Sample team:', teamsWithRetirees[0]);
```

## Team Ring of Honor

```js
if (teamsWithRetirees.length === 0) {
  display(html`
    <div style="padding: 40px; text-align: center; background: var(--theme-background-alt); border-radius: 8px; margin: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 10px;">🏆</div>
      <h3 style="margin: 0 0 10px 0;">No Retirees Yet</h3>
      <p style="color: var(--theme-foreground-alt); margin: 0;">As players move on from teams, they'll be honored here in the Ring of Honor.</p>
    </div>
  `);
} else {
  teamsWithRetirees.forEach((team, index) => {
    const teamContent = html`
      <div style="margin-bottom: 30px;">
        <!-- Team Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid rgba(251, 146, 60, 0.3);">
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #fb923c; margin-bottom: 5px;">
              ${team.teamName}
            </div>
            <div style="font-size: 14px; color: var(--theme-foreground-alt);">
              ${team.count} ${team.count === 1 ? 'Player' : 'Players'} • ${team.totalPoints.toFixed(1)} Total Points • ${team.totalGames} Games Played
            </div>
          </div>
        </div>

        <!-- Cohorts -->
        ${team.cohorts.map(cohort => html`
          <div style="margin-bottom: 30px;">
            <!-- Cohort Header -->
            <div style="
              background: linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(251, 146, 60, 0.05) 100%);
              border-left: 4px solid #fb923c;
              padding: 12px 20px;
              margin-bottom: 15px;
              border-radius: 8px;
            ">
              <div style="font-size: 18px; font-weight: bold; color: #fb923c; margin-bottom: 4px;">
                ${cohort.season} Retiree Class
              </div>
              <div style="font-size: 13px; color: var(--theme-foreground-alt);">
                ${cohort.count} ${cohort.count === 1 ? 'Player' : 'Players'} • ${cohort.totalPoints.toFixed(1)} pts • ${cohort.totalGames} games
              </div>
            </div>

            <!-- Retirees Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 15px;">
              ${cohort.retirees.map((retiree, idx) => {
            const playerInfo = getPlayerInfo(retiree.playerId);
            const avgPoints = retiree.gamesPlayed > 0 ? retiree.totalPoints / retiree.gamesPlayed : 0;
            const isTopPlayer = idx < 3; // Highlight top 3 players

            return html`
              <div style="
                background: var(--theme-background-alt);
                padding: 15px;
                border-radius: 8px;
                border-left: 3px solid ${isTopPlayer ? '#fb923c' : 'rgba(255, 255, 255, 0.1)'};
                ${isTopPlayer ? 'box-shadow: 0 2px 8px rgba(251, 146, 60, 0.2);' : ''}
              ">
                <!-- Player Header -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                  <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: bold; color: var(--theme-foreground); margin-bottom: 3px;">
                      ${isTopPlayer ? '⭐ ' : ''}${playerInfo.name}
                    </div>
                    <div style="font-size: 12px; color: var(--theme-foreground-alt);">
                      ${playerInfo.position} • ${playerInfo.team}
                    </div>
                  </div>
                  ${isTopPlayer ? html`
                    <div style="
                      background: rgba(251, 146, 60, 0.2);
                      color: #fb923c;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 10px;
                      font-weight: 600;
                      text-transform: uppercase;
                    ">
                      Top ${idx + 1}
                    </div>
                  ` : ''}
                </div>

                <!-- Stats Grid -->
                <div style="
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 10px;
                  padding: 10px;
                  background: rgba(0, 0, 0, 0.2);
                  border-radius: 6px;
                  margin-bottom: 10px;
                ">
                  <div>
                    <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-bottom: 2px;">Total Points</div>
                    <div style="font-size: 18px; font-weight: bold; color: var(--theme-accent);">${retiree.totalPoints.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-bottom: 2px;">Games</div>
                    <div style="font-size: 18px; font-weight: bold; color: var(--theme-foreground);">${retiree.gamesPlayed}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-bottom: 2px;">Avg/Game</div>
                    <div style="font-size: 18px; font-weight: bold; color: #8b5cf6;">${avgPoints.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: var(--theme-foreground-muted); margin-bottom: 2px;">Best Week</div>
                    <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">
                      ${retiree.weeks.length > 0 ? Math.max(...retiree.weeks.map(w => w.points)).toFixed(1) : '0.0'}
                    </div>
                  </div>
                </div>

                <!-- Tenure -->
                <div style="font-size: 11px; color: var(--theme-foreground-muted); text-align: center;">
                  ${retiree.firstWeek && retiree.lastWeek ? html`
                    Tenure: ${retiree.firstWeek.season} W${retiree.firstWeek.week} - ${retiree.lastWeek.season} W${retiree.lastWeek.week}
                  ` : 'Tenure: Unknown'}
                </div>
              </div>
            `;
              })}
            </div>
          </div>
        `)}
      </div>
    `;

    display(html`<details open class="section-collapse">
      <summary class="section-summary">${team.teamName}'s Ring of Honor (${team.count} ${team.count === 1 ? 'Player' : 'Players'})</summary>
      <div class="section-content">
        ${teamContent}
      </div>
    </details>`);
  });
}
```

---

<div style="margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(251, 146, 60, 0.05) 100%); border: 1px solid rgba(251, 146, 60, 0.2); border-radius: 1rem;">
  <h3 style="margin-top: 0; color: #fb923c;">🏆 About the Ring of Honor</h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Who Gets Honored?</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Players who contributed to your team but are no longer on any roster in the league
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Impact Measurement</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Total fantasy points scored while on your team, not league-wide career stats
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Top Players</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Top 3 most impactful players for each team are highlighted with ⭐ and special styling
      </div>
    </div>
    <div>
      <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">Legacy Building</div>
      <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6;">
        Track which teams have built the strongest alumni networks over the years
      </div>
    </div>
  </div>
</div>
