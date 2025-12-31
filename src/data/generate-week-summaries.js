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
import { getWeeklyPersonas, getActiveRegion } from './personas.js';
import { createTokenLogger } from './token-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-5';

if (!LEAGUE_ID) {
  console.error('❌ Error: SLEEPER_LEAGUE_ID environment variable not set');
  console.error('Please add your Sleeper league ID to .env file:');
  console.error('SLEEPER_LEAGUE_ID=your-league-id');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
  console.error('Please add your Anthropic API key to .env file:');
  console.error('ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// Get personas from shared config based on COMMENTATOR_REGION environment variable
const PERSONAS = getWeeklyPersonas();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,

});

// Initialize token logger for cost tracking
const tokenLogger = createTokenLogger({ model: CLAUDE_MODEL, script: 'generate-week-summaries' });

/**
 * Extract top and bottom scoring starters for a team
 */
function getTeamPlayerPerformance(matchup, players) {
  if (!matchup.starters || !matchup.starters_points) {
    return { topPlayers: [], bottomPlayers: [] };
  }

  const starterPerformances = matchup.starters.map((playerId, index) => {
    const player = players[playerId];
    const points = matchup.starters_points[index] || 0;

    return {
      name: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
      position: player?.fantasy_positions?.[0] || player?.position || 'FLEX',
      points: points
    };
  }).filter(p => p.name !== 'Unknown' && p.points !== null);

  // Sort by points
  const sorted = [...starterPerformances].sort((a, b) => b.points - a.points);

  // Get top 2 and bottom 2 performers
  const topPlayers = sorted.slice(0, 2);
  const bottomPlayers = sorted.slice(-2).reverse();

  return { topPlayers, bottomPlayers };
}

/**
 * Calculate team trends from prior weeks
 */
function calculateTeamTrends(rosterId, allMatchups, currentWeek) {
  const teamScores = [];

  // Get all scores for this team up to current week
  allMatchups
    .filter(w => w.week <= currentWeek)
    .forEach(weekData => {
      const matchup = weekData.matchups.find(m => m.roster_id === rosterId);
      if (matchup && matchup.points !== undefined) {
        teamScores.push({
          week: weekData.week,
          points: matchup.points
        });
      }
    });

  if (teamScores.length < 2) {
    return null;
  }

  // Sort by week
  teamScores.sort((a, b) => a.week - b.week);

  // Calculate stats
  const allPoints = teamScores.map(s => s.points);
  const seasonAvg = allPoints.reduce((a, b) => a + b, 0) / allPoints.length;

  // Recent form (last 3 weeks)
  const recentScores = teamScores.slice(-3);
  const recentAvg = recentScores.reduce((a, b) => a + b.points, 0) / recentScores.length;

  // Calculate streak
  let streak = 0;
  let streakType = null;
  const currentScore = teamScores[teamScores.length - 1]?.points;

  for (let i = teamScores.length - 1; i >= 0; i--) {
    const aboveAvg = teamScores[i].points > seasonAvg;
    if (streakType === null) {
      streakType = aboveAvg ? 'hot' : 'cold';
      streak = 1;
    } else if ((streakType === 'hot' && aboveAvg) || (streakType === 'cold' && !aboveAvg)) {
      streak++;
    } else {
      break;
    }
  }

  // Trend direction (comparing recent avg to season avg)
  const trendPct = ((recentAvg - seasonAvg) / seasonAvg * 100);
  let trendDirection = 'stable';
  if (trendPct > 10) trendDirection = 'trending up';
  else if (trendPct < -10) trendDirection = 'trending down';

  // Calculate consistency (standard deviation)
  const variance = allPoints.reduce((sum, p) => sum + Math.pow(p - seasonAvg, 2), 0) / allPoints.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = stdDev < 15 ? 'consistent' : stdDev < 25 ? 'moderate' : 'volatile';

  return {
    seasonAvg: seasonAvg.toFixed(1),
    recentAvg: recentAvg.toFixed(1),
    streak: streak >= 2 ? { type: streakType, weeks: streak } : null,
    trend: trendDirection,
    consistency: consistencyScore,
    highWeek: Math.max(...allPoints).toFixed(1),
    lowWeek: Math.min(...allPoints).toFixed(1)
  };
}

/**
 * Find league-wide notable players for the week
 */
