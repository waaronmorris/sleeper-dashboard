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
import { getTradePersonas, getActiveRegion } from './personas.js';
import { createTokenLogger } from './token-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FETCH_REAL_WORLD_CONTEXT = process.env.FETCH_REAL_WORLD_CONTEXT === 'true'; // Enable with FETCH_REAL_WORLD_CONTEXT=true
const LEAGUE_TYPE = process.env.LEAGUE_TYPE || 'dynasty'; // 'dynasty' or 'redraft'
const CLAUDE_MODEL = 'claude-sonnet-4-5';

if (!LEAGUE_ID) {
  console.error('❌ Error: SLEEPER_LEAGUE_ID environment variable not set');
  console.error('Please add your Sleeper league ID to .env file:');
  console.error('SLEEPER_LEAGUE_ID=your_league_id');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
  console.error('Please add your Anthropic API key to .env file:');
  console.error('ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// Get personas from shared config based on COMMENTATOR_REGION environment variable
const PERSONAS = getTradePersonas();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Initialize token logger for cost tracking
const tokenLogger = createTokenLogger({ model: CLAUDE_MODEL, script: 'generate-trade-analysis' });

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

  // Load power rankings data (optional)
  const powerRankingsPath = join(cacheDir, 'power-rankings.json');
  let powerRankings = null;
  if (existsSync(powerRankingsPath)) {
    powerRankings = JSON.parse(readFileSync(powerRankingsPath, 'utf-8'));
  }

  // Load draft picks for context (optional)
  const draftPicksPath = join(cacheDir, 'draft-picks.json');
  let draftPicks = [];
  if (existsSync(draftPicksPath)) {
    draftPicks = JSON.parse(readFileSync(draftPicksPath, 'utf-8'));
  }

  // Load VOR snapshots for historical trade analysis
  const vorSnapshotsPath = join(cacheDir, 'vor-snapshots.json');
  let vorSnapshots = null;
  if (existsSync(vorSnapshotsPath)) {
    vorSnapshots = JSON.parse(readFileSync(vorSnapshotsPath, 'utf-8'));
  }

  return { trades, rosters, users, players, league, matchupsAllYears, powerRankings, draftPicks, vorSnapshots };
}

/**
 * Fetch ROS (Rest of Season) projections from Sleeper for a specific week
 * This allows historical trades to use projections from the trade week, not current week
 * @param {string} season - NFL season year (e.g., "2024")
 * @param {number} fromWeek - Starting week for ROS projections
 * @returns {Map} Map of playerId -> { rosPoints, weeklyProjections }
 */
async function fetchTradeWeekProjections(season, fromWeek) {
  try {
    const projections = new Map();
    const endWeek = 18;

    // Validate week range
    const startWeek = Math.max(1, Math.min(fromWeek, endWeek));

    console.error(`📊 Fetching ROS projections for ${season} weeks ${startWeek}-${endWeek}...`);

    // Fetch projections for remaining weeks (fromWeek through 18)
    const weekPromises = [];
    for (let week = startWeek; week <= endWeek; week++) {
      weekPromises.push(
        fetch(`https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular`)
          .then(r => r.ok ? r.json() : [])
          .then(data => ({ week, data }))
          .catch(() => ({ week, data: [] }))
      );
    }

    const weekResults = await Promise.all(weekPromises);

    // Aggregate projections - sum remaining weeks for ROS projection
    weekResults.forEach(({ week, data }) => {
      if (!Array.isArray(data)) return;

      data.forEach(proj => {
        const playerId = proj.player?.player_id || proj.player_id;
        if (!playerId) return;

        const pts = proj.stats?.pts_ppr || proj.stats?.pts_half_ppr || 0;

        const existing = projections.get(playerId) || {
          rosPoints: 0,
          weeklyProjections: {},
          weeksRemaining: endWeek - startWeek + 1
        };

        existing.rosPoints += pts;
        existing.weeklyProjections[week] = pts;
        projections.set(playerId, existing);
      });
    });

    console.error(`✅ Loaded ${projections.size} player projections for weeks ${startWeek}-${endWeek}`);
    return projections;
  } catch (error) {
    console.error(`⚠️ Failed to fetch trade week projections: ${error.message}`);
    return new Map();
  }
}

/**
 * Get VOR scarcity multipliers appropriate for a specific trade week/season
 * Uses historical snapshots if available, falls back to season-phase defaults
 * @param {Object} vorSnapshots - Loaded VOR snapshots data
 * @param {string} tradeSeason - Season of the trade
 * @param {number} tradeWeek - Week of the trade
 * @param {boolean} isSF - Is Superflex league
 * @returns {Object} Scarcity multipliers and source info
 */
function getVorScarcityForTrade(vorSnapshots, tradeSeason, tradeWeek, isSF) {
  // Static fallback values
  const standardFallback = { QB: 80, RB: 150, WR: 100, TE: 120, K: 20, DEF: 25 };
  const sfFallback = { QB: 140, RB: 150, WR: 100, TE: 120, K: 20, DEF: 25 };
  const baseFallback = isSF ? sfFallback : standardFallback;

  if (!vorSnapshots?.snapshots || vorSnapshots.snapshots.length === 0) {
    // Use season phase adjustments
    const phaseAdjusted = { ...baseFallback };

    if (tradeWeek <= 3) {
      // Early season - RBs more valuable (injury uncertainty)
      phaseAdjusted.RB = Math.round(phaseAdjusted.RB * 1.1);
    } else if (tradeWeek >= 10 && tradeWeek <= 13) {
      // Playoff push
      phaseAdjusted.TE = Math.round(phaseAdjusted.TE * 1.1);
    } else if (tradeWeek >= 14) {
      // Playoffs
      phaseAdjusted.QB = Math.round(phaseAdjusted.QB * 1.1);
    }

    return {
      multipliers: phaseAdjusted,
      source: 'season-phase-fallback',
      accuracy: 'estimated'
    };
  }

  // Look for exact match
  const exactMatch = vorSnapshots.snapshots.find(s =>
    s.season === tradeSeason && s.week === tradeWeek
  );

  if (exactMatch) {
    return {
      multipliers: exactMatch.scarcityMultipliers,
      source: 'exact-snapshot',
      accuracy: 'high',
      snapshotDate: exactMatch.capturedAt
    };
  }

  // Look for closest week in same season
  const sameSeasonSnapshots = vorSnapshots.snapshots
    .filter(s => s.season === tradeSeason)
    .sort((a, b) => Math.abs(a.week - tradeWeek) - Math.abs(b.week - tradeWeek));

  if (sameSeasonSnapshots.length > 0) {
    const closest = sameSeasonSnapshots[0];
    const weekDiff = Math.abs(closest.week - tradeWeek);

    return {
      multipliers: closest.scarcityMultipliers,
      source: 'closest-snapshot',
      accuracy: weekDiff <= 2 ? 'high' : 'moderate',
      weekDifference: weekDiff,
      snapshotWeek: closest.week,
      snapshotDate: closest.capturedAt
    };
  }

  // Use current snapshot if available (better than nothing)
  if (vorSnapshots.currentSnapshot?.scarcityMultipliers) {
    return {
      multipliers: vorSnapshots.currentSnapshot.scarcityMultipliers,
      source: 'current-snapshot',
      accuracy: 'low',
      note: 'Using current VOR values for historical trade'
    };
  }

  return {
    multipliers: baseFallback,
    source: 'static-fallback',
    accuracy: 'estimated'
  };
}

/**
 * Analyze manager's trading history and patterns
 */
function analyzeManagerTradingHistory(rosterId, allTrades, currentTradeTimestamp, users, rosters) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  const ownerId = roster?.owner_id;
  const user = ownerId ? users.find(u => u.user_id === ownerId) : null;
  const managerName = user?.display_name || user?.username || `Team ${rosterId}`;

  // Find all trades this manager has been involved in
  const managerTrades = allTrades.filter(trade => {
    const involvedRosters = new Set([
      ...Object.values(trade.adds || {}),
      ...Object.values(trade.drops || {})
    ]);
    return involvedRosters.has(rosterId);
  });

  // Trades before this one
  const priorTrades = managerTrades.filter(t => t.created < currentTradeTimestamp);
  const tradesThisSeason = priorTrades.filter(t => t.season === managerTrades.find(mt => mt.created === currentTradeTimestamp)?.season);

  // Analyze trading patterns
  let playersBought = 0;
  let playersSold = 0;
  let picksAcquired = 0;
  let picksSold = 0;

  priorTrades.forEach(trade => {
    // Count players received vs given
    Object.entries(trade.adds || {}).forEach(([playerId, receivingRoster]) => {
      if (receivingRoster === rosterId) playersBought++;
    });
    Object.entries(trade.drops || {}).forEach(([playerId, givingRoster]) => {
      if (givingRoster === rosterId) playersSold++;
    });
    // Count picks
    (trade.draft_picks || []).forEach(pick => {
      if (pick.owner_id === rosterId) picksAcquired++;
      if (pick.previous_owner_id === rosterId) picksSold++;
    });
  });

  // Determine trading style
  let tradingStyle = 'balanced';
  if (playersBought > playersSold * 1.5) tradingStyle = 'aggressive buyer';
  else if (playersSold > playersBought * 1.5) tradingStyle = 'seller/rebuilder';
  if (picksAcquired > picksSold * 2) tradingStyle = 'future-focused (stockpiling picks)';
  else if (picksSold > picksAcquired * 2) tradingStyle = 'win-now (selling picks for talent)';

  return {
    managerName,
    totalTradesAllTime: managerTrades.length,
    tradesThisSeason: tradesThisSeason.length,
    tradeRank: priorTrades.length + 1, // This is their Nth trade
    playersBought,
    playersSold,
    picksAcquired,
    picksSold,
    tradingStyle,
    isActiveTrador: managerTrades.length >= 5
  };
}

