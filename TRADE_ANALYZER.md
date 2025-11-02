# Trade Analyzer Feature

AI-powered trade analysis with commentary from legendary NFL draft and personnel analysts.

## Overview

The Trade Analyzer generates expert commentary on every trade in your league's history, featuring analysis in the distinctive styles of:

- **Mel Kiper Jr.** - Draft expert with passionate player evaluations and rankings
- **Adam Schefter** - NFL insider with breaking news style and context
- **Daniel Jeremiah** - Former scout with analytical, metrics-driven perspective
- **Todd McShay** - Draft analyst focused on value and team-building
- **Louis Riddick** - Former GM with executive and strategic viewpoint
- **Ian Rapoport** - NFL insider with quick, punchy analysis

## Features

Each trade analysis includes:

- **Detailed Player Metrics**
  - Age and career stage evaluation
  - Positional value/scarcity assessment
  - Pre-trade and post-trade performance data (when available)
  - Points per game averages

- **Team Context**
  - Team standings at time of trade (contender vs rebuilding)
  - Strategic fit evaluation
  - Championship window considerations

- **Draft Pick Valuation**
  - Future draft capital assessment
  - Pick value in team-building context

- **Expert Commentary**
  - Persona-specific analysis style
  - Winner/loser determination
  - Bold predictions
  - Creative manager nicknames

## Usage

### 1. Generate Trade Analyses

Run the generation script to create AI-powered analysis for all trades:

```bash
node src/data/generate-trade-analysis.js
```

**Requirements:**
- Set `ANTHROPIC_API_KEY` in your `.env` file
- Run `npm run build` first to generate cached data

The script will:
- Process all trades in your league history
- Skip trades that already have analyses
- Generate commentary using a random analyst persona for each trade
- Cache results in `src/data/trade-summaries/` as JSON files
- Rate limit requests (1 second between generations)

### 2. View Analyses

After generating analyses, view them in the dashboard:

1. Build the project: `npm run build`
2. Preview: `npm run dev`
3. Navigate to **Trade Analysis** in the menu

### 3. Regenerate Specific Analyses

To regenerate analysis for specific trades:

```bash
# Delete the cached file(s)
rm src/data/trade-summaries/trade-<trade-id>.json

# Re-run the generator
node src/data/generate-trade-analysis.js
```

## Metrics Explained

### Career Stage
Players are evaluated based on position-specific age curves:
- **Developing** - Pre-prime years, showing potential
- **Entering Prime** - Beginning peak performance window
- **Prime Years** - Peak production years for the position
- **Declining** - Past peak, veteran stage
- **End of Career** - Twilight years

Position-specific prime windows:
- QB: 25-35 years
- RB: 22-28 years
- WR: 23-30 years
- TE: 24-32 years

### Positional Value
Scarcity and replaceability by position:
- **RB** - High value, significant scarcity
- **TE** - Top tier very scarce, elite premium
- **WR** - Deep position, moderate value
- **QB** - High volume, moderate scarcity
- **K/DEF** - Low value, highly replaceable/streamable

### Team Context
Teams are classified at time of trade:
- **Strong contender** - Win-now mode (65%+ win rate)
- **Playoff contender** - Competitive (50-65% win rate)
- **Middle of pack** - Unclear direction (35-50% win rate)
- **Rebuilding** - Future-focused (<35% win rate)

### Performance Metrics
When historical data is available:
- **Pre-Trade PPG** - Average points per game before the trade
- **Post-Trade PPG** - Average points per game after the trade
- **Performance Change** - Difference showing improvement or decline

## File Structure

```
src/
├── data/
│   ├── generate-trade-analysis.js     # Generation script
│   ├── trade-analysis.json.js         # Data loader
│   └── trade-summaries/               # Cached analyses (JSON)
│       └── trade-<id>.json
└── trade-analysis.md                  # UI page
```

## Customization

### Add New Personas

Edit `src/data/generate-trade-analysis.js` and add to the `PERSONAS` array:

```javascript
{
  name: "Your Analyst Name",
  style: "Description of their style, signature phrases, and examples",
  emphasis: ["key focus areas", "analytical approach", "unique perspective"]
}
```

### Adjust Metrics

Modify helper functions in `generate-trade-analysis.js`:
- `evaluateCareerStage()` - Adjust age curves by position
- `getPositionalValue()` - Change scarcity ratings
- `evaluateTeamContext()` - Modify win percentage thresholds

### Customize Prompts

The `generateAnalysis()` function builds the LLM prompt. Adjust:
- Variety instructions (nicknames, predictions, comparisons)
- Analysis structure and length
- Temperature and max tokens for different creativity levels

## Tips

- **Commit cached files** - Include `src/data/trade-summaries/*.json` in your repo to avoid repeated API calls
- **Rate limiting** - The script includes 1-second delays between requests to respect API limits
- **Cost management** - Each analysis uses ~1500 tokens. Monitor your Anthropic API usage
- **Regeneration** - Delete specific JSON files to regenerate individual analyses with new personas

## Future Enhancements

Potential improvements:
- Historical outcome tracking (did the trade prediction come true?)
- Trade grading system based on actual results
- Comparative analysis (vs league average trades)
- Draft pick value charts
- Manager trade history patterns
- Visual trade trees showing draft pick chains

## Troubleshooting

**No analyses showing:**
- Ensure you've run the generation script
- Check that trade-summaries directory contains JSON files
- Verify trades exist in your league data

**API errors:**
- Verify ANTHROPIC_API_KEY is set correctly in .env
- Check API key permissions and rate limits
- Ensure network connectivity

**Data not loading:**
- Run `npm run build` to generate cache files
- Check console for data loading errors
- Verify all required data files exist in `.observablehq/cache/data/`

## Credits

Built with:
- [Anthropic Claude API](https://www.anthropic.com/) - AI-powered analysis
- [Observable Framework](https://observablehq.com/framework) - Data visualization
- [Sleeper API](https://docs.sleeper.com/) - Fantasy football data
