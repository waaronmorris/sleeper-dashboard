// Data loader: KeepTradeCut (KTC) dynasty trade value per team.
//
// KTC has no public API; its rankings page embeds a `playersArray` JSON blob which we parse.
// Players are matched to Sleeper by normalized name + position (KTC carries no Sleeper ID).
// Future rookie picks are valued using KTC's "Mid" tier for each season/round, since final
// draft slots are unknown until the season ends. Output per team:
//   player_value, pick_value, total_value, matched/unmatched counts, top players
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;

async function getJson(url, fallback = null) {
  const r = await fetch(url);
  if (!r.ok) {
    if (fallback !== null) return fallback;
    throw new Error(`Failed ${url}: ${r.statusText}`);
  }
  return r.json();
}

const [league, rosters, tradedPicks, players] = await Promise.all([
  getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`),
  getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`),
  getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/traded_picks`, []),
  getJson("https://api.sleeper.app/v1/players/nfl")
]);

// Superflex values if the league starts a SUPER_FLEX (or 2+ QB) slot, else 1QB values
const positions = league.roster_positions || [];
const isSuperflex = positions.includes("SUPER_FLEX") || positions.filter(p => p === "QB").length > 1;
const format = isSuperflex ? 2 : 1;
const valueKey = isSuperflex ? "superflexValues" : "oneQBValues";

// --- Fetch & parse KTC -------------------------------------------------------------------
const ktcHtml = await fetch(`https://keeptradecut.com/dynasty-rankings?format=${format}`, {
  headers: { "User-Agent": "Mozilla/5.0 (sleeper-dashboard)" }
}).then(r => r.ok ? r.text() : "");
const match = ktcHtml.match(/var playersArray = (\[[\s\S]*?\]);\s*\n/);
let ktc = [];
try { ktc = match ? JSON.parse(match[1]) : []; } catch { ktc = []; }
if (!ktc.length) console.error("⚠️ KTC: could not parse playersArray; values will be empty");

const normalize = name => (name || "")
  .toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
  .replace(/[^a-z]/g, "");

const ktcPlayers = new Map();   // `${name}|${pos}` -> entry
const ktcByName = new Map();    // name -> [entries]
const ktcPicks = new Map();     // "2027 Mid 1st" -> value
for (const p of ktc) {
  const value = p[valueKey]?.value ?? 0;
  if (p.position === "RDP") { ktcPicks.set(p.playerName, value); continue; }
  const entry = { name: p.playerName, position: p.position, team: p.team, value, rank: p[valueKey]?.rank ?? null, age: p.age };
  const key = `${normalize(p.playerName)}|${p.position}`;
  ktcPlayers.set(key, entry);
  const n = normalize(p.playerName);
  ktcByName.set(n, [...(ktcByName.get(n) || []), entry]);
}

function lookupPlayer(sleeperId) {
  const sp = players[sleeperId];
  if (!sp) return null;
  const name = sp.full_name || `${sp.first_name || ""} ${sp.last_name || ""}`;
  const n = normalize(name);
  const pos = sp.position;
  return ktcPlayers.get(`${n}|${pos}`)
    || (ktcByName.get(n)?.length === 1 ? ktcByName.get(n)[0] : null);
}

// --- Future picks ------------------------------------------------------------------------
const draftRounds = league.settings?.draft_rounds || 3;
const currentSeason = Number(league.season);
// Current-season picks only count if that draft hasn't happened yet
const currentDraft = league.draft_id ? await getJson(`https://api.sleeper.app/v1/draft/${league.draft_id}`, {}) : {};
const currentDraftDone = !league.draft_id || currentDraft.status === "complete";
const trackedSeasons = new Set(tradedPicks.map(p => Number(p.season)));
const firstSeason = currentDraftDone ? currentSeason + 1 : currentSeason;
const lastSeason = Math.max(firstSeason + 1, ...trackedSeasons);
const seasons = [];
for (let s = firstSeason; s <= lastSeason; s++) seasons.push(s);

const ordinal = r => r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : `${r}th`;
function pickValue(season, round) {
  return ktcPicks.get(`${season} Mid ${ordinal(round)}`) ?? ktcPicks.get(`${season} ${ordinal(round)}`) ?? 0;
}

// Ownership: default every roster owns its own pick; traded_picks overrides (roster_id = original owner)
const pickOwner = new Map(); // `${season}-${round}-${originalRoster}` -> owner roster_id
for (const r of rosters) for (const s of seasons) for (let rd = 1; rd <= draftRounds; rd++) {
  pickOwner.set(`${s}-${rd}-${r.roster_id}`, r.roster_id);
}
for (const tp of tradedPicks) {
  const key = `${tp.season}-${tp.round}-${tp.roster_id}`;
  if (pickOwner.has(key)) pickOwner.set(key, tp.owner_id);
}

// --- Replacement level -------------------------------------------------------------------
// The KTC value of a roster built entirely from the best unrostered players (no picks).
// Every team has at least this much "value" just from holding a full roster; the surplus is what matters.
const rosteredIds = new Set(rosters.flatMap(r => r.players || []));
const rosterSize = Math.round(rosters.reduce((s, r) => s + (r.players || []).length, 0) / Math.max(1, rosters.length));
const matchedRostered = new Set();
for (const id of rosteredIds) { const e = lookupPlayer(id); if (e) matchedRostered.add(`${normalize(e.name)}|${e.position}`); }
const freeAgentValues = [...ktcPlayers.entries()]
  .filter(([key]) => !matchedRostered.has(key))
  .map(([, e]) => e.value)
  .sort((a, b) => b - a);
const replacementRosterValue = freeAgentValues.slice(0, rosterSize).reduce((s, v) => s + v, 0);

// --- Per-team totals ---------------------------------------------------------------------
const teams = rosters.map(roster => {
  const ids = roster.players || [];
  const matched = [];
  const unmatched = [];
  for (const id of ids) {
    const e = lookupPlayer(id);
    const sp = players[id];
    if (e && e.value > 0) matched.push({ sleeper_id: id, ...e });
    else unmatched.push({ sleeper_id: id, name: sp?.full_name || id, position: sp?.position || null });
  }
  matched.sort((a, b) => b.value - a.value);
  const playerValue = matched.reduce((s, p) => s + p.value, 0);

  const picks = [];
  for (const [key, owner] of pickOwner) {
    if (owner !== roster.roster_id) continue;
    const [season, round, original] = key.split("-").map(Number);
    picks.push({ season, round, original_roster_id: original, value: pickValue(season, round) });
  }
  picks.sort((a, b) => b.value - a.value);
  const pickValueTotal = picks.reduce((s, p) => s + p.value, 0);

  return {
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    player_value: playerValue,
    pick_value: pickValueTotal,
    total_value: playerValue + pickValueTotal,
    matched_players: matched.length,
    unmatched_players: unmatched.length,
    top_players: matched.slice(0, 5).map(p => ({ name: p.name, position: p.position, value: p.value })),
    unmatched: unmatched.map(u => u.name),
    picks
  };
});

process.stdout.write(JSON.stringify({
  source: "keeptradecut.com",
  format: isSuperflex ? "superflex" : "1qb",
  fetched_at: new Date().toISOString(),
  ktc_players_loaded: ktcPlayers.size,
  pick_seasons: seasons,
  pick_rounds: draftRounds,
  roster_size: rosterSize,
  replacement_roster_value: replacementRosterValue,
  teams
}, null, 2));