/**
 * Get team record and standings at time of trade
 */
function getTeamStandingsAtTrade(rosterId, tradeWeek, tradeSeason, matchupsAllYears, rosters) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return null;

  // Get current record from roster settings
  const currentWins = roster.settings?.wins || 0;
  const currentLosses = roster.settings?.losses || 0;
  const currentPointsFor = (roster.settings?.fpts || 0) + ((roster.settings?.fpts_decimal || 0) / 100);

  // Calculate record at time of trade from matchups
  let winsAtTrade = 0;
  let lossesAtTrade = 0;
  let pointsAtTrade = 0;

  const seasonData = matchupsAllYears[tradeSeason];
  if (seasonData && seasonData.matchups) {
    seasonData.matchups.forEach(weekData => {
      if (weekData.week < tradeWeek) {
        const teamMatchup = weekData.matchups.find(m => m.roster_id === rosterId);
        if (teamMatchup) {
          const matchId = teamMatchup.matchup_id;
          const opponent = weekData.matchups.find(m => m.matchup_id === matchId && m.roster_id !== rosterId);

          if (opponent) {
            if (teamMatchup.points > opponent.points) winsAtTrade++;
            else if (teamMatchup.points < opponent.points) lossesAtTrade++;
          }
          pointsAtTrade += teamMatchup.points || 0;
        }
      }
    });
  }

  const totalGames = winsAtTrade + lossesAtTrade;
  const winPct = totalGames > 0 ? winsAtTrade / totalGames : 0;

  // Determine playoff position/status
  let playoffStatus = 'unknown';
  if (totalGames >= 4) {
    if (winPct >= 0.7) playoffStatus = 'playoff lock';
    else if (winPct >= 0.5) playoffStatus = 'playoff contender';
    else if (winPct >= 0.35) playoffStatus = 'on the bubble';
    else playoffStatus = 'likely eliminated';
  }

  return {
    winsAtTrade,
    lossesAtTrade,
    recordAtTrade: `${winsAtTrade}-${lossesAtTrade}`,
    winPctAtTrade: Math.round(winPct * 100),
    pointsAtTrade: Math.round(pointsAtTrade * 10) / 10,
    currentRecord: `${currentWins}-${currentLosses}`,
    currentPointsFor: Math.round(currentPointsFor * 10) / 10,
    playoffStatus,
    gamesPlayed: totalGames
  };
}

/**
 * Get head-to-head history between two teams
 */
function getHeadToHeadHistory(roster1Id, roster2Id, matchupsAllYears) {
  let team1Wins = 0;
  let team2Wins = 0;
  let ties = 0;
  const matchups = [];

  Object.entries(matchupsAllYears).forEach(([season, seasonData]) => {
    if (!seasonData.matchups) return;

    seasonData.matchups.forEach(weekData => {
      const team1Match = weekData.matchups.find(m => m.roster_id === roster1Id);
      const team2Match = weekData.matchups.find(m => m.roster_id === roster2Id);

      if (team1Match && team2Match && team1Match.matchup_id === team2Match.matchup_id) {
        // They played each other this week!
        const result = {
          season,
          week: weekData.week,
          team1Score: team1Match.points,
          team2Score: team2Match.points
        };
        matchups.push(result);

        if (team1Match.points > team2Match.points) team1Wins++;
        else if (team2Match.points > team1Match.points) team2Wins++;
        else ties++;
      }
    });
  });

  return {
    team1Wins,
    team2Wins,
    ties,
    totalMatchups: matchups.length,
    recentMatchups: matchups.slice(-3), // Last 3 matchups
    isRivalry: matchups.length >= 4 && Math.abs(team1Wins - team2Wins) <= 2
  };
}

/**
 * Analyze season timing and context
 */
