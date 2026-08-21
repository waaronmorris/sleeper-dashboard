<style>
  /* Page-local: persona summary and matchup card extras the design system has no class for. */
  .summary-card { border-top: 2px solid var(--brass); }
  .summary-card__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-3); }
  .summary-card__body { white-space: pre-wrap; line-height: 1.7; color: var(--ink-2); }
  .matchup-team .prob { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-3); margin-top: var(--space-1); }
  .matchup-card__foot { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1) var(--space-4); margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--hair); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-3); }
  .matchup-divider { text-align: center; }
  .matchup-divider .badge { display: block; margin-top: var(--space-2); }
</style>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {T, plotTheme} from "./components/theme.js";
import {mountSeasonPicker} from "./components/season.js";

// Load data — every season in the league chain
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```

```js
const S = seasonsData.by_season[season];
const league = S.league;
const rosters = S.rosters;
const users = S.users;
const matchups = S.matchups;
```

```js
// Helper function to get team name
function getTeamName(rosterId) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return `Team ${rosterId}`;
  const user = users.find(u => u.user_id === roster.owner_id);
  return user?.display_name || `Team ${rosterId}`;
}

// Process matchup data
const processedMatchups = matchups.flatMap(weekData => {
  const { week, matchups: weekMatchups } = weekData;

  // Group by matchup_id
  const grouped = d3.group(weekMatchups, d => d.matchup_id);

  return Array.from(grouped.values()).map(matchup => {
    if (matchup.length !== 2) return null; // Skip if not a proper matchup

    const [team1, team2] = matchup;
    const team1Score = team1.points || 0;
    const team2Score = team2.points || 0;

    return {
      week,
      team1: getTeamName(team1.roster_id),
      team2: getTeamName(team2.roster_id),
      team1_id: team1.roster_id,
      team2_id: team2.roster_id,
      team1_score: team1Score,
      team2_score: team2Score,
      winner: team1Score > team2Score ? getTeamName(team1.roster_id) :
              team2Score > team1Score ? getTeamName(team2.roster_id) : 'Tie',
      margin: Math.abs(team1Score - team2Score),
      total_points: team1Score + team2Score,
      is_close: Math.abs(team1Score - team2Score) < 10
    };
  }).filter(m => m !== null);
});

const gamesPlayed = processedMatchups.filter(m => m.total_points > 0).length;
```

```js
display(html`
  <header class="page-head">
    <p class="eyebrow">${season} season · ${S.is_current ? S.status.replace(/_/g, " ") : "final"}</p>
    <h1>Who won, and by how <em>much</em>?</h1>
    <p class="lede">Weekly matchups, win odds from season scoring, and where the close games and blowouts landed.</p>
    <p class="meta">${matchups.length} weeks scheduled · ${gamesPlayed} games played</p>
  </header>
`);
```

```js
const weekInput = Inputs.select(
  matchups.map(m => m.week),
  {
    label: "Week",
    value: matchups[matchups.length - 1]?.week || 1
  }
);
const selectedWeek = Generators.input(weekInput);
```

```js
// Week selector sits directly under the page head
display(html`<div class="row">${weekInput}</div>`);
```

```js
// AI-generated week summaries only exist for the season in progress
const LEAGUE_ID = league.league_id;
let allSummaries = [];
if (S.is_current) {
  try {
    allSummaries = await FileAttachment("data/week-summaries.json").json();
  } catch (e) {
    // Summaries don't exist yet - that's okay
    console.warn("No weekly summaries found");
  }
}

// Get summary for selected week
const weeklySummary = allSummaries.find(s => s.week === selectedWeek && s.leagueId === LEAGUE_ID);

// Persona taglines for the commentators (color is the single brass accent)
const personaStyles = {
  "Pat McAfee": { badge: "The Pat McAfee Show" },
  "Lee Corso": { badge: "Not so fast" },
  "Stuart Scott": { badge: "Boo-yah" },
  "Scott Van Pelt": { badge: "SVP at the buzzer" },
  "Rich Eisen": { badge: "The Rich Eisen Show" },
  "Dan Patrick": { badge: "En fuego" }
};

// Get the style for the current persona
const personaStyle = weeklySummary ? (personaStyles[weeklySummary.persona] || personaStyles["Scott Van Pelt"]) : null;
```

## Weekly results

```js
const currentWeekMatchups = processedMatchups.filter(m => m.week === selectedWeek);

// Calculate win probabilities based on season performance
function calculateWinProbability(team1Id, team2Id) {
  const team1Roster = rosters.find(r => r.roster_id === team1Id);
  const team2Roster = rosters.find(r => r.roster_id === team2Id);

  if (!team1Roster || !team2Roster) return { team1Prob: 50, team2Prob: 50 };

  // Calculate average points per game
  const team1Avg = team1Roster.settings.fpts / (team1Roster.settings.wins + team1Roster.settings.losses);
  const team2Avg = team2Roster.settings.fpts / (team2Roster.settings.wins + team2Roster.settings.losses);

  // Simple win probability based on point differential
  const diff = team1Avg - team2Avg;
  const team1Prob = 50 + (diff * 2); // Roughly 2% per point differential

  return {
    team1Prob: Math.max(10, Math.min(90, team1Prob)),
    team2Prob: Math.max(10, Math.min(90, 100 - team1Prob))
  };
}