function getLeagueWidePlayerStats(weekMatchups, players) {
  const allPlayerPerformances = [];

  weekMatchups.forEach(matchup => {
    if (!matchup.starters || !matchup.starters_points) return;

    matchup.starters.forEach((playerId, index) => {
      const player = players[playerId];
      const points = matchup.starters_points[index] || 0;

      if (player && points !== null) {
        allPlayerPerformances.push({
          name: `${player.first_name} ${player.last_name}`,
          position: player.fantasy_positions?.[0] || player.position || 'FLEX',
          points: points,
          rosterId: matchup.roster_id
        });
      }
    });
  });

  // Sort by points
  const sorted = [...allPlayerPerformances].sort((a, b) => b.points - a.points);

  // Top 3 performers league-wide
  const topPerformers = sorted.slice(0, 3);

  // Bottom 3 (busts)
  const busts = sorted.filter(p => p.position !== 'K' && p.position !== 'DEF').slice(-3).reverse();

  // Find biggest overperformers (position-specific)
  const positionAvgs = {};
  allPlayerPerformances.forEach(p => {
    if (!positionAvgs[p.position]) positionAvgs[p.position] = [];
    positionAvgs[p.position].push(p.points);
  });

  Object.keys(positionAvgs).forEach(pos => {
    const avg = positionAvgs[pos].reduce((a, b) => a + b, 0) / positionAvgs[pos].length;
    positionAvgs[pos] = avg;
  });

  return {
    topPerformers,
    busts,
    positionAverages: positionAvgs
  };
}

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

  // Load players
  const playersPath = join(cacheDir, 'players.json');
  let players = {};
  if (existsSync(playersPath)) {
    players = JSON.parse(readFileSync(playersPath, 'utf-8'));
  } else {
    console.warn('⚠️ Players data not found. Player stats will be limited.');
  }

  // Load power rankings
  const powerRankingsPath = join(cacheDir, 'power-rankings.json');
  let powerRankings = null;
  if (existsSync(powerRankingsPath)) {
    powerRankings = JSON.parse(readFileSync(powerRankingsPath, 'utf-8'));
  }

  return { league, matchups, rosters, users, atrocities, players, powerRankings };
}

/**
 * Get team power score from power rankings
 */
function getTeamPowerScore(rosterId, powerRankings) {
  if (!powerRankings || !powerRankings.rankings) {
    return null;
  }
  const teamRanking = powerRankings.rankings.find(r => r.rosterId === rosterId);
  if (!teamRanking) {
    return null;
  }
  return {
    powerScore: teamRanking.powerScore,
    powerRank: teamRanking.powerRank,
    totalTeams: powerRankings.rankings.length
  };
}

/**
 * Process matchup data for a specific week
 */