function analyzeSeasonContext(tradeWeek, tradeSeason, league) {
  const playoffStartWeek = league.settings?.playoff_week_start || 15;
  const regularSeasonWeeks = playoffStartWeek - 1;

  let seasonPhase = 'unknown';
  let urgency = 'normal';
  let strategicContext = '';

  if (tradeWeek <= 3) {
    seasonPhase = 'early season';
    strategicContext = 'Small sample size - basing decisions on projections more than results';
    urgency = 'low';
  } else if (tradeWeek <= 6) {
    seasonPhase = 'early-mid season';
    strategicContext = 'Trends emerging but still time to course correct';
    urgency = 'moderate';
  } else if (tradeWeek <= 9) {
    seasonPhase = 'mid season';
    strategicContext = 'Clear picture of contenders vs pretenders forming';
    urgency = 'moderate';
  } else if (tradeWeek <= 12) {
    seasonPhase = 'late season push';
    strategicContext = 'Playoff positioning critical - win-now moves expected';
    urgency = 'high';
  } else if (tradeWeek < playoffStartWeek) {
    seasonPhase = 'playoff positioning';
    strategicContext = 'Final roster moves before playoffs - desperation trades possible';
    urgency = 'very high';
  } else {
    seasonPhase = 'playoffs';
    strategicContext = LEAGUE_TYPE === 'dynasty'
      ? 'Trading during playoffs - unusual, dynasty-focused move'
      : 'Trading during playoffs - unusual timing, must be addressing critical need';
    urgency = 'strategic';
  }

  return {
    seasonPhase,
    tradeWeek,
    playoffStartWeek,
    weeksUntilPlayoffs: Math.max(0, playoffStartWeek - tradeWeek),
    urgency,
    strategicContext,
    isTradeDeadlinePeriod: tradeWeek >= regularSeasonWeeks - 2 && tradeWeek < playoffStartWeek
  };
}

/**
 * Get league-wide trade context
 */
function getLeagueTradeContext(currentTrade, allTrades, powerRankings) {
  const sameSeason = allTrades.filter(t => t.season === currentTrade.season);
  const beforeThis = sameSeason.filter(t => t.created < currentTrade.created);

  // Calculate average trade size
  let totalPlayersTraded = 0;
  sameSeason.forEach(trade => {
    totalPlayersTraded += Object.keys(trade.adds || {}).length;
  });
  const avgPlayersPerTrade = sameSeason.length > 0 ? totalPlayersTraded / sameSeason.length : 0;

  // Find biggest trade by player count
  const biggestTrade = sameSeason.reduce((max, trade) => {
    const size = Object.keys(trade.adds || {}).length;
    return size > (max?.size || 0) ? { trade, size } : max;
  }, null);

  // Get power ranking context
  let leaderName = '';
  let lastPlaceName = '';
  if (powerRankings?.rankings?.length > 0) {
    const sorted = [...powerRankings.rankings].sort((a, b) => b.powerScore - a.powerScore);
    leaderName = sorted[0]?.teamName || '';
    lastPlaceName = sorted[sorted.length - 1]?.teamName || '';
  }

  return {
    totalTradesThisSeason: sameSeason.length,
    tradeNumberThisSeason: beforeThis.length + 1,
    avgPlayersPerTrade: Math.round(avgPlayersPerTrade * 10) / 10,
    isBiggestTradeOfSeason: biggestTrade?.trade?.created === currentTrade.created,
    leagueLeader: leaderName,
    lastPlace: lastPlaceName,
    leagueIsActive: sameSeason.length >= 10
  };
}

/**
 * Analyze player value trajectory (rising/falling)
 */
function analyzePlayerTrajectory(playerId, player, powerRankings) {
  if (!powerRankings?.playerValues?.[playerId]) return null;

  const playerValue = powerRankings.playerValues[playerId];
  const age = player.age || 0;
  const position = player.position;

  // Position-specific value curves
  const peakAges = {
    'QB': { peak: 29, decline: 35, longevity: 'high' },
    'RB': { peak: 25, decline: 28, longevity: 'low' },
    'WR': { peak: 27, decline: 30, longevity: 'medium' },
    'TE': { peak: 28, decline: 32, longevity: 'medium' }
  };

  const curve = peakAges[position] || { peak: 27, decline: 30, longevity: 'medium' };

  let trajectory = 'stable';
  let valueOutlook = '';

  if (age < curve.peak - 2) {
    trajectory = 'rising';
    valueOutlook = 'Value likely to increase as player enters prime';
  } else if (age < curve.peak) {
    trajectory = 'approaching peak';
    valueOutlook = 'Nearing peak production years';
  } else if (age <= curve.decline) {
    trajectory = 'peak years';
    valueOutlook = 'In prime production window';
  } else if (age <= curve.decline + 2) {
    trajectory = 'declining';
    valueOutlook = 'Production likely to decrease - sell window may be closing';
  } else {
    trajectory = 'late career';
    valueOutlook = 'Limited remaining fantasy value - high bust risk';
  }

  return {
    currentValue: playerValue.value,
    trajectory,
    valueOutlook,
    ageVsPeak: age - curve.peak,
    yearsUntilDecline: Math.max(0, curve.decline - age),
    positionLongevity: curve.longevity
  };
}

/**
 * Fetch real-world context for players via web search
 */
async function fetchPlayerRealWorldContext(playerNames, tradeDate) {
  const contexts = [];

  for (const playerName of playerNames.slice(0, 4)) { // Limit to top 4 players to avoid rate limits
    try {
      // Search for recent news about the player
      const searchQuery = `${playerName} NFL fantasy football news ${new Date(tradeDate).getFullYear()}`;

      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Based on your knowledge, provide a brief 2-3 sentence summary of ${playerName}'s NFL situation focusing on these key questions:
1. Are they the PRIMARY STARTER or a BACKUP filling in for an injured player? If backup, who is injured and when are they expected back?
2. Is their current production level sustainable, or is it temporary due to circumstances (injury to starter, other players out, favorable schedule)?
3. Any recent performance trends, injuries, or fantasy-relevant news.

Focus on facts that affect their FUTURE fantasy production, not just recent stats. Be explicit about starter vs backup status.`
        }]
      });

      // Log token usage for cost monitoring
      tokenLogger.log('fetch-player-context', response.usage, { player: playerName });

      contexts.push({
        player: playerName,
        context: response.content[0].text
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to fetch context for ${playerName}:`, error.message);
      contexts.push({
        player: playerName,
        context: 'Context unavailable'
      });
    }
  }

  return contexts;
}

/**
 * Get player's original draft position for context
 */
function getPlayerDraftContext(playerId, playerName, draftPicksData) {
  // Handle different data structures - draftPicksData may be object keyed by year or array
  let allPicks = [];

  if (Array.isArray(draftPicksData)) {
    allPicks = draftPicksData;
  } else if (draftPicksData && typeof draftPicksData === 'object') {
    // Object keyed by year (e.g., { "2022": { picks: [...] }, "2023": { picks: [...] } })
    Object.entries(draftPicksData).forEach(([year, yearData]) => {
      if (yearData?.picks && Array.isArray(yearData.picks)) {
        yearData.picks.forEach(pick => {
          allPicks.push({ ...pick, season: year });
        });
      }
    });
  }

  // Look for when this player was drafted
  const pick = allPicks.find(p => p.player_id === playerId);

  if (pick) {
    return {
      wasDrafted: true,
      draftYear: pick.season,
      round: pick.round,
      pickNumber: pick.pick_no,
      draftedBy: pick.roster_id,
      draftContext: `Drafted in round ${pick.round} (pick ${pick.pick_no}) in ${pick.season}`
    };
  }

  return {
    wasDrafted: false,
    draftContext: 'Undrafted or acquired via waivers'
  };
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
 * Get team power score data from power rankings
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
    lineupValueScore: teamRanking.lineupValueScore,
    performanceScore: teamRanking.performanceScore,
    positionalScore: teamRanking.positionalScore,
    depthScore: teamRanking.depthScore,
    totalTeams: powerRankings.rankings.length,
    totalRosterValue: teamRanking.totalRosterValue
  };
}

