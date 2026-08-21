// Season picker shared by every page.
//
//   import {mountSeasonPicker} from "./components/season.js";
//   const seasonsData = await FileAttachment("data/seasons.json").json();
//   const season = Generators.input(mountSeasonPicker(seasonsData));
//   const S = seasonsData.by_season[season];   // {league, rosters, users, matchups, ...}
//
// The picker lives in the site header (slot #shell-season). The choice is kept in the URL
// (?season=2025) and localStorage so it follows the reader from page to page.

const KEY = "sap:season";

function readChoice(seasons, fallback) {
  const fromUrl = new URLSearchParams(location.search).get("season");
  if (fromUrl && seasons.includes(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && seasons.includes(stored)) return stored;
  } catch {}
  return fallback;
}

function writeChoice(season, isCurrent) {
  try { localStorage.setItem(KEY, season); } catch {}
  const url = new URL(location.href);
  if (isCurrent) url.searchParams.delete("season"); else url.searchParams.set("season", season);
  history.replaceState(null, "", url);
  // Keep in-page links on the same season
  document.querySelectorAll('a[href^="./"], .shell-nav a').forEach(a => {
    const u = new URL(a.getAttribute("href"), location.href);
    if (isCurrent) u.searchParams.delete("season"); else u.searchParams.set("season", season);
    a.setAttribute("href", u.pathname.replace(/^.*\//, "./") + u.search);
  });
}

export function mountSeasonPicker(seasonsData, {slot = "#shell-season"} = {}) {
  const seasons = seasonsData.seasons;
  const current = seasonsData.current;
  const select = document.createElement("select");
  select.className = "shell-season__select";
  select.setAttribute("aria-label", "Season");
  for (const s of seasons) {
    const opt = document.createElement("option");
    opt.value = s;
    const meta = seasonsData.by_season[s];
    opt.textContent = s + (meta?.is_current ? " · current" : "");
    select.appendChild(opt);
  }
  select.value = readChoice(seasons, current);
  writeChoice(select.value, select.value === current);
  select.addEventListener("input", () => writeChoice(select.value, select.value === current));

  const wrapper = document.createElement("label");
  wrapper.className = "shell-season";
  wrapper.innerHTML = `<span class="shell-season__k">Season</span>`;
  wrapper.appendChild(select);

  // Mount into the header slot once the shell exists (the shell is built on DOMContentLoaded)
  const tryMount = () => {
    const target = document.querySelector(slot);
    if (target) { target.replaceChildren(wrapper); return true; }
    return false;
  };
  if (!tryMount()) {
    document.addEventListener("DOMContentLoaded", tryMount, {once: true});
    // Fallback if the shell never appears (e.g. embedded): render at the top of main
    setTimeout(() => { if (!wrapper.isConnected) document.querySelector("main, #observablehq-main")?.prepend(wrapper); }, 1500);
  }
  return select;
}

// Convenience: standings rows from a season bundle (same shape pages already compute)
export function seasonStandings(S) {
  return (S.rosters || []).map(roster => {
    const st = roster.settings || {};
    const user = (S.users || []).find(u => u.user_id === roster.owner_id);
    const games = (st.wins || 0) + (st.losses || 0) + (st.ties || 0);
    const pf = (st.fpts || 0) + (st.fpts_decimal || 0) / 100;
    const pa = (st.fpts_against || 0) + (st.fpts_against_decimal || 0) / 100;
    return {
      roster_id: roster.roster_id,
      owner_id: roster.owner_id,
      team: user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`,
      display_name: user?.display_name || roster.owner_id,
      wins: st.wins || 0, losses: st.losses || 0, ties: st.ties || 0,
      points_for: pf, points_against: pa,
      win_pct: games ? (st.wins || 0) / games : 0,
      ppg: games ? pf / games : 0, papg: games ? pa / games : 0,
      point_diff: pf - pa, total_games: games
    };
  }).sort((a, b) => b.win_pct - a.win_pct || b.points_for - a.points_for);
}
