<div style="margin: 0 0 2rem 0;">
  <div style="display: inline-block; padding: 0.5rem 1.25rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 2rem; font-size: 0.875rem; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">
    Weekly Analysis
  </div>
  <h1 style="margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #f8fafc 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Matchup Analysis
  </h1>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0; max-width: 800px; line-height: 1.6;">
    Deep dive into weekly matchups, scoring trends, and head-to-head performance. Analyze win probabilities, identify close games, and track scoring patterns across the season.
  </p>
</div>

```js
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

// Load data
const league = await FileAttachment("data/league.json").json();
const rosters = await FileAttachment("data/rosters.json").json();
const users = await FileAttachment("data/users.json").json();
const matchups = await FileAttachment("data/matchups.json").json();
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
```

```js
const weekInput = Inputs.select(
  matchups.map(m => m.week),
  {
    label: "Select Week",
    value: matchups[matchups.length - 1]?.week || 1
  }
);
const selectedWeek = Generators.input(weekInput);
```

```js
// Load all AI-generated week summaries
const LEAGUE_ID = league.league_id;
let allSummaries = [];
try {
  allSummaries = await FileAttachment("data/week-summaries.json").json();
} catch (e) {
  // Summaries don't exist yet - that's okay
  console.warn("No weekly summaries found");
}

// Get summary for selected week
const weeklySummary = allSummaries.find(s => s.week === selectedWeek && s.leagueId === LEAGUE_ID);

// Define persona styles for the commentators
const personaStyles = {
  "Pat McAfee": {
    color: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)",
    emoji: "💥",
    badge: "THE PAT MCAFEE SHOW"
  },
  "Lee Corso": {
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
    emoji: "🏈",
    badge: "NOT SO FAST!"
  },
  "Stuart Scott": {
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
    emoji: "🎤",
    badge: "BOO-YAH!"
  },
  "Scott Van Pelt": {
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
    emoji: "🌙",
    badge: "SVP AT THE BUZZER"
  },
  "Rich Eisen": {
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
    emoji: "📺",
    badge: "THE RICH EISEN SHOW"
  },
  "Dan Patrick": {
    color: "#14b8a6",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
    emoji: "🎙️",
    badge: "EN FUEGO"
  }
};

// Get the style for the current persona
const personaStyle = weeklySummary ? (personaStyles[weeklySummary.persona] || personaStyles["Scott Van Pelt"]) : null;
```

```js
// Display AI-generated summary if available
if (weeklySummary && personaStyle) {
  const summaryContent = html`
    <div style="padding: 0;">
      ${weekInput}

      <div style="
        margin: 1.5rem 0;
        padding: 2rem;
        background: ${personaStyle.gradient};
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        position: relative;
        overflow: hidden;
      ">
        <!-- Background pattern -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background:
            radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
          pointer-events: none;
        "></div>

        <!-- Content -->
        <div style="position: relative; z-index: 1;">
          <!-- Header -->
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <div style="
              font-size: 3rem;
              line-height: 1;
            ">${personaStyle.emoji}</div>
            <div style="flex: 1; min-width: 200px;">
              <div style="
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 0.25rem;
              ">${personaStyle.badge}</div>
              <div style="
                font-size: 1.5rem;
                font-weight: 800;
                color: white;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              ">${weeklySummary.persona} on Week ${weeklySummary.week}</div>
            </div>
            <div style="
              padding: 0.5rem 1rem;
              background: rgba(0, 0, 0, 0.2);
              border-radius: 2rem;
              font-size: 0.75rem;
              font-weight: 600;
              color: white;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              backdrop-filter: blur(10px);
            ">AI Powered</div>
          </div>

          <!-- Summary Text -->
          <div style="
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            font-size: 1.0625rem;
            line-height: 1.8;
            white-space: pre-wrap;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          ">${weeklySummary.summary}</div>
        </div>
      </div>
    </div>
  `;

  display(html`<details open class="section-collapse" style="border-top: 3px solid ${personaStyle.color};">
    <summary class="section-summary" style="color: ${personaStyle.color};">
      ${personaStyle.emoji} ${weeklySummary.persona}'s Week ${weeklySummary.week} Breakdown
    </summary>
    <div class="section-content">
      ${summaryContent}
    </div>
  </details>`);
} else {
  // No summary available - just show the week selector
  display(weekInput);
}
```

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

