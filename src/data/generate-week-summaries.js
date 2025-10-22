#!/usr/bin/env node

/**
 * Weekly Matchup Summary Generator
 *
 * This script generates AI-powered weekly matchup summaries in the style of
 * famous sports commentators. Each summary is written to an individual JSON file
 * that gets committed to the repo, avoiding repeated LLM API calls.
 *
 * Usage:
 *   node src/data/generate-week-summaries.js [week]
 *
 *   If week is omitted, generates summaries for all weeks that don't have them yet.
 *   If week is specified, generates only that week (overwrites if exists).
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
  console.error('Please add your Anthropic API key to .env file:');
  console.error('ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// Sports commentator personas with their signature styles
const PERSONAS = [
  {
    name: "Pat McAfee",
    style: "Energetic, enthusiastic, uses lots of capitals and exclamations. Talks about 'BOOMS', 'BANGERS', and getting 'HYPED'. Very conversational and casual with modern slang."
  },
  {
    name: "Lee Corso",
    style: "Excited, uses catchphrases like 'Not so fast my friend!'. Builds suspense, makes predictions, references college football traditions. Enthusiastic and spirited."
  },
  {
    name: "Stuart Scott",
    style: "Cool, uses hip-hop references and pop culture. Phrases like 'Boo-yah!' and 'As cool as the other side of the pillow'. Smooth, rhythmic delivery with clever wordplay."
  },
  {
    name: "Scott Van Pelt",
    style: "Laid-back, witty, conversational. Self-deprecating humor, references to late-night sports culture. Smooth delivery with clever observations and dry humor."
  },
  {
    name: "Rich Eisen",
    style: "Polished, pop culture savvy, enthusiastic but measured. References movies, TV shows. Professional but personable, with quick wit and clever analogies."
  },
  {
    name: "Dan Patrick",
    style: "Dry wit, catchphrases like 'En Fuego'. Deadpan humor, clever wordplay. Conversational and easy-going with subtle sarcasm."
  }
];

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  
});

/**
 * Load data from cache or generate it
 */
async function loadData() {
  const cacheDir = join(__dirname, '..', '.observablehq', 'cache', 'data');

  // Load league info
  const leaguePath = join(cacheDir, 'league.json');
  if (!existsSync(leaguePath)) {
    throw new Error('League data not found. Run "npm run build" first to generate data.');
  }
  const league = JSON.parse(readFileSync(leaguePath, 'utf-8'));

  // Load matchups
  const matchupsPath = join(cacheDir, 'matchups.json');
  if (!existsSync(matchupsPath)) {
    throw new Error('Matchups data not found. Run "npm run build" first to generate data.');
  }
  const matchups = JSON.parse(readFileSync(matchupsPath, 'utf-8'));

  // Load rosters
  const rostersPath = join(cacheDir, 'rosters.json');
  if (!existsSync(rostersPath)) {
    throw new Error('Rosters data not found. Run "npm run build" first to generate data.');
  }
  const rosters = JSON.parse(readFileSync(rostersPath, 'utf-8'));

  // Load users
  const usersPath = join(cacheDir, 'users.json');
  if (!existsSync(usersPath)) {
    throw new Error('Users data not found. Run "npm run build" first to generate data.');
  }
  const users = JSON.parse(readFileSync(usersPath, 'utf-8'));

  // Load atrocities
  const atrocitiesPath = join(cacheDir, 'atrocities.json');
  let atrocities = [];
  if (existsSync(atrocitiesPath)) {
    atrocities = JSON.parse(readFileSync(atrocitiesPath, 'utf-8'));
  }

  return { league, matchups, rosters, users, atrocities };
}

/**
 * Process matchup data for a specific week
 */
