// Data loader for Sleeper rosters
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchRosters() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`);
  if (!response.ok) throw new Error(`Failed to fetch rosters: ${response.statusText}`);
  return await response.json();
}

const rosters = await fetchRosters();
process.stdout.write(JSON.stringify(rosters, null, 2));
