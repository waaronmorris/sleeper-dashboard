// Data loader for Sleeper league information
// Set your league ID here or pass it as an environment variable
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchLeague() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

const league = await fetchLeague();
process.stdout.write(JSON.stringify(league, null, 2));
