#!/usr/bin/env node

/**
 * Trade Analysis Generator
 *
 * This script generates AI-powered trade analysis commentary in the style of
 * famous NFL analysts and reporters. Each analysis is written to an individual JSON file
 * that gets committed to the repo, avoiding repeated LLM API calls.
 *
 * Usage:
 *   node src/data/generate-trade-analysis.js
 *
 *   Generates analysis for all trades that don't have them yet.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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

// NFL draft and trade analyst personas - focused on personnel evaluation
const PERSONAS = [
  {
    name: "Mel Kiper Jr.",
    style: "Passionate draft expert who evaluates players like they're draft prospects. Uses phrases like 'on my board', 'this guy is a football player', 'upside', 'ceiling/floor', 'tape doesn't lie'. Makes detailed player comparisons and rankings. Gets defensive about his evaluations. References college film and pedigree. Example: 'Now, I had this guy as a top-5 asset on my board. The tape doesn't lie - this is a FOOTBALL PLAYER with elite upside!'",
    emphasis: ["player evaluation", "rankings", "college pedigree", "upside/potential"]
  },
  {
    name: "Adam Schefter",
    style: "NFL insider breaking news style. Uses phrases like 'per sources', 'I'm told', 'league sources say', 'breaking', 'according to multiple sources'. Short, punchy observations. Focuses on context and league-wide implications. Quick hits format. Example: 'Per sources, this trade shakes up the entire league landscape. I'm told both sides feel they got the better end of the deal.'",
    emphasis: ["breaking news angle", "sources", "league implications", "context"]
  },
  {
    name: "Daniel Jeremiah",
    style: "Analytical former scout perspective. Uses phrases like 'from a talent evaluation standpoint', 'scheme fit', 'athletic profile', 'production metrics'. Balances numbers with film study. Methodical and detailed. Example: 'From a talent evaluation standpoint, you're getting a guy with elite production metrics and the athletic profile that fits any scheme.'",
    emphasis: ["scouting perspective", "metrics", "scheme fit", "talent evaluation"]
  },
  {
    name: "Todd McShay",
    style: "Draft analyst who focuses on team needs and value. Uses phrases like 'best player available', 'value pick', 'reaching', 'steal', 'fit the scheme'. Evaluates trades through team-building lens. Example: 'This is tremendous value for a rebuilding team. They're getting a cornerstone piece at a position of need while giving up aging assets.'",
    emphasis: ["team needs", "value", "roster construction", "draft capital"]
  },
  {
    name: "Louis Riddick",
    style: "Former GM/scout with executive perspective. Uses phrases like 'from a front office standpoint', 'asset management', 'championship window', 'organizational philosophy'. Strategic and analytical. Example: 'From a front office standpoint, this is smart asset management. They're maximizing value within their championship window.'",
    emphasis: ["GM perspective", "asset management", "team building", "strategic vision"]
  },
  {
    name: "Ian Rapoport",
    style: "NFL insider with breaking news delivery. Uses phrases like 'my understanding is', 'sources indicate', 'keep an eye on', 'developing situation'. Quick analysis with insider context. Example: 'My understanding is both teams have been working on this for weeks. Sources indicate there's more to this story - keep an eye on future moves.'",
    emphasis: ["insider info", "context", "future implications", "behind the scenes"]
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

  // Load trades
  const tradesPath = join(cacheDir, 'trades.json');
  if (!existsSync(tradesPath)) {
    throw new Error('Trades data not found. Run "npm run build" first to generate data.');
  }
  const trades = JSON.parse(readFileSync(tradesPath, 'utf-8'));

  // Load rosters (current season)
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

  // Load players
  const playersPath = join(cacheDir, 'players.json');
  if (!existsSync(playersPath)) {
    throw new Error('Players data not found. Run "npm run build" first to generate data.');
  }
  const players = JSON.parse(readFileSync(playersPath, 'utf-8'));

  // Load league info
  const leaguePath = join(cacheDir, 'league.json');
  let league = {};
  if (existsSync(leaguePath)) {
    league = JSON.parse(readFileSync(leaguePath, 'utf-8'));
  }

  // Load matchups data for performance metrics (optional)
  const matchupsAllYearsPath = join(cacheDir, 'matchups-all-years.json');
  let matchupsAllYears = {};
  if (existsSync(matchupsAllYearsPath)) {
    matchupsAllYears = JSON.parse(readFileSync(matchupsAllYearsPath, 'utf-8'));
  }

  return { trades, rosters, users, players, league, matchupsAllYears };
}

/**
 * Generate a unique ID for a trade
 */
