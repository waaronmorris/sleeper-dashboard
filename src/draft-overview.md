```js
import * as Plot from "npm:@observablehq/plot";
import {T, plotTheme} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
const draftData = await FileAttachment("data/draft-picks.json").json();
const players = await FileAttachment("data/players.json").json();
const matchupsAllYears = await FileAttachment("data/matchups-all-years.json").json();

// Debug: Log data loaded
console.log('Draft data seasons:', Object.keys(draftData));
console.log('Historical matchups years:', Object.keys(matchupsAllYears));
```

```js
// Team names, rosters and users follow the season chosen in the header picker
const S = seasonsData.by_season[season];
const rosters = S.rosters;
const users = S.users;
```

```js
// Helper function to get user by roster ID (names from the chosen season)
function getUserByRosterId(rosterId, seasonData) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (roster) {
    return users.find(u => u.user_id === roster.owner_id);
  }
  return null;
}

// Helper function to get player name
function getPlayerName(playerId) {
  const player = players[playerId];
  if (!player) return playerId;
  return `${player.first_name} ${player.last_name}`;
}

// Calculate retention for a specific draft across weeks
function calculateDraftRetention(season, draftPicks, yearMatchups) {
  const retentionByWeek = [];

  if (!yearMatchups || !yearMatchups.matchups) return retentionByWeek;

  // For each week in the season
  yearMatchups.matchups.forEach(weekData => {
    const weekRetention = {
      week: weekData.week,
      teamRetention: {}
    };

    // Group draft picks by roster
    const picksByRoster = {};
    draftPicks.forEach(pick => {
      if (!picksByRoster[pick.roster_id]) {
        picksByRoster[pick.roster_id] = [];
      }
      picksByRoster[pick.roster_id].push(pick.player_id);
    });

    // For each team, count how many drafted players are on roster this week
    Object.entries(picksByRoster).forEach(([rosterId, draftedPlayers]) => {
      const matchup = weekData.matchups.find(m => m.roster_id === parseInt(rosterId));
      if (matchup && matchup.players_points) {
        const draftedOnRoster = draftedPlayers.filter(
          playerId => matchup.players_points[playerId] !== undefined
        ).length;

        weekRetention.teamRetention[rosterId] = {
          count: draftedOnRoster,
          total: draftedPlayers.length,
          percentage: (draftedOnRoster / draftedPlayers.length) * 100
        };
      }
    });

    retentionByWeek.push(weekRetention);
  });

  return retentionByWeek;
}

// Calculate end-of-season retention for each season
const seasonRetentionData = [];
const availableSeasons = Object.keys(draftData).sort((a, b) => b.localeCompare(a));

availableSeasons.forEach(season => {
  const seasonDraft = draftData[season];
  const yearMatchups = matchupsAllYears[season];

  if (!seasonDraft || !seasonDraft.picks || !yearMatchups) return;

  const retentionByWeek = calculateDraftRetention(season, seasonDraft.picks, yearMatchups);

  // Get final week retention
  if (retentionByWeek.length > 0) {
    const finalWeek = retentionByWeek[retentionByWeek.length - 1];

    // Calculate league-wide retention for this season
    let totalDrafted = 0;
    let totalRetained = 0;

    Object.values(finalWeek.teamRetention).forEach(teamData => {
      totalDrafted += teamData.total;
      totalRetained += teamData.count;
    });

    seasonRetentionData.push({
      season: season,
      totalDrafted: totalDrafted,
      totalRetained: totalRetained,
      retentionRate: (totalRetained / totalDrafted) * 100,
      weeks: retentionByWeek.length,
      teamCount: Object.keys(finalWeek.teamRetention).length
    });
  }
});

// Seasons with a measurable retention rate (a draft and at least one week of lineups)
const measuredSeasons = seasonRetentionData.filter(s => s.totalDrafted > 0 && Number.isFinite(s.retentionRate));
const latestSeason = availableSeasons[0];

console.log('Season retention data:', seasonRetentionData);
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? (S.status || "").replace(/_/g, " ") : "final"} · ${availableSeasons.length} draft${availableSeasons.length === 1 ? "" : "s"} on record</p>
    <h1>Who keeps the players they <em>drafted</em>?</h1>
    <p class="lede">End-of-season retention for every draft on record, league-wide and team by team.</p>
    <p class="meta">Retention = drafted players still on the roster in the final week of lineups</p>
  </header>
`);
```

```js
// Page control: scope the comparison table and team-by-team rows to one draft, or show all.
// Defaults to the header picker's season when that draft exists; "All seasons" on the current season.
const seasonOptions = new Map([["All seasons", "all"], ...availableSeasons.map(s => [s, s])]);
const seasonDefault = season !== seasonsData.current && availableSeasons.includes(season) ? season : "all";
const seasonFilter = view(Inputs.select(seasonOptions, {label: "Draft", value: seasonDefault}));
```

```js
const seasonLabel = seasonFilter === "all" ? "All seasons" : `${seasonFilter} draft`;
```

## Retention by season

```js
if (measuredSeasons.length === 0) {
  display(html`<aside class="note"><b>No season retention yet.</b> Retention needs at least one week of lineups after a draft; the first point appears after week 1 finals.</aside>`);
} else display(html`<figure class="chart">
  <div class="chart__title">End-of-season retention, league-wide</div>
  <p class="chart__sub">Higher retention means teams stuck with their draft; lower retention means the waiver wire did more of the work.</p>
  ${Plot.plot(plotTheme({
  height: 360,
  width: Math.min(width, 800),
  marginLeft: width < 640 ? 40 : 56,
  x: {
    label: "Season",
    type: "point"
  },
  y: {
    label: "End-of-season retention (%)",
    domain: [0, 100]
  },
  marks: [
    Plot.ruleY([0], {stroke: T.hair2}),
    Plot.line(measuredSeasons, {
      x: "season",
      y: "retentionRate",
      stroke: T.brass,
      strokeWidth: 2,
      curve: "catmull-rom"
    }),
    Plot.dot(measuredSeasons, {
      x: "season",
      y: "retentionRate",
      fill: T.ground2,
      stroke: T.brass,
      strokeWidth: 1.5,
      r: 4
    }),
    Plot.text(measuredSeasons, {
      x: "season",
      y: "retentionRate",
      text: d => `${d.retentionRate.toFixed(1)}%`,
      dy: -14,
      fill: T.ink2,
      fontSize: 11
    })
  ]
}))}
</figure>`);
```

## Season comparison <span class="section-meta">${seasonLabel}</span>

```js
// Create detailed table data
const seasonComparisonData = seasonRetentionData.filter(s => seasonFilter === "all" || s.season === seasonFilter).map(s => ({
  Season: s.season,
  "Total Drafted": s.totalDrafted,
  "Still on Rosters": s.totalRetained,
  "Retention Rate": `${s.retentionRate.toFixed(1)}%`,
  "Weeks Played": s.weeks,
  "Teams": s.teamCount
}));

