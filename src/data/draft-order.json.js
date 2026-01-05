// Data loader for next season draft order
// Draft order logic:
// - Positions 1-6: Determined by playoff finish (champion picks last, etc.)
// - Positions 7+: Non-playoff teams ordered by reverse max points for (lowest max picks earliest)

const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;

async function fetchLeague() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchRosters() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`);
  if (!response.ok) throw new Error(`Failed to fetch rosters: ${response.statusText}`);
  return await response.json();
}

async function fetchUsers() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`);
  if (!response.ok) throw new Error(`Failed to fetch users: ${response.statusText}`);
  return await response.json();
}

async function fetchWinnersBracket() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/winners_bracket`);
  if (!response.ok) throw new Error(`Failed to fetch winners bracket: ${response.statusText}`);
  return await response.json();
}

async function fetchMatchups(league) {
  const currentWeek = league.settings.leg || 1;
  const allMatchups = [];

  for (let week = 1; week <= currentWeek; week++) {
    const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}`);
    if (response.ok) {
      const weekMatchups = await response.json();
      allMatchups.push({
        week,
        matchups: weekMatchups
      });
    }
  }

  return allMatchups;
}

// Determine playoff finish positions from bracket
function determinePlayoffFinishes(bracket, playoffTeams) {
  const finishes = {};

  // Find the championship game (highest round)
  const maxRound = Math.max(...bracket.map(m => m.r));

  // Championship game determines 1st and 2nd
  const championship = bracket.find(m => m.r === maxRound && m.t1_from?.w !== undefined);
  if (championship) {
    if (championship.w) {
      finishes[championship.w] = 1; // Champion
      const loser = championship.t1 === championship.w ? championship.t2 : championship.t1;
      if (loser) finishes[loser] = 2; // Runner-up
    } else if (championship.t1 && championship.t2) {
      // Game not yet played - both teams are finalists
      finishes[championship.t1] = 1;
      finishes[championship.t2] = 2;
    }
  }

  // Find 3rd place game or semi-final losers
  const semiFinals = bracket.filter(m => m.r === maxRound - 1);
  let thirdPlaceGame = bracket.find(m => m.r === maxRound && m.t1_from?.l !== undefined);

  if (thirdPlaceGame) {
    // There's a 3rd place game
    if (thirdPlaceGame.w) {
      finishes[thirdPlaceGame.w] = 3;
      const loser = thirdPlaceGame.t1 === thirdPlaceGame.w ? thirdPlaceGame.t2 : thirdPlaceGame.t1;
      if (loser) finishes[loser] = 4;
    } else if (thirdPlaceGame.t1 && thirdPlaceGame.t2) {
      finishes[thirdPlaceGame.t1] = 3;
      finishes[thirdPlaceGame.t2] = 4;
    }
  } else {
    // No 3rd place game - semi-final losers tie for 3rd
    let position = 3;
    for (const semi of semiFinals) {
      if (semi.w) {
        const loser = semi.t1 === semi.w ? semi.t2 : semi.t1;
        if (loser && !finishes[loser]) {
          finishes[loser] = position++;
        }
      }
    }
  }

  // Handle quarter-final losers (5th-6th or 5th-8th depending on bracket size)
  const quarterFinals = bracket.filter(m => m.r === maxRound - 2);
  let position = Math.max(...Object.values(finishes), 0) + 1;

  for (const qf of quarterFinals) {
    if (qf.w) {
      const loser = qf.t1 === qf.w ? qf.t2 : qf.t1;
      if (loser && !finishes[loser]) {
        finishes[loser] = position++;
      }
    }
  }

  // Handle first round losers if 8-team playoff
  const firstRound = bracket.filter(m => m.r === 1);
  for (const match of firstRound) {
    if (match.w) {
      const loser = match.t1 === match.w ? match.t2 : match.t1;
      if (loser && !finishes[loser]) {
        finishes[loser] = position++;
      }
    }
  }

  return finishes;
}

