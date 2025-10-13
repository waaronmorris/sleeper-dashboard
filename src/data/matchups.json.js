// Data loader for Sleeper matchups
// Fetches matchups for all weeks in the current season
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchMatchups() {
  // First, get league info to know how many weeks
  const leagueResponse = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`);
  if (!leagueResponse.ok) throw new Error(`Failed to fetch league: ${leagueResponse.statusText}`);
  const league = await leagueResponse.json();

  const currentWeek = league.settings.leg || 1;
  const allMatchups = [];

  // Fetch matchups for each week
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

const matchups = await fetchMatchups();
process.stdout.write(JSON.stringify(matchups, null, 2));