if (seasonComparisonData.length === 0) {
  display(html`<aside class="note"><b>No seasons to compare${seasonFilter === "all" ? " yet" : ` for ${seasonFilter}`}.</b> Rows appear once a drafted season has at least one week of lineups.</aside>`);
} else display(html`
  <div class="table-wrap">
    ${Inputs.table(seasonComparisonData, {
      width: {
        Season: 100,
        "Total Drafted": 120,
        "Still on Rosters": 140,
        "Retention Rate": 120,
        "Weeks Played": 120,
        "Teams": 80
      }
    })}
  </div>
`);
```

## All-time retention by team

```js
// Calculate all-time retention for each team across all seasons
const allTimeTeamRetention = {};

availableSeasons.forEach(season => {
  const seasonDraft = draftData[season];
  const yearMatchups = matchupsAllYears[season];

  if (!seasonDraft || !seasonDraft.picks || !yearMatchups) return;

  const retentionByWeek = calculateDraftRetention(season, seasonDraft.picks, yearMatchups);

  if (retentionByWeek.length > 0) {
    const finalWeek = retentionByWeek[retentionByWeek.length - 1];

    // For each team in this season
    Object.entries(finalWeek.teamRetention).forEach(([rosterId, teamData]) => {
      const user = getUserByRosterId(parseInt(rosterId));
      const teamName = user?.display_name || `Team ${rosterId}`;

      if (!allTimeTeamRetention[teamName]) {
        allTimeTeamRetention[teamName] = {
          teamName: teamName,
          totalDrafted: 0,
          totalRetained: 0,
          seasons: []
        };
      }

      allTimeTeamRetention[teamName].totalDrafted += teamData.total;
      allTimeTeamRetention[teamName].totalRetained += teamData.count;
      allTimeTeamRetention[teamName].seasons.push({
        season: season,
        drafted: teamData.total,
        retained: teamData.count,
        rate: teamData.percentage
      });
    });
  }
});

