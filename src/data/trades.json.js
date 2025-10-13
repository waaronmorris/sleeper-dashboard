// Data loader for Sleeper league trades (all historical years)
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchLeague(leagueId) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchTransactions(leagueId, week) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
  if (!response.ok) {
    console.error(`Failed to fetch transactions for league ${leagueId} week ${week}: ${response.statusText}`);
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

async function fetchAllTrades() {
  // Get all leagues in the chain
  const leagues = await fetchLeagueChain(LEAGUE_ID);

  const allTrades = [];

  // Fetch trades from each league
  for (const league of leagues) {
    console.error(`Fetching trades for ${league.season} season...`);

    // Fetch transactions for all weeks in this league
    for (let week = 1; week <= league.current_week; week++) {
      try {
        const transactions = await fetchTransactions(league.league_id, week);
        const trades = transactions.filter(t => t.type === 'trade');

        // Add week and season information to each trade
        trades.forEach(trade => {
          allTrades.push({
            ...trade,
            week: week,
            season: league.season,
            league_id: league.league_id
          });
        });
      } catch (error) {
        console.error(`Error fetching week ${week} for season ${league.season}:`, error.message);
      }
    }
  }

  console.error(`Total trades fetched: ${allTrades.length}`);
  return allTrades;
}

const trades = await fetchAllTrades();
process.stdout.write(JSON.stringify(trades, null, 2));
