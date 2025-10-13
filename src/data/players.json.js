// Data loader for all NFL players from Sleeper
// This is a large dataset that gets cached

async function fetchPlayers() {
  const response = await fetch('https://api.sleeper.app/v1/players/nfl');
  if (!response.ok) throw new Error(`Failed to fetch players: ${response.statusText}`);
  return await response.json();
}

const players = await fetchPlayers();
process.stdout.write(JSON.stringify(players, null, 2));