// Convert to array and calculate averages
const allTimeTeamStats = Object.values(allTimeTeamRetention).map(team => ({
  ...team,
  retentionRate: (team.totalRetained / team.totalDrafted) * 100,
  avgPerSeason: team.totalDrafted / team.seasons.length,
  seasonsPlayed: team.seasons.length
})).sort((a, b) => b.retentionRate - a.retentionRate);

console.log('All-time team retention:', allTimeTeamStats);
```

```js
if (allTimeTeamStats.length === 0) {
  display(html`<aside class="note"><b>No team retention yet.</b> Teams appear here once a drafted season has at least one week of lineups.</aside>`);
} else {
  const nTeams = allTimeTeamStats.length;
  const rankFill = (d, i) => i < 3 ? T.brass : i >= nTeams - 3 ? T.down : T.ink4;
  const narrow = width < 640;
  const retentionLabel = d => narrow ? `${d.retentionRate.toFixed(1)}%` : `${d.retentionRate.toFixed(1)}% · ${d.totalRetained}/${d.totalDrafted} · ${d.seasonsPlayed} season${d.seasonsPlayed === 1 ? "" : "s"}`;
  display(html`<figure class="chart">
    <div class="chart__title">All-time retention by team</div>
    <p class="chart__sub">Every draft a team has made, pooled across seasons. Top three in brass, bottom three in ember.</p>
    ${Plot.plot(plotTheme({
    height: nTeams * 36 + 60,
    width: Math.min(width, 800),
    marginLeft: narrow ? 90 : 150,
    marginRight: narrow ? 60 : 180,
    x: {
      label: "All-time retention (%)",
      grid: true,
      domain: [0, 100]
    },
    y: {
      label: null
    },
    marks: [
      Plot.barX(allTimeTeamStats, {
        x: "retentionRate",
        y: "teamName",
        fill: rankFill,
        sort: { y: "-x" }
      }),
      Plot.text(allTimeTeamStats.filter(d => d.retentionRate > 55), {
        x: "retentionRate",
        y: "teamName",
        text: retentionLabel,
        dx: -6,
        textAnchor: "end",
        fill: T.ground,
        fontSize: 11
      }),
      Plot.text(allTimeTeamStats.filter(d => d.retentionRate <= 55), {
        x: "retentionRate",
        y: "teamName",
        text: retentionLabel,
        dx: 6,
        textAnchor: "start",
        fill: T.ink,
        fontSize: 11
      }),
      Plot.ruleX([0], {stroke: T.hair2})
    ]
  }))}
  </figure>`);
}
```

<aside class="note">
  <b>Reading retention rates.</b> Above 70% is a team that drafts and holds; 50–69% mixes picks with waiver adds and trades; below 50% is a roster rebuilt in season. Neither end is better on its own — results decide.
</aside>

## Team by team <span class="section-meta">${seasonLabel}</span>

<style>
  .team-breakdown { display: grid; gap: var(--space-3); }
  .team-breakdown .card__title { display: flex; align-items: center; gap: var(--space-2); }
  .team-breakdown .card__title .rank { flex: none; }
  .team-breakdown .card__foot { margin-top: var(--space-2); }
</style>

<p class="muted text-sm">Each team's drafts, how many picks survived, and the rate. Ranked by all-time retention.</p>

```js
// Create detailed breakdown for each team
const teamSeasonBreakdown = allTimeTeamStats.map((team, i) => {
  const seasonDetails = team.seasons.filter(s => seasonFilter === "all" || s.season === seasonFilter).map(s => ({
    Season: s.season,
    Drafted: s.drafted,
    Retained: s.retained,
    "Retention Rate": `${s.rate.toFixed(1)}%`
  }));
  const rankClass = i < 3 ? "rank rank--top" : i >= allTimeTeamStats.length - 3 ? "rank rank--bottom" : "rank";

  return html`
    <div class="card card--tight">
      <div class="card__title"><span class="${rankClass}">${i + 1}</span> ${team.teamName}</div>
      <div class="card__k">${team.retentionRate.toFixed(1)}% all-time · ${team.totalRetained}/${team.totalDrafted} retained · ${team.seasonsPlayed} season${team.seasonsPlayed === 1 ? "" : "s"}</div>
      ${seasonDetails.length === 0
        ? html`<p class="card__foot muted text-sm">No ${seasonFilter} draft on record for this team.</p>`
        : html`<div class="table-wrap">
          ${Inputs.table(seasonDetails, {
            width: {
              Season: 100,
              Drafted: 100,
              Retained: 100,
              "Retention Rate": 150
            }
          })}
        </div>`}
    </div>
  `;
});