function generateTradeId(trade) {
  // Create a hash based on trade details to ensure uniqueness
  const tradeString = JSON.stringify({
    created: trade.created,
    adds: trade.adds,
    drops: trade.drops,
    draft_picks: trade.draft_picks,
    league_id: trade.league_id
  });
  return createHash('md5').update(tradeString).digest('hex').substring(0, 16);
}

/**
 * Calculate player performance metrics from historical data
 */
function getPlayerPerformanceMetrics(playerId, tradeYear, tradeWeek, matchupsAllYears) {
  if (!matchupsAllYears || Object.keys(matchupsAllYears).length === 0) {
    return null;
  }

  const metrics = {
    preTradePoints: 0,
    preTradeGames: 0,
    postTradePoints: 0,
    postTradeGames: 0,
    preTradeAvg: 0,
    postTradeAvg: 0
  };

  // Get performance before and after the trade
  const allYears = Object.keys(matchupsAllYears).sort();

  allYears.forEach(year => {
    const yearData = matchupsAllYears[year];
    if (!yearData || !yearData.matchups) return;

    const yearInt = parseInt(year);
    const tradeYearInt = parseInt(tradeYear);

    yearData.matchups.forEach(weekData => {
      weekData.matchups.forEach(matchup => {
        if (matchup.players_points && matchup.players_points[playerId] !== undefined) {
          const points = matchup.players_points[playerId] || 0;

          // Determine if this is pre-trade or post-trade
          const isPreTrade = yearInt < tradeYearInt ||
            (yearInt === tradeYearInt && weekData.week <= tradeWeek);

          if (isPreTrade) {
            metrics.preTradePoints += points;
            metrics.preTradeGames++;
          } else {
            metrics.postTradePoints += points;
            metrics.postTradeGames++;
          }
        }
      });
    });
  });

  if (metrics.preTradeGames > 0) {
    metrics.preTradeAvg = metrics.preTradePoints / metrics.preTradeGames;
  }
  if (metrics.postTradeGames > 0) {
    metrics.postTradeAvg = metrics.postTradePoints / metrics.postTradeGames;
  }

  return metrics;
}

/**
 * Evaluate player age and career stage
 */
function evaluateCareerStage(age, yearsExp, position) {
  if (!age || age === 0) return 'Unknown';

  // Different positions have different prime windows
  const primeAges = {
    'QB': { early: 25, peak: 30, decline: 35 },
    'RB': { early: 22, peak: 25, decline: 28 },
    'WR': { early: 23, peak: 27, decline: 30 },
    'TE': { early: 24, peak: 28, decline: 32 },
    'K': { early: 25, peak: 30, decline: 37 },
    'DEF': { early: 23, peak: 27, decline: 30 }
  };

  const ranges = primeAges[position] || primeAges['WR'];

  if (age < ranges.early) return 'Developing';
  if (age < ranges.peak) return 'Entering Prime';
  if (age <= ranges.decline) return 'Prime Years';
  if (age <= ranges.decline + 2) return 'Declining';
  return 'Veteran/End of Career';
}

/**
 * Calculate positional value/scarcity
 */
function getPositionalValue(position) {
  const scarcity = {
    'QB': 'High volume, moderate scarcity',
    'RB': 'High value, significant scarcity',
    'WR': 'Deep position, moderate value',
    'TE': 'Top tier very scarce, elite premium',
    'K': 'Low value, highly replaceable',
    'DEF': 'Moderate value, streamable'
  };

  return scarcity[position] || 'Unknown value';
}

/**
 * Evaluate team context at time of trade
 */