// Calculate max weekly score for each team
function calculateMaxWeeklyScores(matchups, rosters) {
  const maxScores = {};

  for (const roster of rosters) {
    maxScores[roster.roster_id] = 0;
  }

  for (const weekData of matchups) {
    for (const matchup of weekData.matchups) {
      const points = matchup.points || 0;
      if (points > maxScores[matchup.roster_id]) {
        maxScores[matchup.roster_id] = points;
      }
    }
  }

  return maxScores;
}

// Get team name helper
function getTeamName(rosterId, rosters, users) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return `Team ${rosterId}`;
  const user = users.find(u => u.user_id === roster.owner_id);
  return user?.display_name || user?.username || `Team ${rosterId}`;
}

async function calculateDraftOrder() {
  const [league, rosters, users, bracket, matchups] = await Promise.all([
    fetchLeague(),
    fetchRosters(),
    fetchUsers(),
    fetchWinnersBracket(),
    fetchLeague().then(l => fetchMatchups(l))
  ]);

  const playoffTeams = league.settings.playoff_teams || 6;
  const totalTeams = rosters.length;

  // Determine playoff finishes
  const playoffFinishes = determinePlayoffFinishes(bracket, playoffTeams);

  // Get all playoff roster IDs
  const playoffRosterIds = new Set(Object.keys(playoffFinishes).map(Number));

  // Calculate max weekly scores
  const maxScores = calculateMaxWeeklyScores(matchups, rosters);

  // Build draft order
  const draftOrder = [];

  // Non-playoff teams first (picks 1 to totalTeams - playoffTeams)
  // Ordered by reverse max points (lowest max picks first)
  const nonPlayoffTeams = rosters
    .filter(r => !playoffRosterIds.has(r.roster_id))
    .map(r => ({
      roster_id: r.roster_id,
      team: getTeamName(r.roster_id, rosters, users),
      max_points: maxScores[r.roster_id] || 0,
      total_points: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
      wins: r.settings.wins,
      losses: r.settings.losses
    }))
    .sort((a, b) => a.max_points - b.max_points); // Ascending - lowest max picks first

  let draftPosition = 1;
  for (const team of nonPlayoffTeams) {
    draftOrder.push({
      draft_position: draftPosition++,
      roster_id: team.roster_id,
      team: team.team,
      max_points: team.max_points,
      total_points: team.total_points,
      wins: team.wins,
      losses: team.losses,
      playoff_finish: null,
      category: 'non-playoff'
    });
  }

  // Playoff teams (picks from totalTeams - playoffTeams + 1 to totalTeams)
  // Ordered by playoff finish (worst finish picks first among playoff teams)
  const playoffTeamsData = rosters
    .filter(r => playoffRosterIds.has(r.roster_id))
    .map(r => ({
      roster_id: r.roster_id,
      team: getTeamName(r.roster_id, rosters, users),
      max_points: maxScores[r.roster_id] || 0,
      total_points: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
      wins: r.settings.wins,
      losses: r.settings.losses,
      playoff_finish: playoffFinishes[r.roster_id] || 999
    }))
    .sort((a, b) => b.playoff_finish - a.playoff_finish); // Descending - worst finish picks first

  for (const team of playoffTeamsData) {
    draftOrder.push({
      draft_position: draftPosition++,
      roster_id: team.roster_id,
      team: team.team,
      max_points: team.max_points,
      total_points: team.total_points,
      wins: team.wins,
      losses: team.losses,
      playoff_finish: team.playoff_finish,
      category: 'playoff'
    });
  }

  return {
    season: league.season,
    next_season: parseInt(league.season) + 1,
    total_teams: totalTeams,
    playoff_teams: playoffTeams,
    draft_order: draftOrder,
    league_name: league.name
  };
}

const draftOrder = await calculateDraftOrder();
process.stdout.write(JSON.stringify(draftOrder, null, 2));