function processWeekData(weekData, rosters, users, atrocities, players = {}, allMatchups = [], powerRankings = null) {
  const { week, matchups } = weekData;

  // Create roster lookup with user names
  const rosterMap = {};
  rosters.forEach(roster => {
    const user = users.find(u => u.user_id === roster.owner_id);
    rosterMap[roster.roster_id] = {
      userName: user?.display_name || `Team ${roster.roster_id}`,
      seasonPoints: (roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100,
      wins: roster.settings?.wins || 0,
      losses: roster.settings?.losses || 0,
      rosterId: roster.roster_id,
      powerScore: getTeamPowerScore(roster.roster_id, powerRankings)
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

      // Get player performance for each team
      const team1Players = Object.keys(players).length > 0
        ? getTeamPlayerPerformance(team1, players)
        : { topPlayers: [], bottomPlayers: [] };
      const team2Players = Object.keys(players).length > 0
        ? getTeamPlayerPerformance(team2, players)
        : { topPlayers: [], bottomPlayers: [] };

      // Get team trends from prior weeks
      const team1Trends = allMatchups.length > 0
        ? calculateTeamTrends(team1.roster_id, allMatchups, week)
        : null;
      const team2Trends = allMatchups.length > 0
        ? calculateTeamTrends(team2.roster_id, allMatchups, week)
        : null;

      processedMatchups.push({
        team1: roster1.userName,
        team1Score: team1.points,
        team1SeasonAvg: roster1.seasonPoints,
        team1TopPlayers: team1Players.topPlayers,
        team1BottomPlayers: team1Players.bottomPlayers,
        team1Trends: team1Trends,
        team1PowerScore: roster1.powerScore,
        team2: roster2.userName,
        team2Score: team2.points,
        team2SeasonAvg: roster2.seasonPoints,
        team2TopPlayers: team2Players.topPlayers,
        team2BottomPlayers: team2Players.bottomPlayers,
        team2Trends: team2Trends,
        team2PowerScore: roster2.powerScore,
        winner,
        margin: margin.toFixed(2),
        isCloseGame: margin < 10
      });
    }
  });

  // Get league-wide player stats
  const leaguePlayerStats = Object.keys(players).length > 0
    ? getLeagueWidePlayerStats(matchups, players)
    : { topPerformers: [], busts: [], positionAverages: {} };

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
    leaguePlayerStats,
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
  const { week, matchups, atrocities, stats, leaguePlayerStats } = weekData;

  // Build detailed matchup text with player performances
  const matchupText = matchups.map(m => {
    let text = `${m.team1} (${m.team1Score}) vs ${m.team2} (${m.team2Score}) - ${m.winner} wins by ${m.margin}`;

    // Add power rankings context
    if (m.team1PowerScore && m.team2PowerScore) {
      text += `\n  Power Rankings: ${m.team1} #${m.team1PowerScore.powerRank} (${m.team1PowerScore.powerScore}) vs ${m.team2} #${m.team2PowerScore.powerRank} (${m.team2PowerScore.powerScore})`;
    }

    // Add top performers for each team
    if (m.team1TopPlayers?.length > 0) {
      const topNames = m.team1TopPlayers.map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)})`).join(', ');
      text += `\n  ${m.team1}'s stars: ${topNames}`;
    }
    if (m.team1BottomPlayers?.length > 0) {
      const bottomNames = m.team1BottomPlayers.map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)})`).join(', ');
      text += `\n  ${m.team1}'s duds: ${bottomNames}`;
    }
    if (m.team2TopPlayers?.length > 0) {
      const topNames = m.team2TopPlayers.map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)})`).join(', ');
      text += `\n  ${m.team2}'s stars: ${topNames}`;
    }
    if (m.team2BottomPlayers?.length > 0) {
      const bottomNames = m.team2BottomPlayers.map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)})`).join(', ');
      text += `\n  ${m.team2}'s duds: ${bottomNames}`;
    }

    return text;
  }).join('\n\n');

  // Build team trends text
  let trendsText = '\nTEAM TRENDS & STREAKS:\n';
  const teamsWithTrends = new Set();
  matchups.forEach(m => {
    if (m.team1Trends && !teamsWithTrends.has(m.team1)) {
      teamsWithTrends.add(m.team1);
      const t = m.team1Trends;
      let trendLine = `${m.team1}: Season avg ${t.seasonAvg}, Recent avg ${t.recentAvg} (${t.trend})`;
      if (t.streak) {
        trendLine += ` - ${t.streak.weeks}-week ${t.streak.type} streak`;
      }
      trendLine += ` - ${t.consistency} scorer`;
      trendsText += trendLine + '\n';
    }
    if (m.team2Trends && !teamsWithTrends.has(m.team2)) {
      teamsWithTrends.add(m.team2);
      const t = m.team2Trends;
      let trendLine = `${m.team2}: Season avg ${t.seasonAvg}, Recent avg ${t.recentAvg} (${t.trend})`;
      if (t.streak) {
        trendLine += ` - ${t.streak.weeks}-week ${t.streak.type} streak`;
      }
      trendLine += ` - ${t.consistency} scorer`;
      trendsText += trendLine + '\n';
    }
  });

  // Build league-wide player stats text
  let leaguePlayersText = '';
  if (leaguePlayerStats?.topPerformers?.length > 0) {
    leaguePlayersText = '\nLEAGUE-WIDE PLAYER HIGHLIGHTS:\n';
    leaguePlayersText += 'Top performers: ' + leaguePlayerStats.topPerformers
      .map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)} pts)`)
      .join(', ') + '\n';
    if (leaguePlayerStats.busts?.length > 0) {
      leaguePlayersText += 'Biggest busts: ' + leaguePlayerStats.busts
        .map(p => `${p.name} (${p.position}: ${p.points.toFixed(1)} pts)`)
        .join(', ') + '\n';
    }
  }

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

  // System message for stable persona instructions
  const systemMessage = `You are ${persona.name}, the legendary sports commentator.
Style: ${persona.style}
Focus: ${persona.emphasis.join(', ')}

OUTPUT: 4-5 entertaining paragraphs. Reference players by name with their stats. Roast lineup mistakes (funny, not mean). Use your catchphrases. No preamble or meta-commentary.`;

  // User message with dynamic week data
  const userMessage = `Summarize Week ${week} fantasy football:

