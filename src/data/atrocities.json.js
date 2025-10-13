// Data loader for atrocity score analysis
// Analyzes lineup decisions and calculates atrocity scores
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

/**
 * Fetch all required data
 */
async function fetchAllData() {
  const [league, rosters, users, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`).then(r => r.json()),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json())
  ]);

  // Fetch all weekly matchups
  const matchups = [];
  const currentWeek = league.settings?.leg || league.settings?.last_scored_leg || 1;

  for (let week = 1; week <= Math.min(currentWeek, 18); week++) {
    try {
      const weekMatchups = await fetch(
        `https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}`
      ).then(r => r.json());

      if (weekMatchups && weekMatchups.length > 0) {
        matchups.push({ week, matchups: weekMatchups });
      }
    } catch (error) {
      console.error(`Error fetching week ${week}:`, error);
    }
  }

  return { league, rosters, users, players, matchups };
}

/**
 * Get player position for lineup slot
 */
function getPositionForSlot(playerId, players) {
  const player = players[playerId];
  if (!player) return 'FLEX';

  return player.fantasy_positions?.[0] || player.position || 'FLEX';
}

/**
 * Calculate position statistics for the week
 */
function calculatePositionStats(matchups, players, position) {
  const scores = [];

  matchups.forEach(matchup => {
    matchup.starters?.forEach(playerId => {
      const player = players[playerId];
      const playerPos = player?.fantasy_positions?.[0] || player?.position;

      if (playerPos === position || position === 'FLEX') {
        const points = matchup.starters_points?.[matchup.starters.indexOf(playerId)] || 0;
        scores.push(points);
      }
    });
  });

  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = scores.length > 0 ? sum / scores.length : 10;
  const variance = scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Rank players by position for the week
 */
function rankPlayersByPosition(matchups, players) {
  const playerScores = new Map();

  matchups.forEach(matchup => {
    const allPlayers = matchup.players || [];
    const playersPoints = matchup.players_points || {};

    allPlayers.forEach(playerId => {
      const player = players[playerId];
      if (!player) return;

      const position = player.fantasy_positions?.[0] || player.position;
      // Get points from players_points (works for both starters and bench)
      const points = playersPoints[playerId] || 0;

      if (!playerScores.has(playerId)) {
        playerScores.set(playerId, {
          playerId,
          position,
          points,
          name: `${player.first_name} ${player.last_name}`
        });
      }
    });
  });

  // Rank by position
  const rankings = new Map();
  const byPosition = new Map();

  playerScores.forEach(player => {
    if (!byPosition.has(player.position)) {
      byPosition.set(player.position, []);
    }
    byPosition.get(player.position).push(player);
  });

  byPosition.forEach((players, position) => {
    players.sort((a, b) => b.points - a.points);
    players.forEach((player, index) => {
      rankings.set(player.playerId, index + 1);
    });
  });

  return rankings;
}

/**
 * Check if positions are compatible for comparison
 */
function canReplacePosition(starterPos, benchPos) {
  // Direct position match
  if (starterPos === benchPos) return true;

  // FLEX can be filled by RB, WR, or TE
  if (starterPos === 'FLEX' && (benchPos === 'RB' || benchPos === 'WR' || benchPos === 'TE')) {
    return true;
  }

  // SUPER_FLEX can be filled by any offensive position
  if (starterPos === 'SUPER_FLEX') {
    return ['QB', 'RB', 'WR', 'TE'].includes(benchPos);
  }

  return false;
}

/**
 * Analyze lineup decisions for a single matchup
 */
function analyzeLineupDecisions(matchup, roster, players, week, rankings, positionStats) {
  const atrocities = [];

  if (!matchup.starters || !matchup.starters_points || !matchup.players || !matchup.players_points) {
    return atrocities;
  }

  const starters = matchup.starters;
  const startersPoints = matchup.starters_points;
  const playersPoints = matchup.players_points;
  const benchPlayers = matchup.players.filter(p => !starters.includes(p));

  // For each starter, check if there was a better bench option at a compatible position
  starters.forEach((starterId, starterIndex) => {
    const starterPoints = startersPoints[starterIndex] || 0;
    const starterPlayer = players[starterId];

    if (!starterPlayer) return;

    const starterPosition = starterPlayer.fantasy_positions?.[0] || starterPlayer.position;
    if (!starterPosition || starterPosition === 'DEF') return; // Skip defense for now

    // Find bench players at compatible positions
    benchPlayers.forEach(benchId => {
      const benchPlayer = players[benchId];
      if (!benchPlayer) return;

      const benchPosition = benchPlayer.fantasy_positions?.[0] || benchPlayer.position;
      if (!benchPosition) return;

      // Only compare compatible positions
      if (!canReplacePosition(starterPosition, benchPosition)) return;

      // Get bench player's actual points from players_points
      const benchPoints = playersPoints[benchId] || 0;

      // Only flag if bench player scored significantly more (at least 5 points)
      const pointsDiff = benchPoints - starterPoints;
      if (pointsDiff < 5) return;

      const starterRank = rankings.get(starterId) || 999;
      const benchRank = rankings.get(benchId) || 999;
      const posStats = positionStats[starterPosition] || { mean: 10, stdDev: 8 };

      // Estimate projections based on rank (better ranked players get higher projections)
      const poolSize = { QB: 32, RB: 64, WR: 96, TE: 32, K: 32, DEF: 32 }[starterPosition] || 64;
      const starterProjection = starterRank < poolSize
        ? posStats.mean * (1 + (poolSize - starterRank) / poolSize * 0.5)
        : posStats.mean * 0.7;
      const benchProjection = benchRank < poolSize
        ? posStats.mean * (1 + (poolSize - benchRank) / poolSize * 0.5)
        : posStats.mean * 0.7;

      // Estimate start percentage based on rank (top players started more often)
      const starterStartPct = Math.max(10, Math.min(95, 100 - (starterRank / poolSize * 80)));
      const benchStartPct = Math.max(10, Math.min(95, 100 - (benchRank / poolSize * 80)));

      const decision = {
        week,
        rosterId: matchup.roster_id,
        position: starterPosition,
        startedPlayer: {
          name: `${starterPlayer.first_name} ${starterPlayer.last_name}`,
          actual: starterPoints,
          rank: starterRank,
          startPct: Math.round(starterStartPct),
          projection: parseFloat(starterProjection.toFixed(2)),
          status: starterPlayer.injury_status || 'Active'
        },
        benchedPlayer: {
          name: `${benchPlayer.first_name} ${benchPlayer.last_name}`,
          actual: benchPoints,
          rank: benchRank,
          startPct: Math.round(benchStartPct),
          projection: parseFloat(benchProjection.toFixed(2)),
          status: benchPlayer.injury_status || 'Active'
        },
        positionAvgProj: posStats.mean,
        positionStdDev: posStats.stdDev,
        isChampionship: week === 17 || week === 18
      };

      atrocities.push(decision);
    });
  });

  return atrocities;
}

/**
 * Main analysis function
 */
async function calculateAtrocities() {
  const { league, rosters, users, players, matchups } = await fetchAllData();

  const allAtrocities = [];

  matchups.forEach(weekData => {
    const { week, matchups: weekMatchups } = weekData;

    // Calculate position stats for this week
    const positionStats = {};
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].forEach(pos => {
      positionStats[pos] = calculatePositionStats(weekMatchups, players, pos);
    });

    // Rank players for this week
    const rankings = rankPlayersByPosition(weekMatchups, players);

    weekMatchups.forEach(matchup => {
      const roster = rosters.find(r => r.roster_id === matchup.roster_id);
      const user = users.find(u => u.user_id === roster?.owner_id);

      if (!roster || !user) return;

      const decisions = analyzeLineupDecisions(
        matchup,
        roster,
        players,
        week,
        rankings,
        positionStats
      );

      decisions.forEach(decision => {
        allAtrocities.push({
          ...decision,
          userId: user.user_id,
          userName: user.display_name,
          userAvatar: user.avatar
        });
      });
    });
  });

  // Calculate atrocity scores using improved formula
  const scoredAtrocities = allAtrocities.map(decision => {
    const pointsLeft = decision.benchedPlayer.actual - decision.startedPlayer.actual;
    if (pointsLeft <= 0) return null;

    // Position pool sizes for normalization
    const POOL_SIZE = { QB: 32, RB: 64, WR: 96, TE: 32, K: 32, DEF: 32 };
    const poolSize = POOL_SIZE[decision.position] || 64;

    // Calculate normalized component gaps (0-1 scale)
    const rankGap = Math.max(0, decision.startedPlayer.rank - decision.benchedPlayer.rank);
    const normalizedRankGap = Math.min(1.0, rankGap / poolSize);

    const startPctGap = Math.max(0, decision.benchedPlayer.startPct - decision.startedPlayer.startPct);
    const normalizedStartPctGap = startPctGap / 100;

    const projGap = Math.max(0, decision.benchedPlayer.projection - decision.startedPlayer.projection);
    const normalizedProjGap = Math.min(2.0, projGap / decision.positionAvgProj);

    const actualGap = pointsLeft;
    const normalizedActualGap = Math.min(2.0, actualGap / decision.positionStdDev / 3);

    // Pre-game decision score (0-100) - what you should have known
    const preGameScore = (
      normalizedRankGap * 0.30 +        // Rankings
      normalizedStartPctGap * 0.35 +    // Consensus
      normalizedProjGap * 0.35          // Projections
    ) * 100;

    // Only add actual outcome if pre-game signals were strong
    let baseScore = preGameScore;
    if (preGameScore > 20) {
      baseScore = preGameScore * 0.85 + normalizedActualGap * 100 * 0.15;
    }

    // Status bonus - only apply if player didn't play (scored very few points)
    // If they scored points, they played, so injury status doesn't count as a pre-game signal
    let statusBonus = 0;
    const status = decision.startedPlayer.status;
    const starterActual = decision.startedPlayer.actual;

    // Only apply status bonus if player scored 2 points or less (indicating they didn't really play)
    if (starterActual <= 2) {
      if (status === 'Out' || status === 'IR' || status === 'Suspended') {
        statusBonus = 40;
      } else if (status === 'Doubtful') {
        statusBonus = 20;
      } else if (status === 'Questionable') {
        statusBonus = 5;
      }
    }

    // Position volatility
    const POSITION_VOLATILITY = { QB: 0.85, RB: 1.15, WR: 1.20, TE: 1.10, K: 0.90, DEF: 1.00 };
    const positionFactor = POSITION_VOLATILITY[decision.position] || 1.0;

    // Week multiplier with protection for obvious mistakes
    const isObviousMistake = (baseScore + statusBonus) > 40;
    let weekMultiplier = 1.0;
    if (decision.week <= 6) {
      weekMultiplier = isObviousMistake ? 0.8 : 0.5;
    } else if (decision.week >= 14) {
      weekMultiplier = 2.0;
    }
    if (decision.isChampionship) {
      weekMultiplier *= 1.5;
    }

    // Final score calculation
    const rawScore = (baseScore + statusBonus) * positionFactor * weekMultiplier;
    const finalScore = Math.min(100, Math.round(rawScore));

    // Categorize severity
    let severity;
    if (finalScore < 20) severity = { level: 1, label: 'Questionable', emoji: '🟡', color: '#f59e0b' };
    else if (finalScore < 40) severity = { level: 2, label: 'Bad Decision', emoji: '🟠', color: '#fb923c' };
    else if (finalScore < 70) severity = { level: 3, label: 'Egregious', emoji: '🔴', color: '#ef4444' };
    else if (finalScore < 90) severity = { level: 4, label: 'Catastrophic', emoji: '⚠️', color: '#dc2626' };
    else severity = { level: 5, label: 'LEGENDARY', emoji: '💀', color: '#7c2d12' };

    return {
      ...decision,
      score: finalScore,
      severity,
      pointsLeft,
      explanation: `Left ${pointsLeft.toFixed(1)} points on bench. Rank gap: ${rankGap} positions.`
    };
  }).filter(a => a !== null);

  return scoredAtrocities;
}

const atrocities = await calculateAtrocities();
process.stdout.write(JSON.stringify(atrocities, null, 2));