function evaluateTeamContext(rosterId, rosters, week, season) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return 'Unknown';

  const wins = roster.settings?.wins || 0;
  const losses = roster.settings?.losses || 0;
  const totalGames = wins + losses;

  if (totalGames === 0) return 'Start of season';

  const winPct = wins / totalGames;

  // Determine if contending or rebuilding
  if (winPct >= 0.65) return 'Strong contender - win-now mode';
  if (winPct >= 0.50) return 'Playoff contender - competitive';
  if (winPct >= 0.35) return 'Middle of pack - unclear direction';
  return 'Rebuilding - future-focused';
}

/**
 * Process trade data for analysis
 */
function processTradeData(trade, users, players, rosters, matchupsAllYears) {
  // Get involved roster IDs
  const rosterIds = new Set([
    ...Object.values(trade.adds || {}),
    ...Object.values(trade.drops || {})
  ]);

  // Map roster IDs to user names
  const rosterMap = {};
  rosterIds.forEach(rosterId => {
    const user = users.find(u => u.user_id === rosterId || u.metadata?.roster_id === rosterId);
    rosterMap[rosterId] = user?.display_name || `Team ${rosterId}`;
  });

  // Find the actual trading parties (who owns the rosters)
  const participants = Array.from(rosterIds).map(rosterId => ({
    rosterId,
    userName: rosterMap[rosterId],
    context: evaluateTeamContext(rosterId, rosters, trade.week, trade.season)
  }));

  // Organize assets by side
  const sides = {};

  participants.forEach(participant => {
    sides[participant.rosterId] = {
      userName: participant.userName,
      teamContext: participant.context,
      receives: [],
      gives: []
    };
  });

  // Process player adds (what each side receives)
  if (trade.adds) {
    Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
      const player = players[playerId];
      if (player && sides[rosterId]) {
        const careerStage = evaluateCareerStage(player.age, player.years_exp, player.position);
        const positionalValue = getPositionalValue(player.position);
        const performanceMetrics = getPlayerPerformanceMetrics(
          playerId,
          trade.season,
          trade.week,
          matchupsAllYears
        );

        sides[rosterId].receives.push({
          name: `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          age: player.age,
          yearsExp: player.years_exp,
          careerStage,
          positionalValue,
          performanceMetrics
        });
      }
    });
  }

  // Process player drops (what each side gives)
  if (trade.drops) {
    Object.entries(trade.drops).forEach(([playerId, rosterId]) => {
      const player = players[playerId];
      if (player && sides[rosterId]) {
        const careerStage = evaluateCareerStage(player.age, player.years_exp, player.position);
        const positionalValue = getPositionalValue(player.position);
        const performanceMetrics = getPlayerPerformanceMetrics(
          playerId,
          trade.season,
          trade.week,
          matchupsAllYears
        );

        sides[rosterId].gives.push({
          name: `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          age: player.age,
          yearsExp: player.years_exp,
          careerStage,
          positionalValue,
          performanceMetrics
        });
      }
    });
  }

  // Process draft picks
  const draftPicks = [];
  if (trade.draft_picks && trade.draft_picks.length > 0) {
    trade.draft_picks.forEach(pick => {
      const fromUser = rosterMap[pick.previous_owner_id] || `Team ${pick.previous_owner_id}`;
      const toUser = rosterMap[pick.owner_id] || `Team ${pick.owner_id}`;

      draftPicks.push({
        season: pick.season,
        round: pick.round,
        from: fromUser,
        to: toUser
      });

      // Add to sides
      if (sides[pick.owner_id]) {
        sides[pick.owner_id].receives.push({
          name: `${pick.season} Round ${pick.round} pick`,
          position: 'PICK',
          from: fromUser
        });
      }
      if (sides[pick.previous_owner_id]) {
        sides[pick.previous_owner_id].gives.push({
          name: `${pick.season} Round ${pick.round} pick`,
          position: 'PICK'
        });
      }
    });
  }

  return {
    tradeId: generateTradeId(trade),
    week: trade.week,
    season: trade.season,
    created: new Date(trade.created).toLocaleString(),
    sides: Object.values(sides).filter(side => side.receives.length > 0 || side.gives.length > 0),
    draftPicks,
    participants: participants.map(p => p.userName)
  };
}

/**
 * Generate LLM analysis for a trade
 */