/**
 * Get player projection context for trade analysis
 * Compares historical PPG to projected PPG to identify role changes
 * Returns null if projection data is not available
 */
function getPlayerProjectionContext(playerId, tradeWeek, performanceMetrics, powerRankings) {
  const playerValue = powerRankings?.playerValues?.[playerId];
  const remainingWeeks = Math.max(1, 18 - (tradeWeek || 1));

  // Check if we have actual projection data (rosProjection must exist and be > 0)
  // If rosProjection is undefined or 0, we don't have valid projection data
  const hasProjectionData = playerValue?.rosProjection !== undefined && playerValue.rosProjection > 0;

  if (!hasProjectionData) {
    // No projection data available - return null to indicate missing data
    // This prevents false "projected at 0 PPG" alerts
    return null;
  }

  const rosProjection = playerValue.rosProjection;
  const projectedPPG = rosProjection / remainingWeeks;
  const historicalPPG = performanceMetrics?.preTradeAvg || 0;
  const ppgDelta = historicalPPG - projectedPPG;

  // Determine role alert based on delta - only when we have valid projection data
  let roleAlert = null;
  if (historicalPPG > 15 && projectedPPG < 5) {
    roleAlert = 'LIKELY BACKUP/FILL-IN - Production expected to drop significantly';
  } else if (ppgDelta > 10) {
    roleAlert = 'DECLINING ROLE - Large gap between historical and projected production';
  } else if (ppgDelta > 5) {
    roleAlert = 'REDUCED ROLE - Projected production below recent performance';
  } else if (ppgDelta < -5) {
    roleAlert = 'RISING ROLE - Projected production exceeds recent performance';
  }

  return {
    rosProjection: Math.round(rosProjection * 10) / 10,
    projectedPPG: Math.round(projectedPPG * 10) / 10,
    ppgDelta: Math.round(ppgDelta * 10) / 10,
    remainingWeeks,
    roleAlert,
    hasProjectionData: true
  };
}

/**
 * Calculate estimated power score change from a trade
 * Uses player dynasty values to estimate impact on lineup value score
 */
function calculateTradeImpact(rosterId, trade, powerRankings) {
  if (!powerRankings || !powerRankings.playerValues || !powerRankings.maxLineupValue) {
    return null;
  }

  const playerValues = powerRankings.playerValues;
  let valueGained = 0;
  let valueLost = 0;
  const playersGained = [];
  const playersLost = [];

  // Calculate value of players received
  if (trade.adds) {
    Object.entries(trade.adds).forEach(([playerId, receivingRosterId]) => {
      if (receivingRosterId === rosterId && playerValues[playerId]) {
        valueGained += playerValues[playerId].value || 0;
        playersGained.push({
          name: playerValues[playerId].name,
          value: playerValues[playerId].value
        });
      }
    });
  }

  // Calculate value of players given up
  if (trade.drops) {
    Object.entries(trade.drops).forEach(([playerId, givingRosterId]) => {
      if (givingRosterId === rosterId && playerValues[playerId]) {
        valueLost += playerValues[playerId].value || 0;
        playersLost.push({
          name: playerValues[playerId].name,
          value: playerValues[playerId].value
        });
      }
    });
  }

  const netValueChange = valueGained - valueLost;

  // Estimate power score change
  // Lineup value is 50% of power score, and is normalized against max lineup value
  const lineupValueImpact = (netValueChange / powerRankings.maxLineupValue) * 100 * 0.50;

  return {
    valueGained,
    valueLost,
    netValueChange,
    estimatedPowerScoreChange: Math.round(lineupValueImpact * 10) / 10,
    playersGained,
    playersLost
  };
}

/**
 * Process trade data for analysis with rich context
 */
