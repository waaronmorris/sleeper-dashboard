// Data loader for Sleeper league users
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1182940167115010048";

async function fetchUsers() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`);
  if (!response.ok) throw new Error(`Failed to fetch users: ${response.statusText}`);
  return await response.json();
}

const users = await fetchUsers();
process.stdout.write(JSON.stringify(users, null, 2));
