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
    style: "Energetic, enthusiastic, uses lots of capitals and exclamations. Signature phrases: 'BOOM!', 'BANGER!', 'FOR THE BRAND!', 'LETS GOOOO!'. Very conversational and casual with modern slang. Example: 'That's a BANGER of a performance! This guy is ELECTRIC, FOR THE BRAND!' Give managers wrestling-style nicknames.",
    emphasis: ["big plays", "excitement", "energy"]
  },
  {
    name: "Lee Corso",
    style: "Excited, dramatic, builds suspense. Signature phrases: 'Not so fast my friend!', 'Oh boy!', 'Uh oh!'. Makes bold predictions, references traditions. Example: 'Not so fast my friend! You thought this was over? OH BOY were you wrong!' Create dramatic narratives.",
    emphasis: ["upsets", "predictions", "drama"]
  },
  {
    name: "Stuart Scott",
    style: "Cool, smooth, hip-hop and pop culture references. Signature phrases: 'Boo-yah!', 'As cool as the other side of the pillow', 'He must be the bus driver because he was takin' him to school!' Rhythmic delivery with clever wordplay and analogies. Example: 'Boo-yah! That performance was cooler than the other side of the pillow!'",
    emphasis: ["style", "wordplay", "pop culture"]
  },
  {
    name: "Scott Van Pelt",
    style: "Laid-back, witty, conversational with dry humor. References late-night sports culture, 'Bad Beats', and gambling. Self-deprecating and relatable. Example: 'Of course he left 40 points on the bench. That's a Bad Beat if I've ever seen one.' Sympathetic but sarcastic.",
    emphasis: ["bad beats", "relatability", "dry humor"]
  },
  {
    name: "Rich Eisen",
    style: "Polished, enthusiastic but measured. Heavy on pop culture references - movies, TV shows, music. Signature: comparing plays to movie scenes. Example: 'That comeback was like the Death Star assault in Star Wars - impossible odds, but he pulled it off!' Smart analogies and references.",
    emphasis: ["comebacks", "movie/TV references", "smart analogies"]
  },
  {
    name: "Dan Patrick",
    style: "Dry wit, deadpan delivery with subtle sarcasm. Signature phrases: 'En Fuego!', 'You can't stop him, you can only hope to contain him'. Clever wordplay, easy-going. Example: 'He's en fuego! You can't stop him, you can only hope to contain him... and even that's not working.' Classic sports cliches with ironic twist.",
    emphasis: ["irony", "cliches twisted", "deadpan"]
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

  // Add variety instructions - randomly select special focus areas
  const varietyInstructions = [];
  const randomElements = [
    "Give creative nicknames to at least 2 managers based on their performance",
    "Create a rivalry storyline between two teams",
    "Make a bold prediction for next week based on this week's results",
    "Compare a key moment to a famous sports or pop culture moment",
    "Identify the 'hero' and 'villain' of the week",
    "Create a dramatic opening line that hooks the reader",
    "End with a zinger or memorable quote about the week"
  ];

  // Randomly select 2-3 special instructions
  const selectedCount = 2 + Math.floor(Math.random() * 2); // 2 or 3
  const shuffled = [...randomElements].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, selectedCount);

  const prompt = `You are ${persona.name}, the legendary sports commentator. Write a 4-4 paragraph summary of this fantasy football week in your signature style.

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

Focus on what ${persona.name} emphasizes: ${persona.emphasis.join(', ')}

SPECIAL INSTRUCTIONS FOR THIS WEEK:
${selected.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}

Keep it entertaining, highlight the most interesting matchups, notable performances, close games, and blowouts. If there were notable lineup mistakes (atrocities), roast the managers who left big points on the bench - make it funny but not mean-spirited. Use ${persona.name}'s actual catchphrases and speaking style. Make it feel like ${persona.name} is talking directly to fantasy football fans. Be conversational and engaging.

Return ONLY the summary text, no preamble or meta-commentary.`;

  console.log(`🤖 Generating summary for Week ${week} as ${persona.name}...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    temperature: 1.0,
    top_p: 0.95,
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
 * Check if a week is complete (weeks end Tuesday at 10 PM ET)
 */
function isWeekComplete(week, allMatchups) {
  const now = new Date();

  // Find the latest week number in the data
  const latestWeek = Math.max(...allMatchups.map(m => m.week));

  // If this week is before the latest week, it's definitely complete
  if (week < latestWeek) {
    return true;
  }

  // For the current/latest week, check if we're past Tuesday 10 PM
  // Get the day of week (0 = Sunday, 1 = Monday, 2 = Tuesday, etc.)
  const dayOfWeek = now.getDay();
  const hours = now.getHours();

  // If it's Wednesday or later, the week is complete
  if (dayOfWeek >= 3) {
    return true;
  }

  // If it's Tuesday after 10 PM, the week is complete
  if (dayOfWeek === 2 && hours >= 22) {
    return true;
  }

  // Otherwise, the week is still in progress
  return false;
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
  let weeksToProcess;
  if (specificWeek) {
    weeksToProcess = [matchups.find(m => m.week === specificWeek)];
  } else {
    // Find the latest week
    const latestWeek = Math.max(...matchups.map(m => m.week));

    // Filter weeks that don't have summaries and are complete
    weeksToProcess = matchups.filter(m => !summaryExists(m.week) && isWeekComplete(m.week, matchups));

    // Check if current week is incomplete and inform user
    if (!summaryExists(latestWeek) && !isWeekComplete(latestWeek, matchups)) {
      console.log(`⏳ Week ${latestWeek} is still in progress (weeks complete Tuesday at 10 PM)`);
      console.log(`   Summary will be generated after the week completes\n`);
    }
  }

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
