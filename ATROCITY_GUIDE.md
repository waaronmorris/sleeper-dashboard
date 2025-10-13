# Atrocity Score System Guide

## Overview

The Atrocity Score system measures how terrible your fantasy football lineup decisions are. It uses a sophisticated algorithm that combines rankings, consensus, projections, and actual outcomes to quantify bad decisions.

## Formula

```
Atrocity Score = Base Score × Position Factor × Context Multiplier

Base Score =
  (Ranking Gap × 0.15) +
  (Start % Gap × 0.20) +
  (Projection Gap × 0.25) +
  (Actual Points Gap × 0.40)
  + Status Bonus

Scale: 0-100 points
```

## Components Breakdown

### 1. Actual Points Gap (40% weight)
**What it measures:** How many more points the benched player scored vs. the started player.

**Why it matters:** This is what you actually experience - the pain of leaving points on the bench.

**Calculation:** Normalized using z-score based on position standard deviation.

**Example:**
- Started TE: 3.4 points
- Benched TE: 18.7 points
- Position StdDev: 6.2 points
- Gap: (18.7 - 3.4) / 6.2 = 2.47 standard deviations
- Normalized: 2.47 / 3.0 = 0.82

### 2. Projection Gap (25% weight)
**What it measures:** How much better the benched player was projected to score pre-game.

**Why it matters:** Shows if you ignored obvious pre-game information.

**Calculation:** Difference divided by position average projection.

**Example:**
- Started RB projected: 8.5 pts
- Benched RB projected: 14.2 pts
- Position average: 10.5 pts
- Gap: (14.2 - 8.5) / 10.5 = 0.54

### 3. Start Percentage Gap (20% weight)
**What it measures:** How many more managers started the benched player vs. your choice.

**Why it matters:** Consensus wisdom from thousands of fantasy managers.

**Calculation:** Raw percentage point difference.

**Example:**
- Started player: 45% start rate
- Benched player: 87% start rate
- Gap: (87 - 45) / 100 = 0.42

### 4. Ranking Gap (15% weight)
**What it measures:** Position rank difference between players.

**Why it matters:** Expert rankings aggregate analyst opinions.

**Calculation:** Rank difference normalized by position pool size.

**Example:**
- Started WR ranked #24
- Benched WR ranked #8
- Position pool: 96 WRs
- Gap: (24 - 8) / 96 = 0.167

### 5. Status Bonus (Flat Addition)
**What it measures:** Player availability status.

**Why it matters:** Starting inactive players is inexcusable.

**Values:**
- OUT/IR/Suspended: +40 points (automatic Level 3+)
- Doubtful: +20 points
- Questionable: +5 points
- Active: No bonus

## Position Factors

Different positions have different volatility, which affects scoring:

```javascript
QB:   0.85  (Most consistent - mistakes less forgivable)
RB:   1.15  (High variance)
WR:   1.20  (Highest variance - scores slightly reduced)
TE:   1.10  (Medium variance)
K:    0.90  (Consistent)
FLEX: 1.15  (Same as RB/WR average)
```

## Context Multipliers

### Week-Based Adjustments

**Early Season (Weeks 1-6): 0.5x**
- Still learning rosters and matchups
- Projections less reliable
- Educational period

**Mid-Season (Weeks 7-13): 1.0x**
- Standard scoring
- Full expectations

**Playoffs (Weeks 14+): 2.0x**
- Stakes are highest
- Engagement should peak
- Championship implications

**Championship Week: Additional 1.5x**
- Legacy-defining moments
- Ultimate pressure

### Time-Based Adjustments

**Late-Breaking News:**
- <1 hour before kickoff: 0.5x (reduced penalty)
- 1-4 hours before kickoff: 0.7x
- >4 hours: 1.0x (full penalty)

**Rationale:** You can't be blamed for news that broke after you could reasonably update your lineup.

## Severity Levels

### Level 1: Questionable (0-20 points)
**Definition:** Suboptimal but defensible decision.

**Characteristics:**
- Small ranking deviations (<15 spots)
- Minor point differentials (0-5 points)
- Close projections

**Visual:** 🟡 Yellow
**Color:** #f59e0b

**Example:** Started WR15 over WR12 in similar matchups.

### Level 2: Bad Decision (20-40 points)
**Definition:** Clear mistake showing poor judgment.

**Characteristics:**
- Moderate ranking deviations (15-30 spots)
- Significant point differentials (5-15 points)
- Ignored projections