function processTradeData(trade, users, players, rosters, matchupsAllYears, powerRankings, allTrades, league, draftPicksData) {
  // Get involved roster IDs
  const rosterIds = new Set([
    ...Object.values(trade.adds || {}),
    ...Object.values(trade.drops || {})
  ]);

  // Map roster IDs to user names by looking up roster -> owner_id -> user
  const rosterMap = {};
  rosterIds.forEach(rosterId => {
    // Find the roster to get the owner_id
    const roster = rosters.find(r => r.roster_id === rosterId);
    const ownerId = roster?.owner_id;

    // Find the user by owner_id
    const user = ownerId ? users.find(u => u.user_id === ownerId) : null;
    rosterMap[rosterId] = user?.display_name || user?.username || `Team ${rosterId}`;
  });

  // Get roster IDs as array for head-to-head analysis
  const rosterIdArray = Array.from(rosterIds);

  // === NEW CONTEXT DATA ===

  // Season timing context
  const seasonContext = analyzeSeasonContext(trade.week, trade.season, league);

  // League-wide trade context
  const leagueContext = getLeagueTradeContext(trade, allTrades, powerRankings);

  // Head-to-head history (if 2-team trade)
  let headToHead = null;
  if (rosterIdArray.length === 2) {
    headToHead = getHeadToHeadHistory(rosterIdArray[0], rosterIdArray[1], matchupsAllYears);
  }

  // Find the actual trading parties with enhanced context
  const participants = Array.from(rosterIds).map(rosterId => {
    // Manager trading history
    const managerHistory = analyzeManagerTradingHistory(rosterId, allTrades, trade.created, users, rosters);

    // Team standings at time of trade
    const standings = getTeamStandingsAtTrade(rosterId, trade.week, trade.season, matchupsAllYears, rosters);

    return {
      rosterId,
      userName: rosterMap[rosterId],
      context: evaluateTeamContext(rosterId, rosters, trade.week, trade.season),
      powerScore: getTeamPowerScore(rosterId, powerRankings),
      tradeImpact: calculateTradeImpact(rosterId, trade, powerRankings),
      managerHistory,
      standings
    };
  });

  // Organize assets by side with enhanced context
  const sides = {};

  participants.forEach(participant => {
    sides[participant.rosterId] = {
      userName: participant.userName,
      teamContext: participant.context,
      powerScore: participant.powerScore,
      tradeImpact: participant.tradeImpact,
      managerHistory: participant.managerHistory,
      standings: participant.standings,
      receives: [],
      gives: []
    };
  });

  // Process player adds (what each side receives) with enhanced trajectory data
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
        const trajectory = analyzePlayerTrajectory(playerId, player, powerRankings);
        const draftContext = getPlayerDraftContext(playerId, `${player.first_name} ${player.last_name}`, draftPicksData);
        const projectionContext = getPlayerProjectionContext(playerId, trade.week, performanceMetrics, powerRankings);

        sides[rosterId].receives.push({
          playerId,
          name: `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          age: player.age,
          yearsExp: player.years_exp,
          careerStage,
          positionalValue,
          performanceMetrics,
          trajectory,
          draftContext,
          projectionContext
        });
      }
    });
  }

  // Process player drops (what each side gives) with enhanced trajectory data
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
        const trajectory = analyzePlayerTrajectory(playerId, player, powerRankings);
        const draftContext = getPlayerDraftContext(playerId, `${player.first_name} ${player.last_name}`, draftPicksData);
        const projectionContext = getPlayerProjectionContext(playerId, trade.week, performanceMetrics, powerRankings);

        sides[rosterId].gives.push({
          playerId,
          name: `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          age: player.age,
          yearsExp: player.years_exp,
          careerStage,
          positionalValue,
          performanceMetrics,
          trajectory,
          draftContext,
          projectionContext
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

  // Collect all player names for real-world context lookup
  const allPlayerNames = [];
  Object.values(sides).forEach(side => {
    side.receives.forEach(p => { if (p.position !== 'PICK') allPlayerNames.push(p.name); });
    side.gives.forEach(p => { if (p.position !== 'PICK') allPlayerNames.push(p.name); });
  });

  return {
    tradeId: generateTradeId(trade),
    week: trade.week,
    season: trade.season,
    created: new Date(trade.created).toLocaleString(),
    createdTimestamp: trade.created,
    sides: Object.values(sides).filter(side => side.receives.length > 0 || side.gives.length > 0),
    draftPicks,
    participants: participants.map(p => p.userName),
    // NEW CONTEXT DATA
    seasonContext,
    leagueContext,
    headToHead,
    allPlayerNames
  };
}

/**
 * Generate LLM analysis for a trade with comprehensive context
 */
async function generateAnalysis(tradeData, persona, realWorldContext = []) {
  const { sides, week, season, participants, draftPicks, seasonContext, leagueContext, headToHead, allPlayerNames, tradeWeekContext } = tradeData;

  // ============ BUILD COMPREHENSIVE CONTEXT ============

  // 1. TRADE HEADER
  let promptText = `=== FANTASY FOOTBALL TRADE ANALYSIS ===\n`;
  promptText += `Trade Date: Week ${week}, ${season} Season\n`;
  promptText += `Trade #${leagueContext?.tradeNumberThisSeason || '?'} of ${leagueContext?.totalTradesThisSeason || '?'} this season\n\n`;

  // 2. SEASON CONTEXT
  if (seasonContext) {
    promptText += `📅 SEASON TIMING:\n`;
    promptText += `  Phase: ${seasonContext.seasonPhase.toUpperCase()}\n`;
    promptText += `  Urgency Level: ${seasonContext.urgency}\n`;
    promptText += `  Weeks Until Playoffs: ${seasonContext.weeksUntilPlayoffs}\n`;
    promptText += `  Strategic Context: ${seasonContext.strategicContext}\n`;
    if (seasonContext.isTradeDeadlinePeriod) {
      promptText += `  ⚠️ TRADE DEADLINE PERIOD - High-stakes decisions expected\n`;
    }
    promptText += `\n`;
  }

  // 3. HEAD-TO-HEAD RIVALRY (if applicable)
  if (headToHead && headToHead.totalMatchups > 0) {
    promptText += `🏈 HEAD-TO-HEAD HISTORY:\n`;
    promptText += `  All-Time Record: ${headToHead.team1Wins}-${headToHead.team2Wins}${headToHead.ties > 0 ? `-${headToHead.ties}` : ''}\n`;
    if (headToHead.isRivalry) {
      promptText += `  ⚔️ RIVALRY ALERT: These teams have a competitive history!\n`;
    }
    promptText += `\n`;
  }

  // 4. EACH TEAM'S DETAILED PROFILE
  sides.forEach((side, index) => {
    promptText += `${'═'.repeat(50)}\n`;
    promptText += `TEAM ${index + 1}: ${side.userName}\n`;
    promptText += `${'═'.repeat(50)}\n`;

    // Team standing and record
    if (side.standings) {
      promptText += `📊 RECORD AT TRADE TIME: ${side.standings.recordAtTrade} (${side.standings.winPctAtTrade}% win rate)\n`;
      promptText += `   Playoff Status: ${side.standings.playoffStatus}\n`;
      promptText += `   Points Scored: ${side.standings.pointsAtTrade}\n`;
    }

    // Power score breakdown
    if (side.powerScore) {
      promptText += `💪 POWER SCORE: ${side.powerScore.powerScore}/100 (Rank #${side.powerScore.powerRank} of ${side.powerScore.totalTeams})\n`;
      promptText += `   Components: Lineup ${side.powerScore.lineupValueScore} | Performance ${side.powerScore.performanceScore} | Position ${side.powerScore.positionalScore} | Depth ${side.powerScore.depthScore}\n`;
    }

    // Manager trading history and style
    if (side.managerHistory) {
      const mh = side.managerHistory;
      promptText += `🎯 MANAGER PROFILE:\n`;
      promptText += `   Trading Style: ${mh.tradingStyle}\n`;
      promptText += `   This is trade #${mh.tradeRank} all-time (${mh.tradesThisSeason} this season)\n`;
      promptText += `   Historical Pattern: ${mh.playersBought} players acquired, ${mh.playersSold} players traded away\n`;
      promptText += `   Draft Capital: ${mh.picksAcquired} picks acquired, ${mh.picksSold} picks traded\n`;
      if (mh.isActiveTrador) {
        promptText += `   ⚡ ACTIVE TRADER - Known for making moves\n`;
      }
    }

    // Trade impact
    if (side.tradeImpact) {
      const impact = side.tradeImpact;
      const sign = impact.estimatedPowerScoreChange >= 0 ? '+' : '';
      promptText += `📈 TRADE IMPACT: ${sign}${impact.estimatedPowerScoreChange} projected power score change\n`;
      promptText += `   Value Received: ${impact.valueGained.toLocaleString()} | Value Given: ${impact.valueLost.toLocaleString()}\n`;
      promptText += `   Net Value: ${impact.netValueChange >= 0 ? '+' : ''}${impact.netValueChange.toLocaleString()}\n`;
    }

    // Assets received
    if (side.receives.length > 0) {
      promptText += `\n📥 RECEIVES:\n`;
      side.receives.forEach(asset => {
        if (asset.position === 'PICK') {
          promptText += `  • ${asset.name}${asset.from ? ` (from ${asset.from})` : ''}\n`;
        } else {
          promptText += `  • ${asset.name} (${asset.position}, ${asset.team})\n`;
          promptText += `    Age: ${asset.age || 'N/A'} | Experience: ${asset.yearsExp || 0} years\n`;
          promptText += `    Career Stage: ${asset.careerStage} | Position Value: ${asset.positionalValue}\n`;

          // Value trajectory - only show dynasty-specific info for dynasty leagues
          if (asset.trajectory) {
            if (LEAGUE_TYPE === 'dynasty') {
              promptText += `    Value Trajectory: ${asset.trajectory.trajectory.toUpperCase()} - ${asset.trajectory.valueOutlook}\n`;
              promptText += `    Dynasty Value: ${asset.trajectory.currentValue?.toLocaleString() || 'N/A'} | Years to Decline: ${asset.trajectory.yearsUntilDecline}\n`;
            } else {
              // For redraft, just show trade value without dynasty terminology
              promptText += `    Trade Value: ${asset.trajectory.currentValue?.toLocaleString() || 'N/A'}\n`;
            }
          }

          // Draft context
          if (asset.draftContext) {
            promptText += `    Draft History: ${asset.draftContext.draftContext}\n`;
          }

          // Performance metrics
          if (asset.performanceMetrics?.preTradeGames > 0) {
            promptText += `    Fantasy Performance: ${asset.performanceMetrics.preTradeAvg.toFixed(1)} PPG historical (${asset.performanceMetrics.preTradeGames} games)\n`;
          }

          // Projection context - CRITICAL for identifying backup/fill-in situations
          if (asset.projectionContext) {
            const proj = asset.projectionContext;
            promptText += `    Projected ROS: ${proj.projectedPPG} PPG (${proj.rosProjection} points over ${proj.remainingWeeks} weeks remaining)\n`;
            if (proj.ppgDelta !== 0) {
              const deltaSign = proj.ppgDelta > 0 ? '+' : '';
              promptText += `    PPG Delta (Historical vs Projected): ${deltaSign}${proj.ppgDelta}\n`;
            }
            if (proj.roleAlert) {
              promptText += `    ⚠️ ROLE ALERT: ${proj.roleAlert}\n`;
            }
          }
        }
      });
    }

    // Assets given
    if (side.gives.length > 0) {
      promptText += `\n📤 GIVES UP:\n`;
      side.gives.forEach(asset => {
        if (asset.position === 'PICK') {
          promptText += `  • ${asset.name}\n`;
        } else {
          promptText += `  • ${asset.name} (${asset.position}, ${asset.team})\n`;
          promptText += `    Age: ${asset.age || 'N/A'} | Experience: ${asset.yearsExp || 0} years\n`;
          promptText += `    Career Stage: ${asset.careerStage} | Position Value: ${asset.positionalValue}\n`;

          // Value trajectory - only show dynasty-specific info for dynasty leagues
          if (asset.trajectory) {
            if (LEAGUE_TYPE === 'dynasty') {
              promptText += `    Value Trajectory: ${asset.trajectory.trajectory.toUpperCase()} - ${asset.trajectory.valueOutlook}\n`;
              promptText += `    Dynasty Value: ${asset.trajectory.currentValue?.toLocaleString() || 'N/A'}\n`;
            } else {
              // For redraft, just show trade value without dynasty terminology
              promptText += `    Trade Value: ${asset.trajectory.currentValue?.toLocaleString() || 'N/A'}\n`;
            }
          }

          if (asset.performanceMetrics?.preTradeGames > 0) {
            promptText += `    Fantasy Performance: ${asset.performanceMetrics.preTradeAvg.toFixed(1)} PPG historical (${asset.performanceMetrics.preTradeGames} games)\n`;
          }

          // Projection context - CRITICAL for identifying backup/fill-in situations
          if (asset.projectionContext) {
            const proj = asset.projectionContext;
            promptText += `    Projected ROS: ${proj.projectedPPG} PPG (${proj.rosProjection} points over ${proj.remainingWeeks} weeks remaining)\n`;
            if (proj.ppgDelta !== 0) {
              const deltaSign = proj.ppgDelta > 0 ? '+' : '';
              promptText += `    PPG Delta (Historical vs Projected): ${deltaSign}${proj.ppgDelta}\n`;
            }
            if (proj.roleAlert) {
              promptText += `    ⚠️ ROLE ALERT: ${proj.roleAlert}\n`;
            }
          }
        }
      });
    }

    promptText += `\n`;
  });

  // 5. REAL-WORLD PLAYER CONTEXT (if available)
  if (realWorldContext && realWorldContext.length > 0) {
    promptText += `${'═'.repeat(50)}\n`;
    promptText += `🌍 REAL-WORLD NFL CONTEXT:\n`;
    promptText += `${'═'.repeat(50)}\n`;
    realWorldContext.forEach(ctx => {
      if (ctx.context !== 'Context unavailable') {
        promptText += `${ctx.player}: ${ctx.context}\n\n`;
      }
    });
  }

  // 6. LEAGUE CONTEXT
  if (leagueContext) {
    promptText += `${'═'.repeat(50)}\n`;
    promptText += `🏆 LEAGUE CONTEXT:\n`;
    promptText += `${'═'.repeat(50)}\n`;
    promptText += `  Total Trades This Season: ${leagueContext.totalTradesThisSeason}\n`;
    promptText += `  Average Players Per Trade: ${leagueContext.avgPlayersPerTrade}\n`;
    if (leagueContext.leagueLeader) {
      promptText += `  Current League Leader: ${leagueContext.leagueLeader}\n`;
    }
    if (leagueContext.isBiggestTradeOfSeason) {
      promptText += `  🚨 THIS IS THE BIGGEST TRADE OF THE SEASON!\n`;
    }
    promptText += `\n`;
  }

  // ============ VARIETY AND STYLE INSTRUCTIONS ============

  // Famous NFL trades to reference (variety pool)
  const nflTradeComparisons = [
    "the Jamal Adams trade (Jets to Seahawks) - a star demanding out, team getting picks",
    "the Khalil Mack trade (Raiders to Bears) - mortgaging the future for a superstar",
    "the Stefon Diggs trade (Vikings to Bills) - disgruntled star finds new home, immediate impact",
    "the DeAndre Hopkins trade (Texans to Cardinals) - lopsided deal that haunted one team",
    "the Davante Adams trade (Packers to Raiders) - reuniting with a former QB",
    "the Tyreek Hill trade (Chiefs to Dolphins) - record-breaking WR deal",
    "the Russell Wilson trade (Seahawks to Broncos) - blockbuster that backfired",
    "the Matthew Stafford/Jared Goff swap - win-now meets rebuild",
    "the Odell Beckham Jr. trade (Giants to Browns) - splash move that fizzled",
    "the Amari Cooper trade (Raiders to Cowboys) - mid-season acquisition paying dividends"
  ];

  const randomTradeComp = nflTradeComparisons[Math.floor(Math.random() * nflTradeComparisons.length)];

  // Dynamic variety instructions based on trade context
  const varietyInstructions = [
    "Give both managers creative nicknames based on their trading patterns and this specific move",
    `Draw parallels to ${randomTradeComp}`,
    "Make a bold, specific prediction about how this trade will look in hindsight",
    "Identify the clear winner/loser with specific reasoning, or explain why it's truly even",
    "Comment on the timing - was this trade made at the right moment in the season?",
    "Evaluate the risk/reward profile for each side",
    "Discuss championship implications - how does this affect each team's title odds?",
    "Reference the managers' trading histories and whether this move fits their pattern"
  ];

  // Select 3-4 random instructions
  const selectedCount = 3 + Math.floor(Math.random() * 2);
  const shuffled = [...varietyInstructions].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, selectedCount);

  // ============ FINAL PROMPT ============

  const prompt = `You are ${persona.name}, the legendary NFL analyst/reporter. Analyze this fantasy football ${LEAGUE_TYPE} trade in your signature style.

${promptText}

=== YOUR ANALYSIS INSTRUCTIONS ===

Write a 4-5 paragraph analysis in ${persona.name}'s authentic voice and style: ${persona.style}

Key elements to emphasize (${persona.name}'s specialties): ${persona.emphasis.join(', ')}

MUST INCLUDE these elements:
${selected.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}

IMPORTANT GUIDELINES:
- Use the manager trading history to characterize their approach (aggressive buyer? rebuilder? win-now?)
- Reference their records and playoff positioning when evaluating the trade's wisdom
- Consider player value trajectories (rising stars vs declining assets)
- Factor in the season timing (early season speculation vs late season desperation)
- Use specific data points from the context provided (power scores, values, records)
- Make it feel like a real broadcast/article from ${persona.name}
- Use ${persona.name}'s actual catchphrases and speaking patterns
- Be entertaining, insightful, and occasionally controversial

CRITICAL - EVALUATING PLAYER VALUE:
- Use TRADE VALUE as the primary indicator of player worth - higher value = more valuable asset
- If PROJECTION DATA is provided (Projected ROS PPG, PPG Delta, Role Alerts), factor it into your analysis:
  * When PROJECTED PPG is significantly LOWER than HISTORICAL PPG, the player may be a backup or have declining role
  * ROLE ALERTS like "LIKELY BACKUP/FILL-IN" indicate temporary production - weight heavily
  * Do NOT praise high historical PPG if projections show it will drop
- If NO PROJECTION DATA is shown for a player, use their TRADE VALUE and HISTORICAL PPG as indicators
- For REDRAFT leagues: current production sustainability matters - use trade values to gauge market confidence
- Compare trade values exchanged (e.g., receiving 3289 value vs giving up 409 = clear winner)
- Factor in team context and timing (playoff push, rebuilding, etc.)

LEAGUE TYPE: ${LEAGUE_TYPE.toUpperCase()}
${LEAGUE_TYPE === 'dynasty' ? `
This is a DYNASTY league - players are kept year over year. Key considerations:
- Long-term value and player trajectories (age, career stage, injury history)
- Future draft picks are premium assets - 1st rounders especially valuable
- Building for sustained success over multiple seasons vs "win now" mode
- Player development windows and "buy low/sell high" opportunities
- Age curves: RBs decline ~27, WRs peak 26-30, QBs can produce into late 30s
- Rookie picks are lottery tickets - high variance but league-changing upside
- Contenders should consolidate talent; rebuilders should accumulate picks/youth
` : `
This is a REDRAFT league - rosters reset each year. Key considerations:
- Current season production and immediate fantasy impact ONLY
- Remaining schedule strength and playoff matchups
- This year's championship window - nothing else matters
- Ignore age/dynasty value - a 32-year-old producing is better than a 23-year-old with "upside"
- Playoff schedule (weeks 15-17) is crucial for evaluating players
- Injuries and bye weeks have outsized importance

TRADE-WEEK SPECIFIC CONTEXT:
${tradeWeekContext ? `
- This trade occurred in Week ${week} with ${tradeWeekContext.weeksRemainingAtTrade} weeks remaining in the regular season
- ROS projections are calculated from Week ${week} forward (not current week)
- VOR scarcity data source: ${tradeWeekContext.vorScarcity?.source || 'fallback'} (${tradeWeekContext.vorScarcity?.accuracy || 'estimated'} accuracy)
${tradeWeekContext.vorScarcity?.weekDifference ? `- Note: VOR data is from ${tradeWeekContext.vorScarcity.weekDifference} week(s) ${tradeWeekContext.vorScarcity.snapshotWeek > week ? 'later' : 'earlier'}` : ''}
` : '- Trade-week projections not available - using current values'}
`}

POWER SCORE METHODOLOGY (for interpreting team strength):
Power Score (0-100) is a composite metric measuring overall team strength.

${LEAGUE_TYPE === 'dynasty' ? `
DYNASTY LEAGUE WEIGHTS & VALUES:
1. LINEUP VALUE (50% weight):
   - Based on DynastyProcess trade values (dynasty asset valuation)
   - Factors in age, situation, contract, and long-term outlook
   - Young studs valued higher than aging veterans
   - Higher = more valuable dynasty assets

2. PERFORMANCE (30% weight):
   - Actual on-field results: Win%, All-Play record
   - All-Play = record if you played every team each week (shows true strength vs luck)
   - Teams with good All-Play but bad record are "unlucky" - regression candidates
   - Teams with bad All-Play but good record are "lucky" - regression risks

3. POSITIONAL ADVANTAGE (15% weight):
   - Compares starters vs league average at each position
   - Positional scarcity weighted: RB > TE > QB > WR (in standard leagues)
   - Elite advantage at scarce positions (RB1, TE1) more valuable than WR depth

4. DEPTH (5% weight):
   - Quality of top backup at each position
   - Important for injury insurance and bye week coverage
   - Less critical in dynasty since trades can address needs
` : `
REDRAFT LEAGUE WEIGHTS & VALUES:
1. LINEUP VALUE (35% weight - reduced from dynasty):
   - Based on FantasyCalc ECR trade values + Sleeper ROS projections
   - Weighted by DYNAMIC VOR SCARCITY (see below)
   - Only measures what players are actually producing THIS SEASON
   - Ignores age, dynasty value, and future potential

2. PERFORMANCE (45% weight - increased from dynasty):
   - Actual on-field results: Win%, All-Play record
   - More heavily weighted because current production is everything
   - All-Play = record if you played every team each week
   - Best indicator of true team strength in redraft

3. POSITIONAL ADVANTAGE (15% weight):
   - Compares starters vs league average at each position
   - Identifies teams with elite positional advantages
   - Uses VOR-based scarcity for position weighting

4. DEPTH (5% weight):
   - Quality of top backup at each position
   - Critical for bye weeks and injuries
   - Late-season depth matters for playoff runs

VOR (VALUE OVER REPLACEMENT) SCARCITY - DYNAMIC CALCULATION:
This system calculates positional scarcity WEEKLY using real market data:
- VOR = Elite Player Value - Replacement Level Value
- Replacement Level = Player ranked at (starters needed per league)
- Higher VOR spread = more valuable/scarce position
- Recalculates each week to reflect injuries, bye weeks, and market shifts

EXAMPLE VOR SCARCITY (normalized, WR=100 baseline):
- QB: ~80-140 (varies by SuperFlex status)
- RB: ~90-160 (high when bellcows injured)
- WR: 100 (deepest position, baseline)
- TE: ~80-150 (elite TEs create massive advantage)
- K/DEF: ~20 (highly replaceable)

WHY VOR MATTERS FOR TRADES:
- A RB1 is worth MORE than a WR1 of equal PPG (scarcity premium)
- Elite TEs (Kelce, Andrews tier) have outsized value due to position cliff
- Mid-tier QBs are replaceable in 1QB but premium in SuperFlex
- VOR helps identify when a trade is "fair by PPG" but "unfair by scarcity"
`}

INTERPRETING TRADE IMPACT:
- Power Score CHANGE shows immediate roster impact
- Positive change = team improved, Negative = team weakened
- Small changes (< 2 points) are marginal moves
- Large changes (> 5 points) are significant roster shifts
- Consider BOTH sides: Zero-sum game means one team's gain is another's loss

${LEAGUE_TYPE === 'dynasty' ? `
POSITIONAL VALUE TIERS (Dynasty Context):
- ELITE: Top 3 at position - league-winners, rarely traded
- STRONG: Top 4-12 - reliable starters, high trade value
- AVERAGE: Top 13-24 - startable but replaceable
- DEPTH: 25+ - bench pieces, handcuffs, lottery tickets

VOR SCARCITY BY POSITION (Dynasty - approximate multipliers):
- RB: 150 (highest scarcity - short careers, bellcow rarity)
- TE: 120 (elite tier very thin - Kelce/Andrews gap is real)
- WR: 100 (baseline - deepest position with longest careers)
- QB: 80-140 (80 in 1QB, 140+ in SuperFlex due to demand)
- K/DEF: 20-25 (streamable, minimal dynasty value)

DRAFT PICK VALUES (Dynasty Reference):
- Future 1st Round: Premium asset, especially early picks
- Future 2nd Round: Solid value, can yield starters
- Future 3rd+: Dart throws, best for depth
- Current year picks more valuable as draft approaches
` : `
REDRAFT TRADE EVALUATION:
- Focus ONLY on current season production - ignore age, long-term potential, and future value
- PROJECTED points matter more than historical - a player's future role determines value
- Pay attention to ROLE ALERTS - backup QBs filling in for injured starters have temporary value
- Playoff schedule strength is crucial - target players with favorable Week 15-17 matchups
- Trade value should reflect what the player will actually produce THIS SEASON, not their name recognition
`}

Return ONLY the analysis text. No preamble, headers, or meta-commentary.
Be entertaining and insightful. Use ${persona.name}'s authentic voice, catchphrases, and speaking patterns.
Consider how this trade affects each team's competitive position and championship odds.`;

  console.log(`🤖 Generating analysis for ${participants.join(' vs ')} as ${persona.name}...`);

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    temperature: 1.0,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  // Log token usage for cost monitoring
  tokenLogger.log('generate-analysis', message.usage, { trade: participants.join(' vs '), persona: persona.name });

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

  // Build detailed sides info for the output
  const sidesDetail = tradeData.sides.map(side => ({
    teamName: side.userName,
    teamContext: side.teamContext,
    powerScore: side.powerScore,
    tradeImpact: side.tradeImpact,
    receives: side.receives.map(a => ({
      name: a.name,
      position: a.position,
      team: a.team,
      age: a.age,
      careerStage: a.careerStage
    })),
    gives: side.gives.map(a => ({
      name: a.name,
      position: a.position,
      team: a.team,
      age: a.age,
      careerStage: a.careerStage
    }))
  }));

  const data = {
    tradeId: tradeData.tradeId,
    week: tradeData.week,
    season: tradeData.season,
    leagueId: LEAGUE_ID,
    participants: tradeData.participants,
    sides: sidesDetail,
    draftPicks: tradeData.draftPicks,
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
  console.log('===========================');
  console.log(`📍 Commentator Region: ${getActiveRegion()} (${PERSONAS.length} personas available)\n`);

  // Load data
  console.log('📊 Loading data...');
  const { trades, rosters, users, players, league, matchupsAllYears, powerRankings, draftPicks, vorSnapshots } = await loadData();
  console.log(`✅ Loaded ${trades.length} trades`);
  console.log(`✅ Loaded ${Object.keys(matchupsAllYears).length} seasons of matchup history`);
  if (powerRankings) {
    console.log(`✅ Loaded power rankings for ${powerRankings.rankings?.length || 0} teams`);
  } else {
    console.log(`⚠️ Power rankings not available (run build first)`);
  }
  if (draftPicks?.length > 0) {
    console.log(`✅ Loaded ${draftPicks.length} draft picks for context`);
  }
  if (vorSnapshots) {
    const snapshotCount = vorSnapshots.snapshots?.length || 0;
    console.log(`✅ Loaded ${snapshotCount} VOR snapshots for historical accuracy`);
  }
  if (FETCH_REAL_WORLD_CONTEXT) {
    console.log(`🌍 Real-world context fetching: ENABLED`);
  }
  console.log(`🏈 League Type: ${LEAGUE_TYPE.toUpperCase()}`);
  console.log('');

  // Process all trades with enhanced metrics
  const processedTrades = trades.map(trade =>
    processTradeData(trade, users, players, rosters, matchupsAllYears, powerRankings, trades, league, draftPicks)
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

  // Detect if league is superflex from power rankings
  const isSF = powerRankings?.league?.isSuperFlex || false;

  // Process each trade
  for (const tradeData of tradesToAnalyze) {
    // Select random persona
    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

    // Generate analysis
    try {
      // For redraft leagues, fetch trade-week-specific projections and VOR scarcity
      let tradeWeekContext = null;
      if (LEAGUE_TYPE === 'redraft') {
        console.log(`   📅 Week ${tradeData.week}, ${tradeData.season} - Fetching time-appropriate data...`);

        // Fetch ROS projections from the trade week
        const tradeWeekProjections = await fetchTradeWeekProjections(tradeData.season, tradeData.week);

        // Get VOR scarcity values appropriate for the trade week
        const vorScarcity = getVorScarcityForTrade(vorSnapshots, tradeData.season, tradeData.week, isSF);

        tradeWeekContext = {
          projections: tradeWeekProjections,
          vorScarcity,
          weeksRemainingAtTrade: 18 - tradeData.week + 1
        };

        console.log(`   ✅ ROS projections: ${tradeWeekProjections.size} players (weeks ${tradeData.week}-18)`);
        console.log(`   ✅ VOR source: ${vorScarcity.source} (accuracy: ${vorScarcity.accuracy})`);
      }

      // Attach trade-week context to tradeData for analysis generation
      tradeData.tradeWeekContext = tradeWeekContext;

      // Optionally fetch real-world context for players
      let realWorldContext = [];
      if (FETCH_REAL_WORLD_CONTEXT && tradeData.allPlayerNames?.length > 0) {
        console.log(`   🔍 Fetching real-world context for ${tradeData.allPlayerNames.slice(0, 4).join(', ')}...`);
        realWorldContext = await fetchPlayerRealWorldContext(tradeData.allPlayerNames, tradeData.createdTimestamp);
      }

      const analysis = await generateAnalysis(tradeData, persona, realWorldContext);

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

  // Print token usage summary
  tokenLogger.summary();

  console.log('\n✨ Trade analysis generation complete!');
  console.log('📁 Analysis saved to: src/data/trade-summaries/');
  console.log('💡 Remember to commit these files to your repo!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
