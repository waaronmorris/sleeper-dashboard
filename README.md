# Sleeper Fantasy Analytics Dashboard

An advanced analytics dashboard for Sleeper fantasy football leagues built with Observable Framework.

## Features

- **League Overview**: Current standings, points distribution, and team performance metrics
- **Player Analytics**: Deep dive into player performance, trends, and projections
- **Matchup Analysis**: Week-by-week matchup breakdowns with win probability predictions
- **All-Play Records**: Schedule-independent performance tracking
- **Draft Overview & Retrospective**: Draft analysis and pick value evaluation
- **Trade Retrospective**: Historical trade tracking with long-term outcome analysis
- **AI-Powered Trade Analysis**: Expert commentary on every trade from legendary NFL analysts (Mel Kiper Jr., Adam Schefter, Daniel Jeremiah, Todd McShay, Louis Riddick, Ian Rapoport)
- **AI-Powered Weekly Summaries**: Automated weekly recaps in the voice of famous sports commentators (Pat McAfee, Lee Corso, Stuart Scott, Scott Van Pelt, Rich Eisen, Dan Patrick)
- **Atrocity Tracker**: Quantify and rank the worst lineup decisions with detailed scoring algorithm
- **Ring of Honor**: Celebrate league champions and top performers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your environment variables:
```bash
cp .env.example .env
# Edit .env and add:
# - Your Sleeper League ID
# - Your Anthropic API key (for AI summaries)
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

## Finding Your League ID

Your Sleeper League ID can be found in your league URL:
```
https://sleeper.com/leagues/YOUR_LEAGUE_ID
```

## Building for Production

```bash
npm run build
```

The built site will be in the `dist/` directory, ready to deploy to any static hosting service.

## Data Sources

This dashboard uses the Sleeper API to fetch:
- League settings and metadata
- Team rosters and standings
- Player information and statistics
- Matchup history and results

Data is automatically cached and refreshed during development.

## AI-Powered Features

This dashboard includes two AI-powered features using Claude:

### 1. Trade Analysis with NFL Analyst Personas

Get expert commentary on every trade in your league's history from legendary NFL analysts:

**Generate analyses:**
```bash
npm run build
npm run generate-trade-analysis
```

Features:
- 6 distinct analyst personas (Mel Kiper Jr., Adam Schefter, and more)
- Detailed player metrics (age curves, positional value, performance tracking)
- Team context evaluation (contender vs rebuilding)
- Draft pick valuation

See [TRADE_ANALYZER.md](TRADE_ANALYZER.md) for detailed documentation.

### 2. Weekly Matchup Summaries

Automated weekly recaps in the voice of famous sports commentators.

**Generate summaries:**
```bash
npm run build
npm run generate-summaries        # Generate all missing weeks
npm run generate-summary 7        # Generate specific week
```

Features:
- 6 commentator personas (Pat McAfee, Lee Corso, Stuart Scott, and more)
- Atrocity commentary and lineup decision roasts
- Dramatic storylines and rivalry angles

See [WEEKLY_SUMMARIES.md](WEEKLY_SUMMARIES.md) for detailed documentation.

### GitHub Automation

Both features can be automated via GitHub Actions. Add these secrets to your repository:
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `SLEEPER_LEAGUE_ID`: Your Sleeper league ID (optional, defaults to value in code)

See individual documentation files for workflow setup instructions.

## Technology

Built with:
- [Observable Framework](https://observablehq.com/framework/) - Static site generator for data apps
- [Observable Plot](https://observablehq.com/plot/) - Visualization library
- [Sleeper API](https://docs.sleeper.com/) - Fantasy football data
- [Claude AI](https://www.anthropic.com/claude) - AI-powered weekly summaries

## Support This Project

If you find this dashboard useful for your league, consider supporting its development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/waaronmorris)

Your support helps cover:
- AI API costs for weekly summaries
- Ongoing development and new features
- Server and infrastructure costs

## Contributing

Contributions are welcome! Feel free to:
- Report bugs or issues
- Suggest new features or analytics
- Submit pull requests
- Share with your fantasy football leagues

## License

MIT License - feel free to use and modify for your own leagues!