async function generateAnalysis(tradeData, persona) {
  const { sides, week, season, participants, draftPicks } = tradeData;

  // Build trade details text with enhanced metrics
  let tradeDetailsText = `TRADE DETAILS (Week ${week}, ${season} Season):\n\n`;

  sides.forEach((side, index) => {
    tradeDetailsText += `**${side.userName}** (${side.teamContext})\n`;

    if (side.receives.length > 0) {
      tradeDetailsText += `RECEIVES:\n`;
      side.receives.forEach(asset => {
        if (asset.position === 'PICK') {
          tradeDetailsText += `  - ${asset.name}${asset.from ? ` (from ${asset.from})` : ''}\n`;
        } else {
          tradeDetailsText += `  - ${asset.name} (${asset.position}, ${asset.team}`;
          if (asset.age) tradeDetailsText += `, Age ${asset.age}`;
          if (asset.yearsExp !== undefined) tradeDetailsText += `, ${asset.yearsExp} yrs exp`;
          tradeDetailsText += `)\n`;

          // Add career stage analysis
          if (asset.careerStage) {
            tradeDetailsText += `    Career Stage: ${asset.careerStage}\n`;
          }

          // Add positional value context
          if (asset.positionalValue) {
            tradeDetailsText += `    Position Value: ${asset.positionalValue}\n`;
          }

          // Add performance metrics if available
          if (asset.performanceMetrics && asset.performanceMetrics.preTradeGames > 0) {
            tradeDetailsText += `    Pre-Trade Performance: ${asset.performanceMetrics.preTradeAvg.toFixed(1)} PPG (${asset.performanceMetrics.preTradeGames} games)\n`;

            if (asset.performanceMetrics.postTradeGames > 0) {
              const diff = asset.performanceMetrics.postTradeAvg - asset.performanceMetrics.preTradeAvg;
              const direction = diff > 0 ? '+' : '';
              tradeDetailsText += `    Post-Trade Performance: ${asset.performanceMetrics.postTradeAvg.toFixed(1)} PPG (${asset.performanceMetrics.postTradeGames} games) - ${direction}${diff.toFixed(1)} PPG\n`;
            }
          }
        }
      });
    }

    if (side.gives.length > 0) {
      tradeDetailsText += `GIVES UP:\n`;
      side.gives.forEach(asset => {
        if (asset.position === 'PICK') {
          tradeDetailsText += `  - ${asset.name}\n`;
        } else {
          tradeDetailsText += `  - ${asset.name} (${asset.position}, ${asset.team}`;
          if (asset.age) tradeDetailsText += `, Age ${asset.age}`;
          if (asset.yearsExp !== undefined) tradeDetailsText += `, ${asset.yearsExp} yrs exp`;
          tradeDetailsText += `)\n`;

          // Add career stage analysis
          if (asset.careerStage) {
            tradeDetailsText += `    Career Stage: ${asset.careerStage}\n`;
          }

          // Add positional value context
          if (asset.positionalValue) {
            tradeDetailsText += `    Position Value: ${asset.positionalValue}\n`;
          }

          // Add performance metrics if available
          if (asset.performanceMetrics && asset.performanceMetrics.preTradeGames > 0) {
            tradeDetailsText += `    Pre-Trade Performance: ${asset.performanceMetrics.preTradeAvg.toFixed(1)} PPG (${asset.performanceMetrics.preTradeGames} games)\n`;

            if (asset.performanceMetrics.postTradeGames > 0) {
              const diff = asset.performanceMetrics.postTradeAvg - asset.performanceMetrics.preTradeAvg;
              const direction = diff > 0 ? '+' : '';
              tradeDetailsText += `    Post-Trade Performance: ${asset.performanceMetrics.postTradeAvg.toFixed(1)} PPG (${asset.performanceMetrics.postTradeGames} games) - ${direction}${diff.toFixed(1)} PPG\n`;
            }
          }
        }
      });
    }

    tradeDetailsText += '\n';
  });

  // Add variety instructions
  const varietyInstructions = [
    "Give both managers a creative nickname based on their trading style",
    "Make a bold prediction about how this trade will look in 2 years",
    "Compare this trade to a famous real NFL trade",
    "Identify a clear 'winner' and 'loser' (or declare it even)",
    "Create a dramatic storyline or rivalry angle",
    "Reference the timing and context of when this trade happened in the season",
    "Evaluate the value and risk profile of each side"
  ];

  // Randomly select 3-4 special instructions
  const selectedCount = 3 + Math.floor(Math.random() * 2); // 3 or 4
  const shuffled = [...varietyInstructions].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, selectedCount);

  const prompt = `You are ${persona.name}, the legendary NFL analyst. Analyze this fantasy football trade in your signature style.

${tradeDetailsText}

Write a 3-4 paragraph analysis in ${persona.name}'s style: ${persona.style}

Focus on what ${persona.name} emphasizes: ${persona.emphasis.join(', ')}

SPECIAL INSTRUCTIONS:
${selected.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}

Keep it entertaining and insightful. Evaluate the players involved, the value exchanged, and potential implications. Use ${persona.name}'s actual catchphrases and speaking style. Make it feel like ${persona.name} is breaking down this trade for fans.

Return ONLY the analysis text, no preamble or meta-commentary.`;

  console.log(`🤖 Generating analysis for ${participants.join(' vs ')} as ${persona.name}...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    temperature: 1.0,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return message.content[0].text;
}

/**
 * Save analysis to JSON file
 */
function saveAnalysis(tradeData, persona, analysis) {
  const outputDir = join(__dirname, 'trade-summaries');

  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const data = {
    tradeId: tradeData.tradeId,
    week: tradeData.week,
    season: tradeData.season,
    leagueId: LEAGUE_ID,
    participants: tradeData.participants,
    persona: persona.name,
    analysis,
    generatedAt: new Date().toISOString()
  };

  const outputPath = join(outputDir, `trade-${tradeData.tradeId}.json`);
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`✅ Saved analysis to ${outputPath}`);
}

/**
 * Check if analysis already exists
 */
function analysisExists(tradeId) {
  const outputPath = join(__dirname, 'trade-summaries', `trade-${tradeId}.json`);
  return existsSync(outputPath);
}

/**
 * Get list of existing analysis IDs
 */
function getExistingAnalysisIds() {
  const outputDir = join(__dirname, 'trade-summaries');
  if (!existsSync(outputDir)) {
    return new Set();
  }

  const files = readdirSync(outputDir);
  const ids = new Set();

  files.forEach(file => {
    if (file.startsWith('trade-') && file.endsWith('.json')) {
      const id = file.replace('trade-', '').replace('.json', '');
      ids.add(id);
    }
  });

  return ids;
}

/**
 * Main execution
 */
async function main() {
  console.log('🏈 Trade Analysis Generator');
  console.log('===========================\n');

  // Load data
  console.log('📊 Loading data...');
  const { trades, rosters, users, players, league, matchupsAllYears } = await loadData();
  console.log(`✅ Loaded ${trades.length} trades\n`);

  // Process all trades with enhanced metrics
  const processedTrades = trades.map(trade =>
    processTradeData(trade, users, players, rosters, matchupsAllYears)
  );

  // Filter trades that need analysis
  const existingIds = getExistingAnalysisIds();
  const tradesToAnalyze = processedTrades.filter(trade => !existingIds.has(trade.tradeId));

  if (tradesToAnalyze.length === 0) {
    console.log('✅ All trades already have analysis!');
    console.log('💡 Delete files from src/data/trade-summaries/ to regenerate');
    return;
  }

  console.log(`📝 Generating analysis for ${tradesToAnalyze.length} trade(s)...\n`);

  // Process each trade
  for (const tradeData of tradesToAnalyze) {
    // Select random persona
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    // Generate analysis
    try {
      const analysis = await generateAnalysis(tradeData, persona);

      // Save to file
      saveAnalysis(tradeData, persona, analysis);

      console.log(`   Persona: ${persona.name}`);
      console.log(`   Participants: ${tradeData.participants.join(' vs ')}`);
      console.log(`   Preview: ${analysis.substring(0, 100)}...\n`);

      // Rate limiting - wait 1 second between requests
      if (tradesToAnalyze.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Error generating analysis for trade ${tradeData.tradeId}:`, error.message);
    }
  }

  console.log('\n✨ Trade analysis generation complete!');
  console.log('📁 Analysis saved to: src/data/trade-summaries/');
  console.log('💡 Remember to commit these files to your repo!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
