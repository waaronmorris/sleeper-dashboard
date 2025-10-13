# Sleeper Fantasy Analytics Dashboard

An advanced analytics dashboard for Sleeper fantasy football leagues built with Observable Framework.

## Features

- **League Overview**: Current standings, points distribution, and team performance metrics
- **Player Analytics**: Deep dive into player performance, trends, and projections
- **Matchup Analysis**: Week-by-week matchup breakdowns with win probability predictions
- **Trade Analyzer**: Evaluate trade proposals with advanced metrics
- **Historical Trends**: Season-long analytics and performance tracking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Sleeper League ID:
```bash
cp .env.example .env
# Edit .env and add your league ID
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

## Technology

Built with:
- [Observable Framework](https://observablehq.com/framework/) - Static site generator for data apps
- [Observable Plot](https://observablehq.com/plot/) - Visualization library
- [Sleeper API](https://docs.sleeper.com/) - Fantasy football data
