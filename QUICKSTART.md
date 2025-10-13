# Quick Start Guide

Get your Sleeper analytics dashboard up and running in minutes!

## Prerequisites

- Node.js 18 or later
- A Sleeper fantasy football league

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your league:**

   Find your Sleeper League ID from your league URL:
   ```
   https://sleeper.com/leagues/YOUR_LEAGUE_ID
   ```

   Then set it in your environment or edit the data loader files:

   **Option A: Environment Variable (Recommended)**
   ```bash
   export SLEEPER_LEAGUE_ID=your_league_id_here
   ```

   **Option B: Edit Data Loaders**
   Update the `LEAGUE_ID` constant in each file under `src/data/`:
   - `league.json.js`
   - `rosters.json.js`
   - `users.json.js`
   - `matchups.json.js`

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Dashboard Features

### 📊 Main Dashboard (`/`)
- League standings with win percentage
- Points distribution visualization
- Current week overview

### 🏈 League Overview (`/league`)
- Detailed standings table
- Power rankings
- Weekly scoring trends
- Competitive balance analysis
- League statistics

### 👥 Player Analytics (`/players`)
- Roster composition by position
- Age and experience distribution
- Injury report
- Team depth analysis
- Top players by position

### ⚔️ Matchups (`/matchups`)
- Week-by-week matchup results
- Win probability calculations
- Score distribution analysis
- Closest games tracker
- Highest scoring games
- Head-to-head records

### 💱 Trade Analyzer (`/trades`)
- Interactive trade evaluator
- Player value calculations
- Position impact analysis
- Roster value comparison
- Fair trade assessment

## Data Refresh

The dashboard automatically fetches fresh data from Sleeper when you run `npm run dev`. Data is cached during development for faster page loads.

To force a refresh:
```bash
npm run clean
npm run dev
```

## Building for Production

```bash
npm run build
```

The built site will be in the `dist/` directory.

## Deployment

You can deploy to any static hosting service:

- **Netlify**: Drag and drop the `dist/` folder
- **Vercel**: Import the GitHub repository
- **GitHub Pages**: Push the `dist/` folder to a `gh-pages` branch
- **AWS S3**: Upload the `dist/` folder to an S3 bucket

## Customization

### Change Theme Colors

Edit `observablehq.config.js` to customize colors:

```js
head: `
  <style>
    :root {
      --theme-accent: #your-color-here;
    }
  </style>
`
```

### Add New Pages

1. Create a new `.md` file in `src/`
2. Add it to the `pages` array in `observablehq.config.js`
3. Import data loaders using `FileAttachment()`

### Modify Analytics

Edit any page in `src/` to customize visualizations. Observable Framework uses:
- **Observable Plot** for charts
- **Observable Inputs** for controls
- **D3** for data manipulation

## Troubleshooting

### Data not loading?
- Verify your league ID is correct
- Check that the league is active
- Ensure you have internet connectivity

### Build errors?
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (must be 18+)

### Styling issues?
- Clear browser cache
- Run `npm run clean` and rebuild

## Support

For issues with:
- **Observable Framework**: https://observablehq.com/framework/
- **Sleeper API**: https://docs.sleeper.com/
- **This Dashboard**: Check the README.md

## Next Steps

- Customize the analytics to your league's scoring settings
- Add custom metrics relevant to your league
- Share the dashboard URL with your league members
- Set up automated deployments for live updates

Happy analyzing! 📈