${matchupText}
${trendsText}${leaguePlayersText}
STATS: Avg ${stats.avgScore} | High ${stats.highScore} | Low ${stats.lowScore} | Blowout ${stats.biggestMargin}pts | Closest ${stats.closestMargin}pts | Close games: ${stats.closeGames}/${stats.totalMatchups}
${atrocitiesText}

THIS WEEK'S SPECIAL FOCUS:
${selected.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}`;

  console.log(`🤖 Generating summary for Week ${week} as ${persona.name}...`);

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    top_p: 0.80,
    system: systemMessage,
    messages: [{
      role: 'user',
      content: userMessage
    }]
  });

  // Log token usage for cost monitoring
  tokenLogger.log('generate-summary', message.usage, { week, persona: persona.name });

  return message.content[0].text;
}

/**
 * Save summary to JSON file with matchup scores for change detection
 */
function saveSummary(week, persona, summary, season, matchupScores) {
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
    generatedAt: new Date().toISOString(),
    // Store matchup scores for change detection
    matchupScores
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
 * Load existing summary data including stored scores
 */
function loadExistingSummary(week) {
  const outputPath = join(__dirname, 'week-summaries', `week-${week}-${LEAGUE_ID}.json`);
  if (!existsSync(outputPath)) {
    return null;
  }
  try {
    const content = readFileSync(outputPath, 'utf-8');
    if (!content || content.trim() === '') {
      return null;
    }
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️ Could not parse existing summary for week ${week}:`, error.message);
    return null;
  }
}

/**
 * Extract matchup scores from processed data for comparison
 */
function extractMatchupScores(processedMatchups) {
  return processedMatchups.map(m => ({
    team1: m.team1,
    team1Score: m.team1Score,
    team2: m.team2,
    team2Score: m.team2Score
  })).sort((a, b) => a.team1.localeCompare(b.team1));
}

/**
 * Check if scores have changed since last summary generation
 */
function haveScoresChanged(existingScores, currentScores) {
  if (!existingScores || !currentScores) {
    return true;
  }
  if (existingScores.length !== currentScores.length) {
    return true;
  }

  // Sort both arrays consistently for comparison
  const sortedExisting = [...existingScores].sort((a, b) => a.team1.localeCompare(b.team1));
  const sortedCurrent = [...currentScores].sort((a, b) => a.team1.localeCompare(b.team1));

  for (let i = 0; i < sortedExisting.length; i++) {
    if (sortedExisting[i].team1Score !== sortedCurrent[i].team1Score ||
        sortedExisting[i].team2Score !== sortedCurrent[i].team2Score) {
      return true;
    }
  }
  return false;
}

/**
 * Check if scores appear to be incomplete (e.g., all zeros or very low)
 * This helps detect premature summary generation
 */
