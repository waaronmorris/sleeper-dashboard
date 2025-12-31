// Data loader for Player News Snapshots
// Captures weekly player news, injuries, and trending data for historical trade analysis
// Each week's player context is preserved so historical trades can be analyzed accurately

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HISTORY_FILE = join(__dirname, 'player-news-snapshots-history.json');

/**
 * Fetch trending players (adds/drops) from Sleeper API
 */
async function fetchTrendingPlayers(type = 'add', lookbackHours = 24, limit = 25) {
  try {
    const url = `https://api.sleeper.app/v1/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch trending ${type}: ${response.statusText}`);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error.message);
    return [];
  }
}

/**
 * Fetch all NFL players (includes injury data)
 */
async function fetchPlayers() {
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!response.ok) throw new Error(`Failed to fetch players: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching players:`, error.message);
    return {};
  }
}

/**
 * Fetch current NFL state (week, season)
 */
async function fetchNFLState() {
  try {
    const response = await fetch('https://api.sleeper.app/v1/state/nfl');
    if (!response.ok) throw new Error(`Failed to fetch NFL state: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching NFL state:`, error.message);
    return { season: new Date().getFullYear().toString(), week: 1 };
  }
}

/**
 * Extract relevant news/injury context for a player
 */
function extractPlayerContext(player, trendingAdds, trendingDrops) {
  if (!player) return null;

  const playerId = player.player_id;
  const addTrend = trendingAdds.find(t => t.player_id === playerId);
  const dropTrend = trendingDrops.find(t => t.player_id === playerId);

  // Determine trending direction
  let trending = 'neutral';
  let trendCount = 0;
  if (addTrend && dropTrend) {
    trending = addTrend.count > dropTrend.count ? 'up' : 'down';
    trendCount = Math.abs(addTrend.count - dropTrend.count);
  } else if (addTrend) {
    trending = 'up';
    trendCount = addTrend.count;
  } else if (dropTrend) {
    trending = 'down';
    trendCount = dropTrend.count;
  }

  return {
    playerId,
    name: `${player.first_name} ${player.last_name}`,
    position: player.position,
    team: player.team || 'FA',
    // Injury info
    injuryStatus: player.injury_status || null,
    injuryBodyPart: player.injury_body_part || null,
    injuryNotes: player.injury_notes || null,
    injuryStartDate: player.injury_start_date || null,
    // Status
    status: player.status, // Active, Inactive, IR, etc.
    practiceParticipation: player.practice_participation || null,
    // Trending
    trending,
    trendCount,
    // Depth chart
    depthChartOrder: player.depth_chart_order || null,
    depthChartPosition: player.depth_chart_position || null
  };
}

/**
 * Load existing snapshots from history file
 */
function loadExistingSnapshots() {
  if (existsSync(HISTORY_FILE)) {
    try {
      const data = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
      console.error(`✅ Loaded ${data.snapshots?.length || 0} player news snapshots from history`);
      return data;
    } catch (error) {
      console.error(`⚠️ Error reading player news snapshots: ${error.message}`);
      return { snapshots: [] };
    }
  }
  console.error(`📭 No player news snapshot history found - will create new file`);
  return { snapshots: [] };
}

/**
 * Save snapshots to history file
 */
function saveSnapshots(data) {
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
    console.error(`💾 Saved ${data.snapshots.length} snapshots to history file`);
  } catch (error) {
    console.error(`⚠️ Error saving snapshots: ${error.message}`);
  }
}

/**
 * Find the best matching snapshot for a given week/season
 */
