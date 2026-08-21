// Data loader: per-team season outlook blending actual points with projected rest-of-season points.
//
// For every regular-season week not yet played, each roster's optimal lineup is scored using
// Sleeper's weekly projections and the league's own scoring_settings. Output per team:
//   actual_points, games_played, projected_ros_points, weeks_remaining, blended_points
// where blended_points = actual_points + projected_ros_points (i.e. expected full-season total).
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;

const FLEX_ELIGIBLE = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  IDP_FLEX: ["DL", "LB", "DB"]
};
const SKIP_SLOTS = new Set(["BN", "IR", "TAXI"]);

async function getJson(url, fallback = null) {
  const r = await fetch(url);
  if (!r.ok) {
    if (fallback !== null) return fallback;
    throw new Error(`Failed ${url}: ${r.statusText}`);
  }
  return r.json();
}

const [league, rosters, state] = await Promise.all([
  getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`),
  getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`),
  getJson("https://api.sleeper.app/v1/state/nfl")
]);

const season = league.season;
const scoring = league.scoring_settings || {};
const startWeek = league.settings?.start_week || 1;
const playoffStart = league.settings?.playoff_week_start || 15;
const lastRegularWeek = playoffStart - 1;
const lineupSlots = (league.roster_positions || []).filter(s => !SKIP_SLOTS.has(s));

// Which regular-season weeks are already played? A week counts as played once it has scored matchups.
const weekMatchups = await Promise.all(
  Array.from({ length: lastRegularWeek - startWeek + 1 }, (_, i) => startWeek + i).map(async week => ({
    week,
    matchups: await getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}`, [])
  }))
);
const isLeagueSeason = state.league_season === season && state.season_type === "regular";
const seasonIsOver = Number(season) < Number(state.league_season) || league.status === "complete" ||
  (state.league_season === season && state.season_type === "post");
// Before kickoff nothing is played; after the season everything is; in-season use the current week
const currentWeek = seasonIsOver ? Infinity : isLeagueSeason ? state.week : 0;
const playedWeeks = new Set(
  weekMatchups
    .filter(({ week, matchups }) => week < currentWeek && matchups.some(m => (m.points || 0) > 0))
    .map(d => d.week)
);
const remainingWeeks = weekMatchups.map(d => d.week).filter(w => !playedWeeks.has(w));

// Score a projection row with league scoring (falls back to Sleeper's half/full PPR totals)
function scoreProjection(stats) {
  if (!stats) return 0;
  let hasAny = false;
  let pts = 0;
  for (const [stat, weight] of Object.entries(scoring)) {
    if (!weight || stats[stat] == null) continue;
    hasAny = true;
    pts += stats[stat] * weight;
  }
  if (hasAny) return pts;
  const rec = scoring.rec ?? 0;
  return rec >= 1 ? (stats.pts_ppr ?? 0) : rec > 0 ? (stats.pts_half_ppr ?? 0) : (stats.pts_std ?? 0);
}

// Fetch projections for remaining weeks: Map<week, Map<player_id, {pts, position}>>
const weeklyProjections = new Map();
await Promise.all(remainingWeeks.map(async week => {
  const rows = await getJson(`https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular`, []);
  const byPlayer = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = row.player_id || row.player?.player_id;
    if (!id) continue;
    byPlayer.set(id, {
      pts: scoreProjection(row.stats),
      position: row.player?.position || row.player?.fantasy_positions?.[0] || null
    });
  }
  weeklyProjections.set(week, byPlayer);
}));

// Greedy optimal lineup: fill dedicated slots first, then flex slots from the leftovers
function optimalLineupPoints(playerIds, projections) {
  const pool = playerIds
    .map(id => ({ id, ...(projections.get(id) || { pts: 0, position: null }) }))
    .filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  const used = new Set();
  let total = 0;
  const take = eligible => {
    const pick = pool.find(p => !used.has(p.id) && eligible.includes(p.position));
    if (pick) { used.add(pick.id); total += pick.pts; }
  };
  lineupSlots.filter(s => !FLEX_ELIGIBLE[s]).forEach(slot => take([slot]));
  lineupSlots.filter(s => FLEX_ELIGIBLE[s]).forEach(slot => take(FLEX_ELIGIBLE[slot]));
  return total;
}

// Replacement level: the optimal lineup a team could field from unrostered players each week.
// Surplus above this is what actually separates teams; the baseline is shared by everyone.
const rosteredIds = new Set(rosters.flatMap(r => r.players || []));
const replacementWeekly = remainingWeeks.map(week => {
  const projections = weeklyProjections.get(week) || new Map();
  const freeAgents = [...projections.keys()].filter(id => !rosteredIds.has(id));
  return { week, projected: +optimalLineupPoints(freeAgents, projections).toFixed(2) };
});
const replacementRos = replacementWeekly.reduce((sum, w) => sum + w.projected, 0);
const replacementPpg = remainingWeeks.length ? replacementRos / remainingWeeks.length : 0;

const teams = rosters.map(roster => {
  const s = roster.settings || {};
  const actual = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
  const gamesPlayed = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
  const players = roster.players || [];
  const weekly = remainingWeeks.map(week => ({
    week,
    projected: +optimalLineupPoints(players, weeklyProjections.get(week) || new Map()).toFixed(2)
  }));
  const ros = weekly.reduce((sum, w) => sum + w.projected, 0);
  const totalWeeks = gamesPlayed + remainingWeeks.length;
  return {
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    actual_points: +actual.toFixed(2),
    games_played: gamesPlayed,
    wins: s.wins || 0,
    projected_ros_points: +ros.toFixed(2),
    projected_ros_ppg: remainingWeeks.length ? +(ros / remainingWeeks.length).toFixed(2) : 0,
    weeks_remaining: remainingWeeks.length,
    blended_points: +(actual + ros).toFixed(2),
    blended_ppg: totalWeeks ? +((actual + ros) / totalWeeks).toFixed(2) : 0,
    // Replacement-level baseline scaled to the same number of weeks as each metric
    replacement_ros_points: +replacementRos.toFixed(2),
    replacement_actual_points: +(replacementPpg * gamesPlayed).toFixed(2),
    replacement_blended_points: +(replacementPpg * totalWeeks).toFixed(2),
    weekly_projections: weekly
  };
});

process.stdout.write(JSON.stringify({
  season,
  generated_at: new Date().toISOString(),
  current_week: isLeagueSeason ? state.week : null,
  season_type: state.season_type,
  regular_season_weeks: lastRegularWeek - startWeek + 1,
  played_weeks: [...playedWeeks].sort((a, b) => a - b),
  remaining_weeks: remainingWeeks,
  actual_weight: teams.length ? playedWeeks.size / (lastRegularWeek - startWeek + 1) : 0,
  replacement_ppg: +replacementPpg.toFixed(2),
  replacement_weekly: replacementWeekly,
  teams
}, null, 2));