**Visual:** 🟠 Orange
**Color:** #fb923c

**Example:** Chasing last week's points - started last week's 20-point scorer who averaged 8 PPG.

### Level 3: Egregious (40-70 points)
**Definition:** Major blunder with significant impact.

**Characteristics:**
- Large ranking deviations (30+ spots)
- Major point differentials (15-25 points)
- Ignored consensus and data

**Visual:** 🔴 Red
**Color:** #ef4444

**Example:** Started player ruled OUT 48 hours before kickoff.

### Level 4: Catastrophic (70-90 points)
**Definition:** League-altering negligence.

**Characteristics:**
- Multiple bad decisions in one week
- Point differential 25-40+ points
- Playoff implications
- Affected other teams

**Visual:** ⚠️ Red Alert
**Color:** #dc2626

**Example:** Multiple inactive starters in must-win playoff game.

### Level 5: LEGENDARY (90-100 points)
**Definition:** Historic, unforgettable atrocity.

**Characteristics:**
- Point differential 40+ points
- Championship-altering impact
- Combination of multiple failures
- Will be discussed for years

**Visual:** 💀 Skull
**Color:** #7c2d12

**Example:** Forgot to set lineup in championship game, left multiple slots empty, lost by <10 points.

## Achievement Badges

### Level 1-2 (Minor/Moderate)
- 🔧 **The Tinkerer** - Changed lineup 10+ times in one week
- 🏃 **Point Chaser** - Started last week's hero who busted

### Level 3 (Egregious)
- ⚠️ **The Inactive** - Started OUT player
- 😴 **Bye Week Blues** - Started player on bye week
- 🙈 **Consensus Denier** - Benched 90%+ start player
- 🎲 **Rankings Rebel** - Started player 40+ ranks below bench option

### Level 4-5 (Catastrophic/Legendary)
- 💥 **The Big Whiff** - Left 30+ points on bench
- 📉 **Playoff Disaster** - Major atrocity in playoffs
- 🏆💀 **Championship Choke** - Atrocity in championship game
- 💀🏆 **HALL OF SHAME** - Legendary atrocity (90+ score)

## Example Calculations

### Example 1: Minor Mistake

**Scenario:**
- Week 8, TE position
- Started: Dallas Goedert (TE9, 68% start, 9.5 proj, 8.7 actual)
- Benched: Cole Kmet (TE12, 52% start, 8.2 proj, 11.4 actual)

**Calculation:**
```
RankingGap = (9-12)/32 = 0.0 (negative, so 0)
StartPctGap = (68-52)/100 = 0.16
ProjectionGap = (9.5-8.2)/8.8 = 0.15
ActualGap = (11.4-8.7)/4.2 = 0.64 → normalized = 0.21

BaseScore = (0.0×0.15) + (0.16×0.20) + (0.15×0.25) + (0.21×0.40) = 0.154
Scaled = 0.154 × 100 = 15.4

PositionFactor = 1.10 (TE)
FinalScore = 15.4 × 1.10 = 16.9

Category: Bad Decision (Level 2)
Points Left: 2.7
```

### Example 2: Major Mistake

**Scenario:**
- Week 5, WR position
- Started: DeVonta Smith (WR24, 45% start, 8.5 proj, 6.2 actual)
- Benched: Amon-Ra St. Brown (WR3, 92% start, 16.8 proj, 24.3 actual)

**Calculation:**
```
RankingGap = (24-3)/96 = 0.219
StartPctGap = (92-45)/100 = 0.470
ProjectionGap = (16.8-8.5)/14.2 = 0.585
ActualGap = (24.3-6.2)/8.5 = 2.13 → normalized = 0.71

BaseScore = (0.219×0.15) + (0.470×0.20) + (0.585×0.25) + (0.71×0.40) = 0.512
Scaled = 0.512 × 100 = 51.2

PositionFactor = 1.20 (WR)
FinalScore = 51.2 × 1.20 = 61.4

Category: Egregious (Level 3)
Points Left: 18.1
Explanation: "Left 18.1 points on the bench. Primary factor: Outcome.
             Benched a consensus start (92% started). Significant ranking difference."
```

### Example 3: Legendary Atrocity

**Scenario:**
- Week 17 (Championship), FLEX position (RB)
- Started: Jamaal Williams (RB38, 28% start, 5.2 proj, 2.1 actual, Questionable)
- Benched: James Conner (RB5, 89% start, 18.5 proj, 28.9 actual)