const matchupsWithProbs = currentWeekMatchups.map(m => {
  const probs = calculateWinProbability(m.team1_id, m.team2_id);
  return { ...m, ...probs };
});

const fmtProb = p => Number.isFinite(p) ? `${p.toFixed(1)}%` : "—";
const weekHasScores = matchupsWithProbs.some(m => m.total_points > 0);

if (!weekHasScores) {
  display(html`<div class="note">Scores for week ${selectedWeek} are not in yet. Results and win odds appear once Sleeper posts finals.</div>`);
} else {
  display(html`
    <div class="stack">
      ${matchupsWithProbs.map(matchup => {
        const team1Win = matchup.team1_score > matchup.team2_score;
        const team2Win = matchup.team2_score > matchup.team1_score;

        return html`
          <div class="matchup-card">
            <div class="matchup-grid">
              <div class="matchup-team away ${team1Win ? "winner" : ""}">
                <div class="name">${matchup.team1}</div>
                <div class="score">${matchup.team1_score.toFixed(2)}</div>
                <div class="prob">Win odds ${fmtProb(matchup.team1Prob)}</div>
              </div>

              <div class="matchup-divider">
                vs
                ${matchup.is_close && matchup.total_points > 0 ? html`<span class="badge badge--brass">Close game</span>` : ''}
              </div>

              <div class="matchup-team ${team2Win ? "winner" : ""}">
                <div class="name">${matchup.team2}</div>
                <div class="score">${matchup.team2_score.toFixed(2)}</div>
                <div class="prob">Win odds ${fmtProb(matchup.team2Prob)}</div>
              </div>
            </div>

            ${matchup.winner !== 'Tie' ? html`
              <div class="matchup-card__foot">
                <span><span class="muted">Winner</span> <span class="brass">${matchup.winner}</span></span>
                <span><span class="muted">Margin</span> <span class="num">${matchup.margin.toFixed(2)}</span></span>
              </div>
            ` : ''}
          </div>
        `;
      })}
    </div>
  `);
}
```

```js
// Generated commentary for the selected week (current season only)
const weeklySummaryNode = (() => {
  if (!(weeklySummary && personaStyle)) return "";
  return html`<details open class="section-collapse">
    <summary class="section-summary">${weeklySummary.persona} on week ${weeklySummary.week} <small>generated commentary</small></summary>
    <div class="section-content">
      <div class="card summary-card">
        <div class="summary-card__head">
          <p class="eyebrow mb-0">${personaStyle.badge}</p>
          <span class="badge badge--slate">Generated</span>
        </div>
        <div class="summary-card__body">${weeklySummary.summary}</div>
      </div>
    </div>
  </details>`;
})();
display(html`<div>${weeklySummaryNode}</div>`);
```

## Score distribution by week

```js
if (gamesPlayed === 0) {
  display(html`<div class="note">No games played yet. The distribution fills in after week 1 finals.</div>`);
} else {
  display(html`
    <figure class="chart">
      <p class="chart__sub">Each box is one week: the median and quartiles of every team's score, whiskers for the range.</p>
      ${Plot.plot(plotTheme({
        width: Math.min(width, 800),
        marginBottom: 60,
        height: 400,
        x: {
          label: "Week",
          tickFormat: d => `Wk ${d}`
        },
        y: {
          label: "Points"
        },
        marks: [
          Plot.boxY(
            processedMatchups.flatMap(m => [
              { week: m.week, points: m.team1_score },
              { week: m.week, points: m.team2_score }
            ]),
            {
              x: "week",
              y: "points",
              fill: T.brass,
              stroke: T.ink2
            }
          )
        ]
      }))}
    </figure>
  `);
}
```

## Margin of victory

```js
const marginBuckets = [
  { range: "0-5", min: 0, max: 5 },
  { range: "5-10", min: 5, max: 10 },
  { range: "10-20", min: 10, max: 20 },
  { range: "20-30", min: 20, max: 30 },
  { range: "30+", min: 30, max: 1000 }
];

const marginData = marginBuckets.map(bucket => ({
  range: bucket.range,
  count: processedMatchups.filter(m => m.total_points > 0 && m.margin >= bucket.min && m.margin < bucket.max).length
}));

