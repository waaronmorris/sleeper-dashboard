// Data loader: every season in this league's chain, keyed by year.
// Starts from SLEEPER_LEAGUE_ID and walks previous_league_id back to the first season.
// Each season carries league, rosters, users, and per-week matchups (regular + playoffs).
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;
if (!LEAGUE_ID) throw new Error("SLEEPER_LEAGUE_ID is not set");

async function getJson(url, fallback = null) {
  const r = await fetch(url);
  if (!r.ok) {
    if (fallback !== null) return fallback;
    throw new Error(`Failed ${url}: ${r.statusText}`);
  }
  return r.json();
}

// Walk the chain (cap at 15 seasons)
const chain = [];
let id = LEAGUE_ID;
for (let i = 0; i < 15 && id; i++) {
  const league = await getJson(`https://api.sleeper.app/v1/league/${id}`);
  chain.push(league);
  id = league.previous_league_id;
}

const state = await getJson("https://api.sleeper.app/v1/state/nfl");

async function loadSeason(league, isCurrent) {
  const [rosters, users] = await Promise.all([
    getJson(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`, []),
    getJson(`https://api.sleeper.app/v1/league/${league.league_id}/users`, [])
  ]);
  // Weeks: through the last playoff week for finished seasons; through the current leg otherwise
  const playoffStart = league.settings?.playoff_week_start || 15;
  const playoffRounds = Math.ceil(Math.log2(league.settings?.playoff_teams || 6));
  const lastWeek = league.status === "complete"
    ? Math.min(18, playoffStart + playoffRounds - 1)
    : Math.max(1, league.settings?.leg || 1);
  const weeks = Array.from({ length: lastWeek }, (_, i) => i + 1);
  const matchups = await Promise.all(weeks.map(async week => ({
    week,
    matchups: await getJson(`https://api.sleeper.app/v1/league/${league.league_id}/matchups/${week}`, [])
  })));
  return {
    season: league.season,
    league_id: league.league_id,
    status: league.status,
    is_current: isCurrent,
    playoff_week_start: playoffStart,
    league,
    rosters,
    users,
    matchups: matchups.filter(w => w.matchups.length)
  };
}

const seasons = await Promise.all(chain.map((league, i) => loadSeason(league, i === 0)));

const by_season = Object.fromEntries(seasons.map(s => [s.season, s]));
process.stdout.write(JSON.stringify({
  current: chain[0].season,
  nfl_state: { season: state.league_season, week: state.week, season_type: state.season_type },
  seasons: seasons.map(s => s.season),
  by_season
}));
