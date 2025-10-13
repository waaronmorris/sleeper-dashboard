// Data loader for Sleeper draft picks (all historical years)
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchLeague(leagueId) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchDraftPicks(draftId) {
  const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
  if (!response.ok) {
    console.error(`Failed to fetch draft picks for ${draftId}: ${response.statusText}`);
    return [];
  }
  return await response.json();
}

async function fetchTradedPicks(draftId) {
  const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/traded_picks`);
  if (!response.ok) {
    console.error(`Failed to fetch traded picks for ${draftId}: ${response.statusText}`);
    return [];
  }
  return await response.json();
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
        draft_id: league.draft_id,
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

async function getAllDraftData() {
  // Get all leagues in the chain
  const leagues = await fetchLeagueChain(LEAGUE_ID);

  // Fetch draft data for each league
  const draftsByYear = {};

  for (const league of leagues) {
    if (!league.draft_id) {
      console.error(`No draft ID found for league ${league.league_id} (${league.season})`);
      continue;
    }

    try {
      const [picks, tradedPicks] = await Promise.all([
        fetchDraftPicks(league.draft_id),
        fetchTradedPicks(league.draft_id)
      ]);

      draftsByYear[league.season] = {
        draftId: league.draft_id,
        leagueId: league.league_id,
        season: league.season,
        picks: picks || [],
        tradedPicks: tradedPicks || []
      };
    } catch (error) {
      console.error(`Error fetching draft data for ${league.season}:`, error.message);
    }
  }

  return draftsByYear;
}

const draftData = await getAllDraftData();
process.stdout.write(JSON.stringify(draftData, null, 2));
