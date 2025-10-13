// Data loader for retired players (players no longer on any roster)
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchLeague(leagueId) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchRosters(leagueId) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  if (!response.ok) throw new Error(`Failed to fetch rosters: ${response.statusText}`);
  return await response.json();
}

async function fetchTransactions(leagueId, week) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
  if (!response.ok) {
    return [];
  }
  return await response.json();
}

async function fetchMatchups(leagueId, week) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
  if (!response.ok) {
    return [];
  }
  return await response.json();
}

async function fetchLeagueChain(startLeagueId) {
  const leagues = [];
  let currentLeagueId = startLeagueId;

  // Fetch up to 10 years back
  for (let i = 0; i < 10; i++) {
    try {
      const league = await fetchLeague(currentLeagueId);
      leagues.push({
        league_id: league.league_id,
        season: league.season,
        current_week: league.settings.leg || 18,
        previous_league_id: league.previous_league_id
      });

      if (!league.previous_league_id) break;
      currentLeagueId = league.previous_league_id;
    } catch (error) {
      console.error(`Error fetching league ${currentLeagueId}:`, error.message);
      break;
    }
  }

  return leagues;
}

async function buildPlayerRosterHistory() {
  const leagues = await fetchLeagueChain(LEAGUE_ID);

  // Track player stats and roster appearance for each stint on a roster
  // playerId -> rosterId -> {gamesPlayed, totalPoints, weeks: [{season, week, points}], firstSeen, lastSeen}
  const playerStatsOnRoster = {};

  // Process each league/season - use matchup data as source of truth
  for (const league of leagues) {
    console.error(`Processing ${league.season} season...`);

    // Fetch matchup data to get player points and roster assignments
    for (let week = 1; week <= league.current_week; week++) {
      try {
        const matchups = await fetchMatchups(league.league_id, week);

        matchups.forEach(matchup => {
          const rosterId = matchup.roster_id;

          // Track points for each player on this roster this week
          if (matchup.players_points) {
            Object.entries(matchup.players_points).forEach(([playerId, points]) => {
              if (!playerStatsOnRoster[playerId]) playerStatsOnRoster[playerId] = {};
              if (!playerStatsOnRoster[playerId][rosterId]) {
                playerStatsOnRoster[playerId][rosterId] = {
                  gamesPlayed: 0,
                  totalPoints: 0,
                  weeks: [],
                  firstSeen: { season: league.season, week },
                  lastSeen: { season: league.season, week }
                };
              }

              playerStatsOnRoster[playerId][rosterId].gamesPlayed++;
              playerStatsOnRoster[playerId][rosterId].totalPoints += points || 0;
              playerStatsOnRoster[playerId][rosterId].weeks.push({
                season: league.season,
                week,
                points: points || 0
              });
              playerStatsOnRoster[playerId][rosterId].lastSeen = { season: league.season, week };
            });
          }
        });
      } catch (error) {
        console.error(`Error fetching matchups for week ${week} season ${league.season}:`, error.message);
      }
    }
  }

  return { playerStatsOnRoster, leagues };
}

async function calculateRetirees() {
  const { playerStatsOnRoster, leagues } = await buildPlayerRosterHistory();

  // Get current rosters
  const currentRosters = await fetchRosters(LEAGUE_ID);
  const currentlyRosteredPlayers = new Set();

  currentRosters.forEach(roster => {
    (roster.players || []).forEach(playerId => {
      currentlyRosteredPlayers.add(playerId);
    });
  });

  // Find retired players (players who appeared in matchups but aren't currently rostered)
  const retiredPlayers = [];
  const currentYear = new Date().getFullYear().toString();

  Object.entries(playerStatsOnRoster).forEach(([playerId, rosterStats]) => {
    // Skip if player is still rostered
    if (currentlyRosteredPlayers.has(playerId)) return;

    // For each roster this player played on, create a retiree record for their last stint
    const rosters = Object.entries(rosterStats);

    // Find the roster where they last played (most recent lastSeen)
    let lastRoster = null;
    let lastSeenDate = null;

    rosters.forEach(([rosterId, stats]) => {
      const lastSeenKey = `${stats.lastSeen.season}-${stats.lastSeen.week}`;
      if (!lastSeenDate || lastSeenKey > lastSeenDate) {
        lastSeenDate = lastSeenKey;
        lastRoster = { rosterId, stats };
      }
    });

    if (lastRoster) {
      const { rosterId, stats } = lastRoster;

      // Skip if last seen in current year - they might return
      if (stats.lastSeen.season === currentYear) {
        return;
      }

      retiredPlayers.push({
        playerId,
        lastRosterId: parseInt(rosterId),
        firstWeek: stats.firstSeen,
        lastWeek: stats.lastSeen,
        gamesPlayed: stats.gamesPlayed,
        totalPoints: stats.totalPoints,
        averagePoints: stats.gamesPlayed > 0 ? stats.totalPoints / stats.gamesPlayed : 0,
        weeks: stats.weeks
      });
    }
  });

  console.error(`Found ${retiredPlayers.length} retired players`);
  return retiredPlayers;
}

const retirees = await calculateRetirees();
process.stdout.write(JSON.stringify(retirees, null, 2));