const weekResultsContent = html`
  <div>
    <h3 style="margin: 0 0 1rem 0;">Week ${selectedWeek} Results</h3>
    ${matchupsWithProbs.map(matchup => {
      const team1Win = matchup.team1_score > matchup.team2_score;
      const team2Win = matchup.team2_score > matchup.team1_score;

      return html`
        <div style="margin: 20px 0; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
          <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; align-items: center;">
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: ${team1Win ? 'bold' : 'normal'}; color: ${team1Win ? 'var(--theme-accent)' : 'inherit'};">
                ${matchup.team1}
              </div>
              <div style="font-size: 32px; font-weight: bold; margin-top: 10px; color: ${team1Win ? 'var(--theme-accent)' : 'var(--theme-foreground-alt)'};">
                ${matchup.team1_score.toFixed(2)}
              </div>
              <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 5px;">
                Win Prob: ${matchup.team1Prob.toFixed(1)}%
              </div>
            </div>

            <div style="text-align: center; padding: 0 20px;">
              <div style="font-size: 24px; color: var(--theme-foreground-alt);">vs</div>
              ${matchup.is_close ? html`<div style="margin-top: 8px; font-size: 12px; color: #f59e0b;">🔥 Close Game</div>` : ''}
            </div>

            <div style="text-align: left;">
              <div style="font-size: 18px; font-weight: ${team2Win ? 'bold' : 'normal'}; color: ${team2Win ? 'var(--theme-accent)' : 'inherit'};">
                ${matchup.team2}
              </div>
              <div style="font-size: 32px; font-weight: bold; margin-top: 10px; color: ${team2Win ? 'var(--theme-accent)' : 'var(--theme-foreground-alt)'};">
                ${matchup.team2_score.toFixed(2)}
              </div>
              <div style="font-size: 12px; color: var(--theme-foreground-alt); margin-top: 5px;">
                Win Prob: ${matchup.team2Prob.toFixed(1)}%
              </div>
            </div>
          </div>

          ${matchup.winner !== 'Tie' ? html`
            <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--theme-foreground-alt);">
              <span style="color: var(--theme-accent);">Winner: ${matchup.winner}</span>
              <span style="color: var(--theme-foreground-alt); margin-left: 15px;">Margin: ${matchup.margin.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
      `;
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Weekly Matchup Results</summary>
  <div class="section-content">
    ${weekResultsContent}
  </div>
</details>`);
```

```js
const scoreDistributionContent = html`
  <div>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Box plot showing the distribution of scores across all matchups for each week. The box shows the median and quartiles, while the whiskers indicate the range of scores.
    </p>
    ${Plot.plot({
      marginBottom: 60,
      height: 400,
      x: {
        label: "Week",
        tickFormat: d => `Week ${d}`
      },
      y: {
        label: "Points Scored",
        grid: true
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
            fill: "var(--theme-accent)"
          }
        )
      ]
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Score Distribution by Week</summary>
  <div class="section-content">
    ${scoreDistributionContent}
  </div>
</details>`);
```

```js
const marginBuckets = [
  { range: "0-5", min: 0, max: 5, color: "#ef4444" },
  { range: "5-10", min: 5, max: 10, color: "#f59e0b" },
  { range: "10-20", min: 10, max: 20, color: "#22c55e" },
  { range: "20-30", min: 20, max: 30, color: "#3b82f6" },
  { range: "30+", min: 30, max: 1000, color: "#8b5cf6" }
];

const marginData = marginBuckets.map(bucket => ({
  range: bucket.range,
  count: processedMatchups.filter(m => m.margin >= bucket.min && m.margin < bucket.max).length,
  color: bucket.color
}));

const marginAnalysisContent = html`
  <div>
    <h3 style="margin-top: 0; margin-bottom: 1rem;">Margin of Victory Distribution</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      Games decided by less than 5 points (red) indicate razor-thin margins, while 30+ point blowouts (purple) show dominant performances.
    </p>
    ${Plot.plot({
      marginLeft: 60,
      height: 250,
      x: {
        label: "Margin Range (Points)",
      },
      y: {
        label: "Number of Games",
        grid: true
      },
      marks: [
        Plot.barY(marginData, {
          x: "range",
          y: "count",
          fill: d => d.color
        }),
        Plot.text(marginData, {
          x: "range",
          y: "count",
          text: d => d.count,
          dy: -10
        })
      ]
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Margin of Victory Analysis</summary>
  <div class="section-content">
    ${marginAnalysisContent}
  </div>
</details>`);
```

```js
const closestGames = processedMatchups
  .sort((a, b) => a.margin - b.margin)
  .slice(0, 10);

const closestMatchupsContent = html`
  <div>
    <h3 style="margin-top: 0; margin-bottom: 1rem;">🔥 Top 10 Closest Games</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      The most nail-biting finishes of the season, decided by the smallest margins.
    </p>
    ${Inputs.table(closestGames, {
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
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Closest Matchups</summary>
  <div class="section-content">
    ${closestMatchupsContent}
  </div>
</details>`);
```

```js
const highestScoring = processedMatchups
  .sort((a, b) => b.total_points - a.total_points)
  .slice(0, 10);

const highestScoringContent = html`
  <div>
    <h3 style="margin-top: 0; margin-bottom: 1rem;">💯 Top 10 Highest Scoring Games</h3>
    <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
      The offensive explosions where both teams showed up to play.
    </p>
    ${Inputs.table(highestScoring, {
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
    })}
  </div>
`;

display(html`<details open class="section-collapse">
  <summary class="section-summary">Highest Scoring Games</summary>
  <div class="section-content">
    ${highestScoringContent}
  </div>
</details>`);
```

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

if (h2hData.length > 0) {
  const h2hContent = html`
    <div>
      <h3 style="margin-top: 0; margin-bottom: 1rem;">Head-to-Head Records (Multiple Matchups)</h3>
      <p style="color: #cbd5e1; margin-bottom: 1.5rem;">
        Historical performance when specific teams face each other multiple times during the season.
      </p>
      ${Inputs.table(h2hData, {
        columns: ["matchup", "team1_wins", "team2_wins", "games"],
        header: {
          matchup: "Matchup",
          team1_wins: "Wins",
          team2_wins: "Wins",
          games: "Total Games"
        }
      })}
    </div>
  `;

  display(html`<details open class="section-collapse">
    <summary class="section-summary">Head-to-Head Records</summary>
    <div class="section-content">
      ${h2hContent}
    </div>
  </details>`);
}
```

---

<div style="margin-top: 40px; padding: 20px; background: var(--theme-background-alt); border-radius: 8px;">
  <h3 style="margin-top: 0;">🎯 Matchup Insights</h3>
  <ul style="line-height: 1.8;">
    <li><strong>Win Probability:</strong> Based on season-long point averages (roughly 2% per point differential)</li>
    <li><strong>Close Games:</strong> Matchups decided by less than 10 points indicate competitive balance</li>
    <li><strong>Score Trends:</strong> Box plots show median, quartiles, and outliers for weekly scoring</li>
    <li><strong>Head-to-Head:</strong> Historical performance against specific opponents</li>
  </ul>
</div>