function processWeekData(weekData, rosters, users, atrocities) {
  const { week, matchups } = weekData;

  // Create roster lookup with user names
  const rosterMap = {};
  rosters.forEach(roster => {
    const user = users.find(u => u.user_id === roster.owner_id);
    rosterMap[roster.roster_id] = {
      userName: user?.display_name || `Team ${roster.roster_id}`,
      seasonPoints: (roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100,
      wins: roster.settings?.wins || 0,
      losses: roster.settings?.losses || 0
    };
  });

  // Group matchups by matchup_id to get head-to-head pairs
  const matchupGroups = {};
  matchups.forEach(m => {
    if (!matchupGroups[m.matchup_id]) {
      matchupGroups[m.matchup_id] = [];
    }
    matchupGroups[m.matchup_id].push(m);
  });

  // Process each matchup pair
  const processedMatchups = [];
  Object.values(matchupGroups).forEach(pair => {
    if (pair.length === 2) {
      const [team1, team2] = pair;
      const roster1 = rosterMap[team1.roster_id];
      const roster2 = rosterMap[team2.roster_id];

      const winner = team1.points > team2.points ? roster1.userName : roster2.userName;
      const margin = Math.abs(team1.points - team2.points);

      processedMatchups.push({
        team1: roster1.userName,
        team1Score: team1.points,
        team1SeasonAvg: roster1.seasonPoints,
        team2: roster2.userName,
        team2Score: team2.points,
        team2SeasonAvg: roster2.seasonPoints,
        winner,
        margin: margin.toFixed(2),
        isCloseGame: margin < 10
      });
    }
  });

  // Calculate week statistics
  const allScores = processedMatchups.flatMap(m => [m.team1Score, m.team2Score]);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const highScore = Math.max(...allScores);
  const lowScore = Math.min(...allScores);
  const biggestMargin = Math.max(...processedMatchups.map(m => parseFloat(m.margin)));
  const closestMargin = Math.min(...processedMatchups.map(m => parseFloat(m.margin)));
  const closeGames = processedMatchups.filter(m => m.isCloseGame).length;

  // Filter atrocities for this week
  const weekAtrocities = atrocities
    .filter(a => a.week === week)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Top 5 worst decisions

  return {
    week,
    matchups: processedMatchups,
    atrocities: weekAtrocities,
    stats: {
      avgScore: avgScore.toFixed(2),
      highScore: highScore.toFixed(2),
      lowScore: lowScore.toFixed(2),
      biggestMargin: biggestMargin.toFixed(2),
      closestMargin: closestMargin.toFixed(2),
      closeGames,
      totalMatchups: processedMatchups.length,
      totalAtrocities: weekAtrocities.length
    }
  };
}

/**
 * Generate LLM summary for a week
 */
async function generateSummary(weekData, persona) {
  const { week, matchups, atrocities, stats } = weekData;

  // Build matchup text
  const matchupText = matchups.map(m =>
    `${m.team1} (${m.team1Score}) vs ${m.team2} (${m.team2Score}) - ${m.winner} wins by ${m.margin}`
  ).join('\n');

  // Build atrocities text
  let atrocitiesText = '';
  if (atrocities.length > 0) {
    atrocitiesText = '\n\nWORST LINEUP DECISIONS OF THE WEEK:\n';
    atrocities.forEach((a, i) => {
      atrocitiesText += `${i + 1}. ${a.userName}: Started ${a.startedPlayer} (${a.startedPoints} pts) over ${a.benchedPlayer} (${a.benchedPoints} pts) - Left ${a.pointsLeft.toFixed(1)} points on bench. ${a.severity} mistake!\n`;
    });
  }

  const prompt = `You are ${persona.name}, the legendary sports commentator. Write a 3-4 paragraph summary of this fantasy football week in your signature style.

WEEK ${week} MATCHUP RESULTS:
${matchupText}

WEEK STATISTICS:
- Average Score: ${stats.avgScore}
- Highest Score: ${stats.highScore}
- Lowest Score: ${stats.lowScore}
- Biggest Blowout: ${stats.biggestMargin} point margin
- Closest Game: ${stats.closestMargin} point margin
- Close Games (< 10 pts): ${stats.closeGames} of ${stats.totalMatchups}
${atrocitiesText}

Write in ${persona.name}'s style: ${persona.style}

Keep it entertaining, highlight the most interesting matchups, notable performances, close games, and blowouts. If there were notable lineup mistakes (atrocities), roast the managers who left big points on the bench - make it funny but not mean-spirited. Make it feel like ${persona.name} is talking to fantasy football fans. Be conversational and engaging.

Return ONLY the summary text, no preamble or meta-commentary.`;

  console.log(`🤖 Generating summary for Week ${week} as ${persona.name}...`);

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return message.content[0].text;
}

/**
 * Save summary to JSON file
 */
function saveSummary(week, persona, summary, season) {
  const outputDir = join(__dirname, 'week-summaries');

  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const data = {
    week,
    season,
    leagueId: LEAGUE_ID,
    persona: persona.name,
    summary,
    generatedAt: new Date().toISOString()
  };

  // Include league ID in filename to handle multiple seasons/leagues
  const outputPath = join(outputDir, `week-${week}-${LEAGUE_ID}.json`);
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`✅ Saved summary to ${outputPath}`);
}

/**
 * Check if summary already exists
 */
function summaryExists(week) {
  const outputPath = join(__dirname, 'week-summaries', `week-${week}-${LEAGUE_ID}.json`);
  return existsSync(outputPath);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const specificWeek = args[0] ? parseInt(args[0]) : null;

  console.log('🏈 Weekly Matchup Summary Generator');
  console.log('=====================================\n');

  // Load data
  console.log('📊 Loading data...');
  const { league, matchups, rosters, users, atrocities } = await loadData();
  const season = league.season || new Date().getFullYear();
  console.log(`✅ Loaded ${matchups.length} weeks of matchups for ${season} season`);
  console.log(`✅ Loaded ${atrocities.length} atrocities across all weeks\n`);

  // Determine which weeks to process
  const weeksToProcess = specificWeek
    ? [matchups.find(m => m.week === specificWeek)]
    : matchups.filter(m => !summaryExists(m.week));

  if (weeksToProcess.length === 0) {
    if (specificWeek) {
      console.log(`❌ Week ${specificWeek} not found in matchup data`);
    } else {
      console.log('✅ All weeks already have summaries!');
      console.log('To regenerate a specific week: node src/data/generate-week-summaries.js [week]');
    }
    return;
  }

  console.log(`📝 Generating summaries for ${weeksToProcess.length} week(s)...\n`);

  // Process each week
  for (const weekData of weeksToProcess) {
    if (!weekData) continue;

    // Process week data
    const processedData = processWeekData(weekData, rosters, users, atrocities);

    // Select random persona
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    // Generate summary
    try {
      const summary = await generateSummary(processedData, persona);

      // Save to file
      saveSummary(weekData.week, persona, summary, season);

      console.log(`   Persona: ${persona.name}`);
      console.log(`   Preview: ${summary.substring(0, 100)}...\n`);

      // Rate limiting - wait 1 second between requests
      if (weeksToProcess.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Error generating summary for week ${weekData.week}:`, error.message);
    }
  }

  console.log('\n✨ Summary generation complete!');
  console.log('📁 Summaries saved to: src/data/week-summaries/');
  console.log('💡 Remember to commit these files to your repo!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