if (gamesPlayed === 0) {
  display(html`<div class="note">No games played yet. Margins appear after week 1 finals.</div>`);
} else {
  display(html`
    <figure class="chart">
      <p class="chart__sub">How many games fell in each margin band. Under 5 points is a coin flip (brass); 30 or more is a blowout.</p>
      ${Plot.plot(plotTheme({
        width: Math.min(width, 800),
        marginLeft: width < 640 ? 40 : 60,
        height: 250,
        x: {
          label: "Margin (points)",
          domain: marginBuckets.map(b => b.range)
        },
        y: {
          label: "Games",
          domain: [0, Math.max(1, d3.max(marginData, d => d.count))]
        },
        marks: [
          Plot.barY(marginData, {
            x: "range",
            y: "count",
            fill: d => d.range === "0-5" ? T.brass : T.ink4
          }),
          Plot.text(marginData, {
            x: "range",
            y: "count",
            text: d => d.count,
            dy: -10,
            fill: T.ink2
          })
        ]
      }))}
    </figure>
  `);
}
```

## Closest games

```js
const playedMatchups = processedMatchups.filter(m => m.total_points > 0);

const closestGames = playedMatchups
  .slice()
  .sort((a, b) => a.margin - b.margin)
  .slice(0, 10);

if (gamesPlayed === 0) {
  display(html`<div class="note">No games played yet. Close games appear after week 1 finals.</div>`);
} else {
  display(html`<p class="muted text-sm">The season's ten tightest finishes, ranked by margin.</p>`);
  display(Inputs.table(closestGames, {
    columns: ["week", "team1", "team1_score", "team2", "team2_score", "margin"],
    header: {
      week: "Week",
      team1: "Team 1",
      team1_score: "Score 1",
      team2: "Team 2",
      team2_score: "Score 2",
      margin: "Margin"
    },
    format: {
      team1_score: x => x.toFixed(2),
      team2_score: x => x.toFixed(2),
      margin: x => x.toFixed(2)
    }
  }));
}
```

## Highest-scoring games

```js
const highestScoring = playedMatchups
  .slice()
  .sort((a, b) => b.total_points - a.total_points)
  .slice(0, 10);

if (gamesPlayed === 0) {
  display(html`<div class="note">No games played yet. High-scoring games appear after week 1 finals.</div>`);
} else {
  display(html`<p class="muted text-sm">The ten games with the most combined points.</p>`);
  display(Inputs.table(highestScoring, {
    columns: ["week", "team1", "team1_score", "team2", "team2_score", "total_points"],
    header: {
      week: "Week",
      team1: "Team 1",
      team1_score: "Score 1",
      team2: "Team 2",
      team2_score: "Score 2",
      total_points: "Total"
    },
    format: {
      team1_score: x => x.toFixed(2),
      team2_score: x => x.toFixed(2),
      total_points: x => x.toFixed(2)
    }
  }));
}
```

## Head-to-head records

```js
// Calculate head-to-head records
const h2hRecords = new Map();

processedMatchups.forEach(m => {
  const key1 = `${m.team1} vs ${m.team2}`;
  const key2 = `${m.team2} vs ${m.team1}`;

  if (!h2hRecords.has(key1) && !h2hRecords.has(key2)) {
    h2hRecords.set(key1, {
      matchup: key1,
      team1: m.team1,
      team2: m.team2,
      team1_wins: 0,
      team2_wins: 0,
      games: 0
    });
  }

  const record = h2hRecords.get(key1) || h2hRecords.get(key2);
  record.games++;

  if (m.team1_score > m.team2_score) {
    if (record.team1 === m.team1) record.team1_wins++;
    else record.team2_wins++;
  } else if (m.team2_score > m.team1_score) {
    if (record.team2 === m.team2) record.team2_wins++;
    else record.team1_wins++;
  }
});

const h2hData = Array.from(h2hRecords.values())
  .filter(r => r.games > 1)
  .sort((a, b) => b.games - a.games);

if (gamesPlayed === 0) {
  display(html`<div class="note">No games played yet. Head-to-head records appear once two teams have met more than once.</div>`);
} else if (h2hData.length === 0) {
  display(html`<div class="note">No pair of teams has met more than once yet this season.</div>`);
} else {
  display(html`<p class="muted text-sm">Pairs that have met more than once this season.</p>`);
  display(Inputs.table(h2hData, {
    columns: ["matchup", "team1_wins", "team2_wins", "games"],
    header: {
      matchup: "Matchup",
      team1_wins: "Team 1 wins",
      team2_wins: "Team 2 wins",
      games: "Games"
    }
  }));
}
```

<section class="insights">
  <h3>Reading this page</h3>
  <ul>
    <li><strong>Win odds</strong> come from season-long points per game, roughly 2% per point of difference, capped between 10% and 90%.</li>
    <li><strong>Close games</strong> are decided by fewer than 10 points; a lot of them means the league is tightly matched.</li>
    <li><strong>Score distribution</strong> boxes show each week's median, quartiles, and outliers.</li>
    <li><strong>Head-to-head</strong> records only appear once two teams have met more than once.</li>
    <li><strong>Generated commentary</strong> is written for the season in progress only; past seasons show results alone.</li>
  </ul>
</section>