**Calculation:**
```
RankingGap = (38-5)/64 = 0.516
StartPctGap = (89-28)/100 = 0.610
ProjectionGap = (18.5-5.2)/12.5 = 1.064 → capped at 1.0
ActualGap = (28.9-2.1)/9.2 = 2.91 → normalized = 0.97

BaseScore = (0.516×0.15) + (0.610×0.20) + (1.0×0.25) + (0.97×0.40) = 0.853
Scaled = 0.853 × 100 = 85.3
StatusBonus = +5 (Questionable)

PositionFactor = 1.15 (FLEX/RB)
ContextMultiplier = 2.0 (Week 17) × 1.5 (Championship) = 3.0

FinalScore = (85.3 + 5) × 1.15 × 3.0 = 311.5 → capped at 100

Category: LEGENDARY (Level 5)
Points Left: 26.8
Badges: Hall of Shame, Championship Choke
```

## Data Requirements

### Pre-Game Data Needed:
- Expert consensus rankings (weekly)
- Start percentages (from league platforms)
- Projections (league-specific or aggregate)
- Player injury status
- Vegas implied totals (optional enhancement)

### Post-Game Data Needed:
- Actual points scored
- Final player status
- Playing time / snap counts (optional)
- Weather conditions (optional)

### Sleeper API Endpoints:
- `/v1/league/{league_id}` - League settings
- `/v1/league/{league_id}/rosters` - Team rosters
- `/v1/league/{league_id}/matchups/{week}` - Weekly lineups
- `/v1/players/nfl` - Player metadata

## Tips to Avoid Atrocities

### Pre-Game Checklist
1. **Thursday Night:** Review your full lineup after Thursday game
2. **Saturday Evening:** Check injury reports and updated news
3. **Sunday Morning:** Final lineup check 60-90 minutes before early games
4. **Monday:** Verify Monday night lineup if applicable

### Decision Framework
1. **Start Your Studs:** Top-12 players at position almost always start
2. **Trust Consensus:** If 80%+ start someone, think twice before benching
3. **Check Multiple Sources:** Don't rely on single projection source
4. **Avoid Recency Bias:** 1 week ≠ trend
5. **Weather Matters:** Wind >20mph significantly impacts passing
6. **Game Script:** Trailing teams pass more, leading teams run more

### Red Flags
- ⚠️ Player listed as Questionable on Saturday
- ⚠️ "Game-time decision" designation
- ⚠️ Player practiced limited all week
- ⚠️ Unclear backfield/WR rotation
- ⚠️ Weather conditions deteriorating
- ⚠️ Key offensive linemen out

## Implementation Notes

### For Developers

**Key Files:**
- `src/components/helpers.js` - Atrocity calculation functions
- `src/data/atrocities.json.js` - Data loader
- `src/atrocity.md` - Dashboard page

**Helper Functions:**
```javascript
// Main calculation
calculateAtrocityScore(decision)

// Component calculations
calculateRankingGap(startedRank, benchedRank, position)
calculateStartPctGap(startedPct, benchedPct)
calculateProjectionGap(startedProj, benchedProj, positionAvg)
calculateActualGap(startedActual, benchedActual, positionStdDev)

// Utilities
categorizeSeverity(score)
assignAtrocityBadges(decision, score)
getAllBadges()
```

**Decision Object Structure:**
```javascript
{
  week: number,
  position: string,
  startedPlayer: {
    name: string,
    actual: number,
    rank: number,
    startPct: number,
    projection: number,
    status: string
  },
  benchedPlayer: {
    name: string,
    actual: number,
    rank: number,
    startPct: number,
    projection: number,
    status: string
  },
  positionAvgProj: number,
  positionStdDev: number,
  isChampionship: boolean,
  hoursBeforeKickoff: number
}
```

## Philosophy

The Atrocity Score system is designed to be:

1. **Fair** - Judges decisions based on information available at lineup lock
2. **Educational** - Helps managers understand what went wrong
3. **Engaging** - Creates fun storylines and league culture
4. **Balanced** - Weighs both process and results appropriately
5. **Context-Aware** - Accounts for week importance and position variance

## Credits

Formula development based on:
- Fantasy football analytics research
- Statistical modeling best practices
- Behavioral psychology principles
- Community feedback and testing

Inspired by the universal fantasy football experience of leaving points on the bench and needing to quantify that pain.

---

*"Sometimes the best strategy is having no strategy at all." - Someone with a 90+ atrocity score*
