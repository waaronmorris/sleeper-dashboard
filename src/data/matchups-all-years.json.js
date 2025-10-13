// Data loader for Sleeper matchups (all historical years)
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchLeague(leagueId) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchMatchupsForLeague(leagueId) {
  const league = await fetchLeague(leagueId);
  const currentWeek = league.settings.leg || 18; // Default to 18 weeks if not specified
  const matchups = [];

  // Fetch matchups for each week of the season
  for (let week = 1; week <= currentWeek; week++) {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
    if (response.ok) {
      const weekMatchups = await response.json();
      matchups.push({
        week,
        matchups: weekMatchups
      });
    } else {
      console.error(`Failed to fetch matchups for week ${week} in league ${leagueId}`);
    }
  }

  return matchups;
}

async function fetchLeagueChain(startLeagueId) {
  const leagues = [];
  let currentLeagueId = startLeagueId;

  // Fetch up to 10 years back (or until no previous league exists)
  for (let i = 0; i < 10; i++) {
    try {
      const league = await fetchLeague(currentLeagueId);
      leagues.push({
        league_id: league.league_id,
        season: league.season,
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

async function getAllMatchupData() {
  // Get all leagues in the chain
  const leagues = await fetchLeagueChain(LEAGUE_ID);

  // Fetch matchup data for each league
  const matchupsByYear = {};

  for (const league of leagues) {
    try {
      const matchups = await fetchMatchupsForLeague(league.league_id);
      matchupsByYear[league.season] = {
        leagueId: league.league_id,
        season: league.season,
        matchups: matchups || []
      };
    } catch (error) {
      console.error(`Error fetching matchup data for ${league.season}:`, error.message);
    }
  }

  return matchupsByYear;
}

const matchupData = await getAllMatchupData();
process.stdout.write(JSON.stringify(matchupData, null, 2));