function findSnapshotForTrade(snapshots, tradeSeason, tradeWeek) {
  // Look for exact match first
  const exactMatch = snapshots.find(s =>
    s.season === tradeSeason && s.week === tradeWeek
  );

  if (exactMatch) {
    return {
      source: 'exact',
      snapshot: exactMatch,
      accuracy: 'high'
    };
  }

  // Look for closest week in same season
  const sameSeasonSnapshots = snapshots
    .filter(s => s.season === tradeSeason)
    .sort((a, b) => Math.abs(a.week - tradeWeek) - Math.abs(b.week - tradeWeek));

  if (sameSeasonSnapshots.length > 0) {
    const closest = sameSeasonSnapshots[0];
    const weekDiff = Math.abs(closest.week - tradeWeek);
    return {
      source: 'closest',
      snapshot: closest,
      weekDifference: weekDiff,
      accuracy: weekDiff <= 1 ? 'high' : weekDiff <= 3 ? 'moderate' : 'low'
    };
  }

  // No snapshot available
  return {
    source: 'none',
    snapshot: null,
    accuracy: 'unavailable'
  };
}

/**
 * Main function to generate player news snapshots
 */
async function generatePlayerNewsSnapshots() {
  console.error('📰 Generating player news snapshots...');

  // Fetch current NFL state
  const nflState = await fetchNFLState();
  const currentSeason = nflState.season;
  const currentWeek = nflState.week || nflState.leg || 1;

  console.error(`📅 Current: ${currentSeason} Week ${currentWeek}`);

  // Load existing snapshots
  const existingData = loadExistingSnapshots();

  // Check if we already have this week's snapshot
  const existingWeekSnapshot = existingData.snapshots.find(s =>
    s.season === currentSeason && s.week === currentWeek
  );

  let currentSnapshot = null;

  if (!existingWeekSnapshot) {
    console.error(`📸 Capturing new snapshot for ${currentSeason} Week ${currentWeek}...`);

    // Fetch all data
    const [players, trendingAdds, trendingDrops] = await Promise.all([
      fetchPlayers(),
      fetchTrendingPlayers('add', 48, 50),
      fetchTrendingPlayers('drop', 48, 50)
    ]);

    // Get all player IDs that are trending or have injury status
    const relevantPlayerIds = new Set([
      ...trendingAdds.map(t => t.player_id),
      ...trendingDrops.map(t => t.player_id),
      ...Object.keys(players).filter(id => {
        const p = players[id];
        return p.injury_status || p.status === 'Injured Reserve';
      })
    ]);

    // Extract context for relevant players
    const playerContexts = {};
    for (const playerId of relevantPlayerIds) {
      const player = players[playerId];
      if (player && player.position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position)) {
        const context = extractPlayerContext(player, trendingAdds, trendingDrops);
        if (context) {
          playerContexts[playerId] = context;
        }
      }
    }

    currentSnapshot = {
      season: currentSeason,
      week: currentWeek,
      capturedAt: new Date().toISOString(),
      playerCount: Object.keys(playerContexts).length,
      trendingAddCount: trendingAdds.length,
      trendingDropCount: trendingDrops.length,
      players: playerContexts
    };

    // Add to snapshots and save
    existingData.snapshots.push(currentSnapshot);

    // Keep only last 2 seasons of snapshots to manage file size
    const twoYearsAgo = (parseInt(currentSeason) - 2).toString();
    existingData.snapshots = existingData.snapshots.filter(s =>
      parseInt(s.season) >= parseInt(twoYearsAgo)
    );

    // Sort by season and week
    existingData.snapshots.sort((a, b) => {
      if (a.season !== b.season) return a.season.localeCompare(b.season);
      return a.week - b.week;
    });

    saveSnapshots(existingData);
    console.error(`✅ Captured ${Object.keys(playerContexts).length} players in snapshot`);
  } else {
    console.error(`✓ Snapshot already exists for ${currentSeason} Week ${currentWeek}`);
    currentSnapshot = existingWeekSnapshot;
  }

  // Output format
  const output = {
    currentSeason,
    currentWeek,
    snapshots: existingData.snapshots,
    currentSnapshot,
    lastUpdated: new Date().toISOString(),
    usage: {
      description: 'Use findSnapshotForTrade() to get player context for historical trades',
      example: 'For a Week 4 2024 trade, returns player injuries/trending from that week'
    }
  };

  return output;
}

const playerNewsSnapshots = await generatePlayerNewsSnapshots();
process.stdout.write(JSON.stringify(playerNewsSnapshots, null, 2));
