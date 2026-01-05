// Data loader for next season draft order and future picks
// Draft order logic:
// - Positions 1-6: Determined by playoff finish (champion picks last, etc.)
// - Positions 7+: Non-playoff teams ordered by reverse max points for (lowest max picks earliest)
// - Traded picks are tracked and shown with current owner

const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID;

async function fetchLeague() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}`);
  if (!response.ok) throw new Error(`Failed to fetch league: ${response.statusText}`);
  return await response.json();
}

async function fetchRosters() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`);
  if (!response.ok) throw new Error(`Failed to fetch rosters: ${response.statusText}`);
  return await response.json();
}

async function fetchUsers() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`);
  if (!response.ok) throw new Error(`Failed to fetch users: ${response.statusText}`);
  return await response.json();
}

async function fetchWinnersBracket() {
  const response = await fetch(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/winners_bracket`);
  if (!response.ok) throw new Error(`Failed to fetch winners bracket: ${response.statusText}`);
  return await response.json();
}

async function fetchMatchups(league) {
  const currentWeek = league.settings.leg || 1;
  const allMatchups = [];

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

async function fetchTransactions(leagueId, week) {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
  if (!response.ok) {
    return [];
  }
  return await response.json();
}

// Fetch all trades from current and previous seasons to find all traded picks
async function fetchAllTradedPicks(league) {
  const currentWeek = league.settings.leg || 18;
  const allTradedPicks = [];

  // Fetch from current season
  for (let week = 1; week <= currentWeek; week++) {
    try {
      const transactions = await fetchTransactions(league.league_id, week);
      const trades = transactions.filter(t => t.type === 'trade');

      for (const trade of trades) {
        if (trade.draft_picks && trade.draft_picks.length > 0) {
          allTradedPicks.push(...trade.draft_picks);
        }
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Also fetch from previous league if exists (picks may have been traded in prior seasons)
  if (league.previous_league_id) {
    try {
      const prevLeagueResponse = await fetch(`https://api.sleeper.app/v1/league/${league.previous_league_id}`);
      if (prevLeagueResponse.ok) {
        const prevLeague = await prevLeagueResponse.json();
        const prevWeek = prevLeague.settings?.leg || 18;

        for (let week = 1; week <= prevWeek; week++) {
          try {
            const transactions = await fetchTransactions(prevLeague.league_id, week);
            const trades = transactions.filter(t => t.type === 'trade');

            for (const trade of trades) {
              if (trade.draft_picks && trade.draft_picks.length > 0) {
                allTradedPicks.push(...trade.draft_picks);
              }
            }
          } catch (error) {
            // Continue on error
          }
        }
      }
    } catch (error) {
      // Continue on error
    }
  }

  return allTradedPicks;
}

// Build a map of pick ownership after all trades for all future seasons
// Key: "season-originalRosterId-round", Value: currentOwnerId
function buildAllPicksOwnershipMap(tradedPicks, rosters, currentSeason, futureYears = 3) {
  const ownershipMap = {};
  const seasons = [];

  // Track picks for next N years
  for (let i = 1; i <= futureYears; i++) {
    seasons.push(currentSeason + i);
  }

  // Initialize with original owners for all seasons and rounds
  for (const season of seasons) {
    for (const roster of rosters) {
      // Assuming up to 5 rounds
      for (let round = 1; round <= 5; round++) {
        ownershipMap[`${season}-${roster.roster_id}-${round}`] = roster.roster_id;
      }
    }
  }

  // Apply trades in order (trades are already chronological from the API)
  for (const pick of tradedPicks) {
    const pickSeason = parseInt(pick.season);
    if (seasons.includes(pickSeason)) {
      const key = `${pickSeason}-${pick.roster_id}-${pick.round}`;
      ownershipMap[key] = pick.owner_id;
    }
  }

  return { ownershipMap, seasons };
}

// Determine playoff finish positions from bracket
function determinePlayoffFinishes(bracket, playoffTeams) {
  const finishes = {};

  if (!bracket || bracket.length === 0) {
    return finishes;
  }

  // Find the championship game (highest round)
  const maxRound = Math.max(...bracket.map(m => m.r));

  // Championship game determines 1st and 2nd
  const championship = bracket.find(m => m.r === maxRound && m.t1_from?.w !== undefined);
  if (championship) {
    if (championship.w) {
      finishes[championship.w] = 1; // Champion
      const loser = championship.t1 === championship.w ? championship.t2 : championship.t1;
      if (loser) finishes[loser] = 2; // Runner-up
    } else if (championship.t1 && championship.t2) {
      // Game not yet played - both teams are finalists
      finishes[championship.t1] = 1;
      finishes[championship.t2] = 2;
    }
  }

  // Find 3rd place game or semi-final losers
  const semiFinals = bracket.filter(m => m.r === maxRound - 1);
  let thirdPlaceGame = bracket.find(m => m.r === maxRound && m.t1_from?.l !== undefined);

  if (thirdPlaceGame) {
    // There's a 3rd place game
    if (thirdPlaceGame.w) {
      finishes[thirdPlaceGame.w] = 3;
      const loser = thirdPlaceGame.t1 === thirdPlaceGame.w ? thirdPlaceGame.t2 : thirdPlaceGame.t1;
      if (loser) finishes[loser] = 4;
    } else if (thirdPlaceGame.t1 && thirdPlaceGame.t2) {
      finishes[thirdPlaceGame.t1] = 3;
      finishes[thirdPlaceGame.t2] = 4;
    }
  } else {
    // No 3rd place game - semi-final losers tie for 3rd
    let position = 3;
    for (const semi of semiFinals) {
      if (semi.w) {
        const loser = semi.t1 === semi.w ? semi.t2 : semi.t1;
        if (loser && !finishes[loser]) {
          finishes[loser] = position++;
        }
      }
    }
  }

  // Handle quarter-final losers (5th-6th or 5th-8th depending on bracket size)
  const quarterFinals = bracket.filter(m => m.r === maxRound - 2);
  let position = Math.max(...Object.values(finishes), 0) + 1;

  for (const qf of quarterFinals) {
    if (qf.w) {
      const loser = qf.t1 === qf.w ? qf.t2 : qf.t1;
      if (loser && !finishes[loser]) {
        finishes[loser] = position++;
      }
    }
  }

  // Handle first round losers if 8-team playoff
  const firstRound = bracket.filter(m => m.r === 1);
  for (const match of firstRound) {
    if (match.w) {
      const loser = match.t1 === match.w ? match.t2 : match.t1;
      if (loser && !finishes[loser]) {
        finishes[loser] = position++;
      }
    }
  }

  return finishes;
}

// Calculate max weekly score for each team
function calculateMaxWeeklyScores(matchups, rosters) {
  const maxScores = {};

  for (const roster of rosters) {
    maxScores[roster.roster_id] = 0;
  }

  for (const weekData of matchups) {
    for (const matchup of weekData.matchups) {
      const points = matchup.points || 0;
      if (points > maxScores[matchup.roster_id]) {
        maxScores[matchup.roster_id] = points;
      }
    }
  }

  return maxScores;
}

// Get team name helper
function getTeamName(rosterId, rosters, users) {
  const roster = rosters.find(r => r.roster_id === rosterId);
  if (!roster) return `Team ${rosterId}`;
  const user = users.find(u => u.user_id === roster.owner_id);
  return user?.display_name || user?.username || `Team ${rosterId}`;
}

async function calculateDraftOrder() {
  const league = await fetchLeague();

  const [rosters, users, bracket, matchups, allTradedPicks] = await Promise.all([
    fetchRosters(),
    fetchUsers(),
    fetchWinnersBracket(),
    fetchMatchups(league),
    fetchAllTradedPicks(league)
  ]);

  const playoffTeamCount = league.settings.playoff_teams || 6;
  const totalTeams = rosters.length;
  const currentSeason = parseInt(league.season);
  const nextSeason = currentSeason + 1;

  // Build pick ownership map for all future seasons
  const { ownershipMap, seasons: futureSeasons } = buildAllPicksOwnershipMap(
    allTradedPicks,
    rosters,
    currentSeason,
    3 // Track 3 years into the future
  );

  // Build next season pick ownership map (for draft order)
  const nextSeasonPickMap = {};
  for (const roster of rosters) {
    for (let round = 1; round <= 5; round++) {
      const key = `${nextSeason}-${roster.roster_id}-${round}`;
      nextSeasonPickMap[`${roster.roster_id}-${round}`] = ownershipMap[key];
    }
  }

  // Determine playoff finishes
  const playoffFinishes = determinePlayoffFinishes(bracket, playoffTeamCount);

  // Get all playoff roster IDs
  const playoffRosterIds = new Set(Object.keys(playoffFinishes).map(Number));

  // Calculate max weekly scores
  const maxScores = calculateMaxWeeklyScores(matchups, rosters);

  // Build draft order
  const draftOrder = [];

  // Non-playoff teams first (picks 1 to totalTeams - playoffTeamCount)
  // Ordered by reverse max points (lowest max picks first)
  const nonPlayoffTeams = rosters
    .filter(r => !playoffRosterIds.has(r.roster_id))
    .map(r => ({
      roster_id: r.roster_id,
      team: getTeamName(r.roster_id, rosters, users),
      max_points: maxScores[r.roster_id] || 0,
      total_points: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
      wins: r.settings.wins,
      losses: r.settings.losses
    }))
    .sort((a, b) => a.max_points - b.max_points); // Ascending - lowest max picks first

  let draftPosition = 1;
  for (const team of nonPlayoffTeams) {
    // Check who owns this pick (round 1)
    const originalOwner = team.roster_id;
    const currentOwner = nextSeasonPickMap[`${originalOwner}-1`] || originalOwner;
    const isTraded = currentOwner !== originalOwner;

    draftOrder.push({
      draft_position: draftPosition++,
      original_roster_id: originalOwner,
      original_team: team.team,
      current_owner_id: currentOwner,
      current_owner: getTeamName(currentOwner, rosters, users),
      is_traded: isTraded,
      max_points: team.max_points,
      total_points: team.total_points,
      wins: team.wins,
      losses: team.losses,
      playoff_finish: null,
      category: 'non-playoff'
    });
  }

  // Playoff teams (picks from totalTeams - playoffTeamCount + 1 to totalTeams)
  // Ordered by playoff finish (worst finish picks first among playoff teams)
  const playoffTeamsData = rosters
    .filter(r => playoffRosterIds.has(r.roster_id))
    .map(r => ({
      roster_id: r.roster_id,
      team: getTeamName(r.roster_id, rosters, users),
      max_points: maxScores[r.roster_id] || 0,
      total_points: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
      wins: r.settings.wins,
      losses: r.settings.losses,
      playoff_finish: playoffFinishes[r.roster_id] || 999
    }))
    .sort((a, b) => b.playoff_finish - a.playoff_finish); // Descending - worst finish picks first

  for (const team of playoffTeamsData) {
    // Check who owns this pick (round 1)
    const originalOwner = team.roster_id;
    const currentOwner = nextSeasonPickMap[`${originalOwner}-1`] || originalOwner;
    const isTraded = currentOwner !== originalOwner;

    draftOrder.push({
      draft_position: draftPosition++,
      original_roster_id: originalOwner,
      original_team: team.team,
      current_owner_id: currentOwner,
      current_owner: getTeamName(currentOwner, rosters, users),
      is_traded: isTraded,
      max_points: team.max_points,
      total_points: team.total_points,
      wins: team.wins,
      losses: team.losses,
      playoff_finish: team.playoff_finish,
      category: 'playoff'
    });
  }

  // Build picks by owner for next season (for the summary view)
  const picksByOwner = {};
  for (const roster of rosters) {
    const ownerName = getTeamName(roster.roster_id, rosters, users);
    picksByOwner[roster.roster_id] = {
      team: ownerName,
      roster_id: roster.roster_id,
      own_picks: [],
      acquired_picks: []
    };
  }

  for (const pick of draftOrder) {
    if (pick.is_traded) {
      // This pick was traded away from original owner
      picksByOwner[pick.current_owner_id].acquired_picks.push({
        draft_position: pick.draft_position,
        from_team: pick.original_team
      });
    } else {
      picksByOwner[pick.original_roster_id].own_picks.push({
        draft_position: pick.draft_position
      });
    }
  }

  // Build future picks by owner (all seasons, all rounds)
  const futurePicksByOwner = rosters.map(roster => {
    const ownerName = getTeamName(roster.roster_id, rosters, users);
    const picksBySeason = {};

    for (const season of futureSeasons) {
      picksBySeason[season] = {
        own: [],
        acquired: [],
        traded_away: []
      };

      for (let round = 1; round <= 5; round++) {
        const key = `${season}-${roster.roster_id}-${round}`;
        const currentOwner = ownershipMap[key];

        if (currentOwner === roster.roster_id) {
          // Still owns their own pick
          picksBySeason[season].own.push({ round });
        } else {
          // Traded away
          picksBySeason[season].traded_away.push({
            round,
            to_team: getTeamName(currentOwner, rosters, users),
            to_roster_id: currentOwner
          });
        }
      }

      // Find acquired picks (picks from other teams that this owner now has)
      for (const otherRoster of rosters) {
        if (otherRoster.roster_id === roster.roster_id) continue;

        for (let round = 1; round <= 5; round++) {
          const key = `${season}-${otherRoster.roster_id}-${round}`;
          const currentOwner = ownershipMap[key];

          if (currentOwner === roster.roster_id) {
            picksBySeason[season].acquired.push({
              round,
              from_team: getTeamName(otherRoster.roster_id, rosters, users),
              from_roster_id: otherRoster.roster_id
            });
          }
        }
      }
    }

    // Calculate totals
    let totalPicks = 0;
    let totalTraded = 0;
    let totalAcquired = 0;

    for (const season of futureSeasons) {
      totalPicks += picksBySeason[season].own.length + picksBySeason[season].acquired.length;
      totalTraded += picksBySeason[season].traded_away.length;
      totalAcquired += picksBySeason[season].acquired.length;
    }

    return {
      team: ownerName,
      roster_id: roster.roster_id,
      picks_by_season: picksBySeason,
      total_picks: totalPicks,
      total_traded_away: totalTraded,
      total_acquired: totalAcquired,
      net_picks: totalAcquired - totalTraded
    };
  }).sort((a, b) => b.total_picks - a.total_picks);

  // Count traded picks for next season
  const tradedPickCount = draftOrder.filter(p => p.is_traded).length;

  return {
    season: league.season,
    next_season: nextSeason,
    future_seasons: futureSeasons,
    total_teams: totalTeams,
    playoff_teams: playoffTeamCount,
    traded_pick_count: tradedPickCount,
    draft_order: draftOrder,
    picks_by_owner: Object.values(picksByOwner),
    future_picks_by_owner: futurePicksByOwner,
    league_name: league.name
  };
}

const draftOrder = await calculateDraftOrder();
process.stdout.write(JSON.stringify(draftOrder, null, 2));
