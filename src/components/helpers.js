// Helper functions for the Sleeper Dashboard

/**
 * Format a number to fixed decimal places
 */
export function formatNumber(num, decimals = 2) {
  return typeof num === 'number' ? num.toFixed(decimals) : '0.00';
}

/**
 * Calculate win percentage
 */
export function calculateWinPct(wins, losses, ties = 0) {
  const totalGames = wins + losses + ties;
  return totalGames > 0 ? wins / totalGames : 0;
}

/**
 * Get team name from roster ID
 */
export function getTeamName(rosterId, rosters, users) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return `Team ${rosterId}`;
  const user = users.find(u => u.user_id === roster.owner_id);
  return user?.display_name || `Team ${rosterId}`;
}

/**
 * Calculate points per game
 */
export function calculatePPG(totalPoints, games) {
  return games > 0 ? totalPoints / games : 0;
}

/**
 * Get position color
 */
export function getPositionColor(position) {
  const colors = {
    QB: '#3b82f6',
    RB: '#22c55e',
    WR: '#f59e0b',
    TE: '#8b5cf6',
    K: '#ef4444',
    DEF: '#64748b'
  };
  return colors[position] || '#6b7280';
}

/**
 * Calculate player value score
 */
export function calculatePlayerValue(player) {
  let value = 100; // Base value

  // Position modifiers
  const positionValues = { QB: 1.2, RB: 1.5, WR: 1.3, TE: 1.0, K: 0.3 };
  value *= (positionValues[player.position] || 1.0);

  // Age penalty/bonus
  if (player.age > 0) {
    if (player.age < 25) value *= 1.2;
    else if (player.age > 30) value *= 0.8;
  }

  // Experience factor
  if (player.years_exp === 0) value *= 0.7;
  else if (player.years_exp >= 2 && player.years_exp <= 5) value *= 1.1;

  // Injury penalty
  if (player.injury_status) value *= 0.7;

  return Math.round(value);
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format large numbers with commas
 */
export function formatLargeNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Calculate z-score for a value in a dataset
 */
export function calculateZScore(value, mean, stdDev) {
  return stdDev > 0 ? (value - mean) / stdDev : 0;
}

/**
 * Categorize team strength based on metrics
 */
export function categorizeTeamStrength(winPct, ppg, leaguePPG) {
  if (winPct >= 0.7 && ppg > leaguePPG * 1.1) return 'Elite';
  if (winPct >= 0.6 && ppg > leaguePPG) return 'Strong';
  if (winPct >= 0.4) return 'Average';
  return 'Weak';
}

/**
 * Calculate playoff probability (simple model)
 */
export function calculatePlayoffProbability(wins, losses, gamesRemaining, playoffSpots, teamsInLeague) {
  const currentWinPct = wins / (wins + losses);
  const projectedWins = wins + (currentWinPct * gamesRemaining);
  const avgWinsForPlayoffs = (wins + losses + gamesRemaining) * (playoffSpots / teamsInLeague);

  if (projectedWins >= avgWinsForPlayoffs * 1.2) return 90;
  if (projectedWins >= avgWinsForPlayoffs) return 70;
  if (projectedWins >= avgWinsForPlayoffs * 0.8) return 40;
  return 15;
}

// ============================================================================
// ATROCITY SCORE FUNCTIONS
// ============================================================================

/**
 * Position pool sizes for ranking normalization
 */
const POSITION_POOL_SIZE = {
  QB: 32,
  RB: 64,
  WR: 96,
  TE: 32,
  K: 32,
  DEF: 32,
  FLEX: 96
};

/**
 * Position volatility coefficients
 */
const POSITION_VOLATILITY = {
  QB: 0.85,
  RB: 1.15,
  WR: 1.20,
  TE: 1.10,
  K: 0.90,
  DEF: 1.00,
  FLEX: 1.15
};

/**
 * Calculate ranking gap component (normalized 0-1)
 */
export function calculateRankingGap(startedRank, benchedRank, position) {
  const rawGap = Math.max(0, startedRank - benchedRank);
  const poolSize = POSITION_POOL_SIZE[position] || 64;
  return Math.min(1.0, rawGap / poolSize);
}

/**
 * Calculate start percentage gap component (normalized 0-1)
 */
export function calculateStartPctGap(startedPct, benchedPct) {
  const rawGap = Math.max(0, benchedPct - startedPct);
  return rawGap / 100;
}

/**
 * Calculate projection gap component (normalized 0-1)
 */
export function calculateProjectionGap(startedProj, benchedProj, positionAvg) {
  const rawGap = Math.max(0, benchedProj - startedProj);
  return Math.min(2.0, rawGap / positionAvg);
}

/**
 * Calculate actual points gap using z-score (normalized)
 */
export function calculateActualGap(startedActual, benchedActual, positionStdDev) {
  const rawGap = Math.max(0, benchedActual - startedActual);
  if (positionStdDev === 0) return 0;
  const zScore = rawGap / positionStdDev;
  return Math.min(2.0, zScore / 3.0);
}

/**
 * Main atrocity score calculation
 */
export function calculateAtrocityScore(decision) {
  // Only calculate if benched player outscored started player
  if (decision.benchedPlayer.actual <= decision.startedPlayer.actual) {
    return null;
  }

  // Calculate normalized components (0-1 scale)
  const components = {
    rankingGap: calculateRankingGap(
      decision.startedPlayer.rank || 999,
      decision.benchedPlayer.rank || 999,
      decision.position
    ),
    startPctGap: calculateStartPctGap(
      decision.startedPlayer.startPct || 0,
      decision.benchedPlayer.startPct || 0
    ),
    projectionGap: calculateProjectionGap(
      decision.startedPlayer.projection || 0,
      decision.benchedPlayer.projection || 0,
      decision.positionAvgProj || 10
    ),
    actualGap: calculateActualGap(
      decision.startedPlayer.actual,
      decision.benchedPlayer.actual,
      decision.positionStdDev || 8
    )
  };

  // Calculate pre-game decision score (0-100)
  // This measures if you SHOULD have known better based on available info
  const preGameScore = (
    components.rankingGap * 0.30 +      // Rankings - key decision factor
    components.startPctGap * 0.35 +     // Consensus - what others did
    components.projectionGap * 0.35     // Projections - expert guidance
  ) * 100;

  // Only use actual points gap if pre-game indicators were bad
  // This prevents penalizing gut calls that went against the data but failed
  let baseScore = preGameScore;

  // If you ignored strong pre-game signals (score > 20), actual outcome validates the mistake
  if (preGameScore > 20) {
    baseScore = preGameScore * 0.85 + (components.actualGap * 100) * 0.15;
  }

  // Player status adjustment (flat additions)
  let statusBonus = 0;
  const status = decision.startedPlayer.status;
  if (status === 'Out' || status === 'IR' || status === 'Suspended') {
    statusBonus = 40;
  } else if (status === 'Doubtful') {
    statusBonus = 20;
  } else if (status === 'Questionable') {
    statusBonus = 5;
  }

  // Position volatility multiplier
  const positionFactor = POSITION_VOLATILITY[decision.position] || 1.0;

  // Context multipliers
  let contextMultiplier = 1.0;

  // Week importance - but don't excuse obviously terrible decisions
  const week = decision.week || 1;
  const isObviousMistake = (baseScore + statusBonus) > 40; // High pre-game score indicates obvious mistake

  if (week <= 6) {
    // Early season: reduce score unless it was obviously terrible
    contextMultiplier *= isObviousMistake ? 0.8 : 0.5;
  } else if (week >= 14) {
    contextMultiplier *= 2.0;
  }

  // Championship week extra multiplier
  if (decision.isChampionship) contextMultiplier *= 1.5;

  // Time to react
  const hoursBeforeKickoff = decision.hoursBeforeKickoff || 24;
  if (hoursBeforeKickoff < 1) contextMultiplier *= 0.5;
  else if (hoursBeforeKickoff < 4) contextMultiplier *= 0.7;

  // Final score calculation
  const rawScore = (baseScore + statusBonus) * positionFactor * contextMultiplier;
  const finalScore = Math.min(100, Math.round(rawScore));

  // Categorize severity
  const severity = categorizeSeverity(finalScore);

  // Calculate points left on bench
  const pointsLeft = decision.benchedPlayer.actual - decision.startedPlayer.actual;

  // Generate explanation
  const explanation = generateAtrocityExplanation(decision, components, finalScore);

  // Assign badges
  const badges = assignAtrocityBadges(decision, finalScore);

  return {
    score: finalScore,
    severity,
    components,
    pointsLeft: pointsLeft,
    startedPlayer: decision.startedPlayer.name,
    benchedPlayer: decision.benchedPlayer.name,
    position: decision.position,
    week: decision.week,
    explanation,
    badges
  };
}

/**
 * Categorize atrocity severity
 */
export function categorizeSeverity(score) {
  if (score < 20) {
    return { level: 1, label: 'Questionable', emoji: '🟡', color: '#f59e0b' };
  }
  if (score < 40) {
    return { level: 2, label: 'Bad Decision', emoji: '🟠', color: '#fb923c' };
  }
  if (score < 70) {
    return { level: 3, label: 'Egregious', emoji: '🔴', color: '#ef4444' };
  }
  if (score < 90) {
    return { level: 4, label: 'Catastrophic', emoji: '⚠️', color: '#dc2626' };
  }
  return { level: 5, label: 'LEGENDARY', emoji: '💀', color: '#7c2d12' };
}

/**
 * Generate human-readable explanation
 */
function generateAtrocityExplanation(decision, components, score) {
  const pointsLeft = decision.benchedPlayer.actual - decision.startedPlayer.actual;
  let explanation = `Left ${pointsLeft.toFixed(1)} points on the bench. `;

  // Identify primary factor
  const factors = [
    { name: 'Rankings', value: components.rankingGap * 0.15 },
    { name: 'Consensus', value: components.startPctGap * 0.20 },
    { name: 'Projections', value: components.projectionGap * 0.25 },
    { name: 'Outcome', value: components.actualGap * 0.40 }
  ];

  const topFactor = factors.sort((a, b) => b.value - a.value)[0];
  explanation += `Primary factor: ${topFactor.name}. `;

  // Add context
  const status = decision.startedPlayer.status;
  if (status && status !== 'Active') {
    explanation += `⚠️ Player was ${status}. `;
  }

  if (decision.benchedPlayer.startPct > 80) {
    explanation += `Benched a consensus start (${decision.benchedPlayer.startPct}% started). `;
  }

  if (components.rankingGap > 0.3) {
    explanation += `Significant ranking gap. `;
  }

  if (decision.isChampionship) {
    explanation += `💀 This happened in the championship. `;
  }

  return explanation;
}

/**
 * Assign achievement badges
 */
export function assignAtrocityBadges(decision, score) {
  const badges = [];

  // Status-based badges
  const status = decision.startedPlayer.status;
  if (status === 'Out' || status === 'IR') {
    badges.push({ id: 'inactive_starter', name: 'The Inactive', emoji: '⚠️' });
  }

  // Start percentage badges
  if (decision.benchedPlayer.startPct > 90) {
    badges.push({ id: 'consensus_ignore', name: 'Consensus Denier', emoji: '🙈' });
  }

  // Points differential badges
  const pointsLeft = decision.benchedPlayer.actual - decision.startedPlayer.actual;
  if (pointsLeft > 30) {
    badges.push({ id: 'massive_miss', name: 'The Big Whiff', emoji: '💥' });
  }

  // Ranking badges
  const rankDiff = decision.startedPlayer.rank - decision.benchedPlayer.rank;
  if (rankDiff > 40) {
    badges.push({ id: 'rank_rebel', name: 'Rankings Rebel', emoji: '🎲' });
  }

  // Context badges
  if (decision.isChampionship) {
    badges.push({ id: 'championship_choke', name: 'Championship Choke', emoji: '🏆💀' });
  }

  if (decision.week >= 14 && score > 70) {
    badges.push({ id: 'playoff_disaster', name: 'Playoff Disaster', emoji: '📉' });
  }

  // Severity badges
  if (score >= 90) {
    badges.push({ id: 'hall_of_shame', name: 'HALL OF SHAME', emoji: '💀🏆' });
  }

  return badges;
}

/**
 * Get all available achievement badges
 */
export function getAllBadges() {
  return {
    // Level 1-2
    the_tinkerer: { name: 'The Tinkerer', desc: 'Changed lineup 10+ times', emoji: '🔧', level: 1 },
    point_chaser: { name: 'Point Chaser', desc: 'Started last week\'s hero who busted', emoji: '🏃', level: 2 },

    // Level 3
    inactive_starter: { name: 'The Inactive', desc: 'Started OUT player', emoji: '⚠️', level: 3 },
    bye_week_blues: { name: 'Bye Week Blues', desc: 'Started bye week player', emoji: '😴', level: 3 },
    consensus_ignore: { name: 'Consensus Denier', desc: 'Benched 90%+ start player', emoji: '🙈', level: 3 },
    rank_rebel: { name: 'Rankings Rebel', desc: 'Started player 40+ ranks below bench option', emoji: '🎲', level: 3 },

    // Level 4-5
    massive_miss: { name: 'The Big Whiff', desc: 'Left 30+ points on bench', emoji: '💥', level: 4 },
    playoff_disaster: { name: 'Playoff Disaster', desc: 'Major atrocity in playoffs', emoji: '📉', level: 4 },
    championship_choke: { name: 'Championship Choke', desc: 'Atrocity in championship game', emoji: '🏆💀', level: 5 },
    hall_of_shame: { name: 'HALL OF SHAME', desc: 'Legendary atrocity (90+ score)', emoji: '💀🏆', level: 5 }
  };
}

// ============================================================================
// SHAPLEY VALUE FUNCTIONS
// ============================================================================

/**
 * Calculate factorial
 */
function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Generate all subsets of a given size from an array
 */
function* generateSubsets(array, size) {
  if (size === 0) {
    yield [];
    return;
  }

  if (size > array.length) return;

  // Include first element
  for (const subset of generateSubsets(array.slice(1), size - 1)) {
    yield [array[0], ...subset];
  }

  // Exclude first element
  for (const subset of generateSubsets(array.slice(1), size)) {
    yield subset;
  }
}

/**
 * Coalition value function: determines playoff ranking contribution
 * This measures how many teams FROM THE COALITION would make playoffs
 * if they competed against ALL teams in the league
 *
 * @param {Array} coalition - Teams in the coalition
 * @param {Array} allTeams - All teams in league
 * @param {number} playoffSpots - Number of playoff spots
 * @param {string} recordType - 'actual' or 'allplay' for which win% to use
 */
function coalitionValue(coalition, allTeams, playoffSpots, recordType = 'actual') {
  if (coalition.length === 0) return 0;

  // Get teams NOT in coalition
  const coalitionIds = new Set(coalition.map(t => t.id));
  const nonCoalitionTeams = allTeams.filter(t => !coalitionIds.has(t.id));

  // Combine coalition with non-coalition teams to simulate full league
  const fullLeague = [...coalition, ...nonCoalitionTeams];

  // Sort by win-loss record first, then points as tiebreaker
  const sorted = fullLeague.sort((a, b) => {
    // Choose which win percentage to use
    let aWinPct, bWinPct;

    if (recordType === 'allplay') {
      aWinPct = a.allPlayWinPct || 0;
      bWinPct = b.allPlayWinPct || 0;
    } else {
      aWinPct = a.winPct || (a.wins / (a.wins + a.losses || 1));
      bWinPct = b.winPct || (b.wins / (b.wins + b.losses || 1));
    }

    if (Math.abs(aWinPct - bWinPct) < 0.001) {
      // Tiebreaker: points
      return (b.points || 0) - (a.points || 0);
    }
    return bWinPct - aWinPct;
  });

  // Count how many teams from the COALITION made playoffs
  let playoffTeams = 0;
  const playoffQualifiers = sorted.slice(0, playoffSpots);

  for (const team of playoffQualifiers) {
    if (coalitionIds.has(team.id)) {
      playoffTeams++;
    }
  }

  return playoffTeams;
}

/**
 * Alternative coalition value: competitive balance contribution
 * Measures how much a team increases overall league competitiveness
 */
function competitiveBalanceValue(coalition, allTeams) {
  if (coalition.length === 0) return 0;

  // Calculate variance in win percentages (lower variance = more competitive)
  const winPcts = coalition.map(t => t.winPct);
  const mean = winPcts.reduce((sum, pct) => sum + pct, 0) / winPcts.length;
  const variance = winPcts.reduce((sum, pct) => sum + Math.pow(pct - mean, 2), 0) / winPcts.length;

  // Return inverse variance (higher is better for competition)
  return variance > 0 ? 1 / variance : 0;
}

/**
 * Calculate Shapley value for a single team
 * The Shapley value represents a team's marginal contribution to all possible coalitions
 */
export function calculateShapleyValue(team, allTeams, valueFunction = 'playoffs', playoffSpots = 6, recordType = 'actual') {
  const n = allTeams.length;
  const otherTeams = allTeams.filter(t => t.id !== team.id);
  let shapleyValue = 0;

  // For each possible coalition size
  for (let size = 0; size < n; size++) {
    const weight = (factorial(size) * factorial(n - size - 1)) / factorial(n);
    let marginalSum = 0;
    let count = 0;

    // Generate all coalitions of this size not containing the team
    for (const coalition of generateSubsets(otherTeams, size)) {
      // Value with team
      const coalitionWithTeam = [...coalition, team];
      const valueWith = valueFunction === 'playoffs'
        ? coalitionValue(coalitionWithTeam, allTeams, playoffSpots, recordType)
        : competitiveBalanceValue(coalitionWithTeam, allTeams);

      // Value without team
      const valueWithout = valueFunction === 'playoffs'
        ? coalitionValue(coalition, allTeams, playoffSpots, recordType)
        : competitiveBalanceValue(coalition, allTeams);

      // Marginal contribution
      marginalSum += (valueWith - valueWithout);
      count++;
    }

    if (count > 0) {
      shapleyValue += weight * (marginalSum / count);
    }
  }

  return shapleyValue;
}

/**
 * Calculate Shapley values for all teams in league
 * Returns array of teams with their Shapley scores
 *
 * @param {Array} teams - Array of team objects with roster data
 * @param {string} valueFunction - 'playoffs' or 'competitive'
 * @param {number} playoffSpots - Number of playoff spots
 * @param {Array} matchups - Optional matchups data for all-play calculation
 * @param {string} recordType - 'actual' or 'allplay'
 */
export function calculateLeagueShapleyValues(teams, valueFunction = 'playoffs', playoffSpots = 6, matchups = null, recordType = 'actual') {
  // If using all-play records, preprocess all-play data for each team
  let teamsWithRecords = teams;

  if (recordType === 'allplay' && matchups) {
    teamsWithRecords = teams.map(team => {
      const allPlayData = calculateAllPlayRecord(team.roster_id, matchups);
      return {
        ...team,
        allPlayWins: allPlayData.allPlayWins,
        allPlayLosses: allPlayData.allPlayLosses,
        allPlayTies: allPlayData.allPlayTies,
        allPlayWinPct: allPlayData.allPlayWinPct
      };
    });
  }

  // For large leagues (>10 teams), use Monte Carlo approximation
  const useMonteCarlo = teamsWithRecords.length > 10;

  if (useMonteCarlo) {
    return calculateShapleyValuesMonteCarlo(teamsWithRecords, valueFunction, playoffSpots, 1000, recordType);
  }

  return teamsWithRecords.map(team => ({
    ...team,
    shapleyValue: calculateShapleyValue(team, teamsWithRecords, valueFunction, playoffSpots, recordType)
  }));
}

/**
 * Monte Carlo approximation for Shapley values (faster for large leagues)
 */
function calculateShapleyValuesMonteCarlo(teams, valueFunction, playoffSpots, samples = 1000, recordType = 'actual') {
  const n = teams.length;
  const contributions = teams.map(() => []);

  // Run Monte Carlo simulations
  for (let i = 0; i < samples; i++) {
    // Random permutation of teams
    const permutation = [...teams].sort(() => Math.random() - 0.5);

    // Calculate marginal contribution for each position
    for (let j = 0; j < n; j++) {
      const team = permutation[j];
      const teamIndex = teams.findIndex(t => t.id === team.id);

      // Coalition before adding this team
      const coalitionBefore = permutation.slice(0, j);
      const valueBefore = valueFunction === 'playoffs'
        ? coalitionValue(coalitionBefore, teams, playoffSpots, recordType)
        : competitiveBalanceValue(coalitionBefore, teams);

      // Coalition after adding this team
      const coalitionAfter = permutation.slice(0, j + 1);
      const valueAfter = valueFunction === 'playoffs'
        ? coalitionValue(coalitionAfter, teams, playoffSpots, recordType)
        : competitiveBalanceValue(coalitionAfter, teams);

      // Store marginal contribution
      contributions[teamIndex].push(valueAfter - valueBefore);
    }
  }

  // Calculate average contribution for each team
  return teams.map((team, i) => ({
    ...team,
    shapleyValue: contributions[i].reduce((sum, val) => sum + val, 0) / contributions[i].length
  }));
}

/**
 * Calculate Shapley value for a team's ranking contribution
 * This measures how much a team "earned" their ranking position
 */
export function calculateRankingShapley(team, allTeams) {
  // Use points scored as the value function
  const teamsWithPoints = allTeams.map(t => ({
    id: t.id || t.team,
    team: t.team,
    points: t.points || t.points_for,
    winPct: t.winPct || t.win_pct,
    wins: t.wins,
    losses: t.losses
  }));

  return calculateShapleyValue(team, teamsWithPoints, 'playoffs', 6);
}

/**
 * Interpret Shapley value with context
 */
export function interpretShapleyValue(shapleyValue, avgShapleyValue, rank) {
  const relativeValue = avgShapleyValue > 0 ? shapleyValue / avgShapleyValue : 1;

  let interpretation = '';
  let category = '';

  if (relativeValue > 1.3) {
    category = 'Elite Contributor';
    interpretation = 'This team significantly elevated the league\'s competitive quality. Their presence made playoff races more meaningful.';
  } else if (relativeValue > 1.1) {
    category = 'Strong Contributor';
    interpretation = 'This team contributed above-average value to the league standings and playoff picture.';
  } else if (relativeValue > 0.9) {
    category = 'Balanced Contributor';
    interpretation = 'This team provided proportional value to their ranking. They earned their spot fairly.';
  } else if (relativeValue > 0.7) {
    category = 'Lucky/Underperformed';
    interpretation = 'This team may have benefited from favorable scheduling or underperformed relative to their potential.';
  } else {
    category = 'Limited Impact';
    interpretation = 'This team had minimal influence on playoff outcomes and league competitiveness.';
  }

  return {
    category,
    interpretation,
    relativeValue: relativeValue.toFixed(2),
    percentile: relativeValue > 1 ? Math.min(95, 50 + (relativeValue - 1) * 50) : Math.max(5, 50 - (1 - relativeValue) * 50)
  };
}

/**
 * Calculate all-play record for a team (schedule-independent metric)
 * For each week, compares team's score against ALL other teams that week
 * This answers: "What if this team played everyone each week?"
 */
export function calculateAllPlayRecord(teamId, matchups) {
  let allPlayWins = 0;
  let allPlayLosses = 0;
  let allPlayTies = 0;

  // Iterate through each week
  for (const week of matchups) {
    // Find this team's matchup for the week
    const teamMatchup = week.matchups.find(m => m.roster_id === teamId);
    if (!teamMatchup) continue; // Team might have been on bye or no data

    const teamScore = teamMatchup.points;

    // Compare against all other teams that week
    for (const opponent of week.matchups) {
      if (opponent.roster_id === teamId) continue; // Skip self

      if (teamScore > opponent.points) {
        allPlayWins++;
      } else if (teamScore < opponent.points) {
        allPlayLosses++;
      } else {
        allPlayTies++;
      }
    }
  }

  const totalGames = allPlayWins + allPlayLosses + allPlayTies;
  const allPlayWinPct = totalGames > 0 ? allPlayWins / totalGames : 0;

  return {
    allPlayWins,
    allPlayLosses,
    allPlayTies,
    allPlayWinPct
  };
}