function areScoresComplete(matchupScores) {
  if (!matchupScores || matchupScores.length === 0) {
    return false;
  }

  const allScores = matchupScores.flatMap(m => [m.team1Score, m.team2Score]);
  const totalScore = allScores.reduce((a, b) => a + b, 0);
  const avgScore = totalScore / allScores.length;
  const nonZeroCount = allScores.filter(s => s > 0).length;

  // Scores are incomplete if:
  // 1. All scores are zero
  // 2. Average score is below 20 (way too low for fantasy football)
  // 3. More than half the scores are zero
  if (totalScore === 0) {
    console.log(`   ⚠️ All scores are zero - week is incomplete`);
    return false;
  }
  if (avgScore < 20) {
    console.log(`   ⚠️ Average score (${avgScore.toFixed(2)}) is too low - week may be incomplete`);
    return false;
  }
  if (nonZeroCount < allScores.length / 2) {
    console.log(`   ⚠️ Too many zero scores (${allScores.length - nonZeroCount}/${allScores.length}) - week may be incomplete`);
    return false;
  }

  return true;
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
  console.log('=====================================');
  console.log(`📍 Commentator Region: ${getActiveRegion()} (${PERSONAS.length} personas available)\n`);

  // Load data
  console.log('📊 Loading data...');
  const { league, matchups, rosters, users, atrocities, players, powerRankings } = await loadData();
  const season = league.season || new Date().getFullYear();
  console.log(`✅ Loaded ${matchups.length} weeks of matchups for ${season} season`);
  console.log(`✅ Loaded ${atrocities.length} atrocities across all weeks`);
  console.log(`✅ Loaded ${Object.keys(players).length} players for enhanced stats`);
  if (powerRankings) {
    console.log(`✅ Loaded power rankings for ${powerRankings.rankings?.length || 0} teams`);
  } else {
    console.log(`⚠️ Power rankings not available (run build first)`);
  }
  console.log('');

  // Determine which weeks to process
  let weeksToProcess = [];
  let weeksWithChangedScores = [];

  if (specificWeek) {
    weeksToProcess = [matchups.find(m => m.week === specificWeek)];
  } else {
    // Find the latest week
    const latestWeek = Math.max(...matchups.map(m => m.week));

    // Check all weeks - both new summaries and existing ones that may need updates
    for (const weekData of matchups) {
      const week = weekData.week;

      if (!isWeekComplete(week, matchups)) {
        if (week === latestWeek) {
          console.log(`⏳ Week ${week} is still in progress (weeks complete Tuesday at 10 PM)`);
          console.log(`   Summary will be generated after the week completes\n`);
        }
        continue;
      }

      const existingSummary = loadExistingSummary(week);

      if (!existingSummary) {
        // No existing summary - add to process list
        weeksToProcess.push(weekData);
      } else if (existingSummary.matchupScores) {
        // Check if scores have changed since last generation
        const processedData = processWeekData(weekData, rosters, users, atrocities, players, matchups, powerRankings);
        const currentScores = extractMatchupScores(processedData.matchups);

        if (haveScoresChanged(existingSummary.matchupScores, currentScores)) {
          console.log(`🔄 Week ${week}: Scores have changed since last generation`);
          weeksWithChangedScores.push(weekData);
        }
      } else {
        // Old format without matchupScores - check if it needs regeneration
        // by processing and checking if scores look valid
        const processedData = processWeekData(weekData, rosters, users, atrocities, players, matchups, powerRankings);
        const currentScores = extractMatchupScores(processedData.matchups);

        // If the summary mentions zero scores but current data shows real scores,
        // it was likely generated prematurely
        const avgCurrentScore = currentScores.reduce((sum, m) => sum + m.team1Score + m.team2Score, 0) / (currentScores.length * 2);
        if (avgCurrentScore > 50 && existingSummary.summary.toLowerCase().includes('zero')) {
          console.log(`🔄 Week ${week}: Legacy summary may be premature (current avg: ${avgCurrentScore.toFixed(2)})`);
          weeksWithChangedScores.push(weekData);
        }
      }
    }
  }

  // Combine new weeks and weeks with changed scores
  const allWeeksToProcess = [...weeksToProcess, ...weeksWithChangedScores];

  if (allWeeksToProcess.length === 0) {
    if (specificWeek) {
      console.log(`❌ Week ${specificWeek} not found in matchup data`);
    } else {
      console.log('✅ All weeks have up-to-date summaries!');
      console.log('To regenerate a specific week: node src/data/generate-week-summaries.js [week]');
    }
    return;
  }

  if (weeksToProcess.length > 0) {
    console.log(`📝 New summaries to generate: ${weeksToProcess.map(w => w.week).join(', ')}`);
  }
  if (weeksWithChangedScores.length > 0) {
    console.log(`🔄 Summaries to update (scores changed): ${weeksWithChangedScores.map(w => w.week).join(', ')}`);
  }
  console.log('');

  // Process each week
  for (const weekData of allWeeksToProcess) {
    if (!weekData) continue;

    console.log(`📅 Processing Week ${weekData.week}...`);

    // Process week data with player stats and trends
    const processedData = processWeekData(weekData, rosters, users, atrocities, players, matchups, powerRankings);

    // Extract scores for storage and validation
    const matchupScores = extractMatchupScores(processedData.matchups);

    // Validate scores are complete before generating
    if (!areScoresComplete(matchupScores)) {
      console.log(`   ⏭️ Skipping Week ${weekData.week} - scores appear incomplete\n`);
      continue;
    }

    // Select random persona
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    // Generate summary
    try {
      const summary = await generateSummary(processedData, persona);

      // Save to file with matchup scores
      saveSummary(weekData.week, persona, summary, season, matchupScores);

      console.log(`   Persona: ${persona.name}`);
      console.log(`   Preview: ${summary.substring(0, 100)}...\n`);

      // Rate limiting - wait 1 second between requests
      if (allWeeksToProcess.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Error generating summary for week ${weekData.week}:`, error.message);
    }
  }

  // Print token usage summary
  tokenLogger.summary();

  console.log('\n✨ Summary generation complete!');
  console.log('📁 Summaries saved to: src/data/week-summaries/');
  console.log('💡 Remember to commit these files to your repo!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