if (teamSeasonBreakdown.length === 0) {
  display(html`<aside class="note"><b>No team breakdowns yet.</b> Each team's seasons appear once a drafted season has at least one week of lineups.</aside>`);
} else display(html`<div class="team-breakdown">${teamSeasonBreakdown}</div>`);
```

## What stands out

```js
// Calculate interesting insights
const hasInsights = measuredSeasons.length > 0 && allTimeTeamStats.length > 0;
const avgRetention = hasInsights ? measuredSeasons.reduce((sum, s) => sum + s.retentionRate, 0) / measuredSeasons.length : 0;
const highestRetentionSeason = hasInsights ? measuredSeasons.reduce((max, s) => s.retentionRate > max.retentionRate ? s : max) : null;
const lowestRetentionSeason = hasInsights ? measuredSeasons.reduce((min, s) => s.retentionRate < min.retentionRate ? s : min) : null;
const topTeam = allTimeTeamStats[0];
const bottomTeam = allTimeTeamStats[allTimeTeamStats.length - 1];

if (!hasInsights) {
  display(html`<aside class="note"><b>Nothing to summarize yet.</b> League average, best and worst seasons, and the most and least loyal teams appear after the first week of lineups.</aside>`);
} else display(html`
  <div class="stat-grid">
    <div class="stat stat--hero"><div class="stat__k">League average</div><div class="stat__v">${avgRetention.toFixed(1)}<small>%</small></div><div class="stat__l">across ${measuredSeasons.length} season${measuredSeasons.length === 1 ? "" : "s"}</div></div>
    <div class="stat stat--up"><div class="stat__k">Highest season</div><div class="stat__v">${highestRetentionSeason.season}</div><div class="stat__l">${highestRetentionSeason.retentionRate.toFixed(1)}% retained</div></div>
    <div class="stat stat--down"><div class="stat__k">Lowest season</div><div class="stat__v">${lowestRetentionSeason.season}</div><div class="stat__l">${lowestRetentionSeason.retentionRate.toFixed(1)}% retained</div></div>
    <div class="stat stat--brass"><div class="stat__k">Most loyal to the draft</div><div class="stat__v stat--text">${topTeam.teamName}</div><div class="stat__l">${topTeam.retentionRate.toFixed(1)}% retained</div></div>
    <div class="stat stat--slate"><div class="stat__k">Most active on waivers</div><div class="stat__v stat--text">${bottomTeam.teamName}</div><div class="stat__l">${bottomTeam.retentionRate.toFixed(1)}% retained</div></div>
  </div>
  <aside class="note note--brass">
    <b>Read.</b> ${
      avgRetention > 60
        ? "The league shows strong draft loyalty; teams generally trust their picks through the season."
        : avgRetention > 50
        ? "The league balances draft picks with waiver activity, with moderate roster turnover."
        : "The league is highly active on waivers; rosters are rebuilt well beyond the initial draft."
    }
  </aside>
`);
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Season control.</strong> The Draft select scopes the comparison table and each team's rows to one draft; it follows the header season picker and shows all seasons when that picker is on the current season.</li>
    <li><strong>Definition.</strong> Drafted players still on the roster in the final week of lineups, divided by total picks made.</li>
    <li><strong>High (70%+).</strong> A sound draft, player loyalty, or conservative management.</li>
    <li><strong>Moderate (50–69%).</strong> Picks mixed with waiver adds and trades.</li>
    <li><strong>Low (under 50%).</strong> Aggressive waiver play, a weak draft, or active trading.</li>
    <li><strong>Neither is better.</strong> A champion at 30% found gold on waivers; a last-place team at 80% drafted poorly and never adapted. Winning, not loyalty, is the measure.</li>
    <li><strong>Trends.</strong> Rising retention suggests managers are drafting better; falling retention suggests a more active, competitive waiver market; flat retention is a league that has found its equilibrium.</li>
  </ul>
</section>
