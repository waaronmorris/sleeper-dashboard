<style>
  .cohort-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-5) 0 var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--hair); }
  .cohort-head h3 { margin: 0; }
  .player-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-3); }
  .player-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2) var(--space-3); }
</style>

```js
import * as d3 from "npm:d3";
import {mountSeasonPicker} from "./components/season.js";

// Load data. This page is all-time; the season picker is mounted so the reader's
// choice persists across the site, but nothing here depends on it.
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
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

// Position badge class
function posClass(pos) {
  const p = String(pos || "").toLowerCase();
  return ["qb", "rb", "wr", "te", "k", "def"].includes(p) ? `badge badge--pos-${p}` : "badge";
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

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">Alumni · ${totalRetirees} departed players</p>
    <h1>Who left a <em>mark</em> before moving on?</h1>
    <p class="lede">Players who scored for a team in this league and are no longer on any roster, ranked by what they produced while they were here.</p>
  </header>
`);
```

## League summary

```js
display(html`
  <div class="stat-grid">
    <div class="stat"><div class="stat__k">Retirees</div><div class="stat__v">${totalRetirees}</div></div>
    <div class="stat"><div class="stat__k">Points scored</div><div class="stat__v">${totalPointsAllRetirees.toLocaleString(undefined, {maximumFractionDigits: 0})}</div></div>
    <div class="stat"><div class="stat__k">Avg per player</div><div class="stat__v">${avgPointsPerRetiree.toFixed(1)}</div></div>
    ${mostImpactfulRetiree ? html`
      <div class="stat"><div class="stat__k">Most points</div><div class="stat__v stat--text">${getPlayerInfo(mostImpactfulRetiree.playerId).name}</div><div class="stat__l">${mostImpactfulRetiree.totalPoints.toFixed(1)} pts</div></div>
    ` : ''}
  </div>
`);
```

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

## Team ring of honor

```js
// Create team selector for better navigation
const teamNames = teamsWithRetirees.map(t => t.teamName);
```

```js
const selectedTeamName = view(Inputs.select(teamNames, {
  label: "Team",
  value: teamNames[0]
}));
```

```js
if (teamsWithRetirees.length === 0) {
  display(html`
    <aside class="note"><b>No retirees yet.</b> Players appear here once they have scored for a team and then left every roster in the league.</aside>
  `);
} else {
  // Show only the selected team
  const selectedTeamData = teamsWithRetirees.find(t => t.teamName === selectedTeamName);
  [selectedTeamData].forEach((team, index) => {
    const teamContent = html`
      <div class="stack">
        <!-- Team Header -->
        <div class="stat-grid">
          <div class="stat stat--brass"><div class="stat__k">Team</div><div class="stat__v stat--text">${team.teamName}</div></div>
          <div class="stat"><div class="stat__k">${team.count === 1 ? 'Player' : 'Players'}</div><div class="stat__v">${team.count}</div></div>
          <div class="stat"><div class="stat__k">Points</div><div class="stat__v">${team.totalPoints.toFixed(1)}</div></div>
          <div class="stat"><div class="stat__k">Games played</div><div class="stat__v">${team.totalGames}</div></div>
        </div>

        <!-- Cohorts -->
        ${team.cohorts.map(cohort => html`
          <div>
            <!-- Cohort Header -->
            <div class="cohort-head">
              <h3>${cohort.season} class</h3>
              <span class="mono text-xs muted">${cohort.count} ${cohort.count === 1 ? 'player' : 'players'} · ${cohort.totalPoints.toFixed(1)} pts · ${cohort.totalGames} games</span>
            </div>

            <!-- Retirees Grid -->
            <div class="grid grid-3">
              ${cohort.retirees.map((retiree, idx) => {
            const playerInfo = getPlayerInfo(retiree.playerId);
            const avgPoints = retiree.gamesPlayed > 0 ? retiree.totalPoints / retiree.gamesPlayed : 0;
            const isTopPlayer = idx < 3; // Highlight top 3 players

            return html`
              <div class="card card--tight ${isTopPlayer ? 'card--accent' : ''}">
                <!-- Player Header -->
                <div class="player-head">
                  <div>
                    <div class="card__title mb-0">${playerInfo.name}</div>
                    <div class="text-xs muted"><span class="${posClass(playerInfo.position)}">${playerInfo.position}</span> <span class="mono">${playerInfo.team}</span></div>
                  </div>
                  ${isTopPlayer ? html`<span class="rank rank--top">${idx + 1}</span>` : ''}
                </div>

                <!-- Stats Grid -->
                <div class="player-stats">
                  <div>
                    <div class="card__k">Points</div>
                    <div class="card__v ${isTopPlayer ? 'brass' : ''}">${retiree.totalPoints.toFixed(1)}</div>
                  </div>
                  <div>
                    <div class="card__k">Games</div>
                    <div class="card__v">${retiree.gamesPlayed}</div>
                  </div>
                  <div>
                    <div class="card__k">Per game</div>
                    <div class="card__v">${avgPoints.toFixed(1)}</div>
                  </div>
                  <div>
                    <div class="card__k">Best week</div>
                    <div class="card__v">
                      ${retiree.weeks.length > 0 ? Math.max(...retiree.weeks.map(w => w.points)).toFixed(1) : '0.0'}
                    </div>
                  </div>
                </div>

                <!-- Tenure -->
                <div class="card__foot mono text-xs">
                  ${retiree.firstWeek && retiree.lastWeek ? html`
                    ${retiree.firstWeek.season} W${retiree.firstWeek.week} – ${retiree.lastWeek.season} W${retiree.lastWeek.week}
                  ` : 'Tenure unknown'}
                </div>
              </div>
            `;
              })}
            </div>
          </div>
        `)}
      </div>
    `;

    // Display team content directly since we're using selector
    display(teamContent);
  });
}
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Who is listed.</strong> Players who scored for a team here and are no longer on any roster in the league.</li>
    <li><strong>What counts.</strong> Fantasy points scored while on that team, not league-wide career totals.</li>
    <li><strong>Top three.</strong> The three highest scorers in each class carry a brass rule and a rank mark.</li>
    <li><strong>Classes.</strong> Players are grouped by the season they last played for the team, newest first.</li>
  </ul>
</section>
