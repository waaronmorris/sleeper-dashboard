# AI-Powered Weekly Matchup Summaries

This feature generates AI-powered weekly matchup summaries in the voice of famous sports commentators like Pat McAfee, Lee Corso, Stuart Scott, Scott Van Pelt, Rich Eisen, and Dan Patrick.

## Setup

### 1. Get Your Anthropic API Key

1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key

### 2. Configure Your Environment

Edit your `.env` file and add your API key:

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

## Generating Summaries

### Generate All Missing Week Summaries

After building your project, run:

```bash
npm run build
npm run generate-summaries
```

This will:
- Check all weeks in your matchup data
- Generate summaries for any weeks that don't have them yet
- Skip weeks that already have summaries
- Randomly assign a commentator persona to each week

### Generate a Specific Week

To generate (or regenerate) a specific week's summary:

```bash
npm run generate-summary 5  # Generates summary for week 5
```

This will overwrite any existing summary for that week.

## How It Works

### File Structure

Generated summaries are stored in:
```
src/data/week-summaries/week-{N}-{LEAGUE_ID}.json
```

Each file contains:
```json
{
  "week": 1,
  "season": "2024",
  "leagueId": "1182940167115010048",
  "persona": "Pat McAfee",
  "summary": "HOLY MOLY folks, what a week we had!...",
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

### Personas

Each week is randomly assigned one of these commentator personas:

- **Pat McAfee** - Energetic, enthusiastic, uses "BOOMS", "BANGERS", and modern slang
- **Lee Corso** - Excited, uses "Not so fast my friend!", builds suspense
- **Stuart Scott** - Cool, hip-hop references, "Boo-yah!", smooth delivery
- **Scott Van Pelt** - Laid-back, witty, self-deprecating humor
- **Rich Eisen** - Polished, pop culture savvy, clever analogies
- **Dan Patrick** - Dry wit, "En Fuego", deadpan humor

### Build-Time Generation

Summaries are generated at build time and committed to your repository. This means:

1. **No Runtime API Calls** - Summaries are pre-generated, so pages load instantly
2. **Version Controlled** - Summaries are tracked in git alongside your data
3. **Weekly Updates** - Generate new summaries when new weeks complete
4. **Cost Efficient** - Only pay for API calls when generating, not on every page view

### Display on Matchups Page

The matchup page automatically:
- Loads the summary for the selected week
- Displays it in a styled card with persona-specific colors
- Shows the commentator's name and their signature catchphrase
- Falls back to just showing the week selector if no summary exists

## Workflow

### Weekly Routine

When a new week completes:

```bash
# 1. Build to fetch latest data
npm run build

# 2. Generate summary for the new week
npm run generate-summaries

# 3. Preview locally
npm run dev

# 4. Commit the new summary file
git add src/data/week-summaries/
git commit -m "Add AI summary for week X"
git push

# 5. Deploy
# GitHub Actions will automatically deploy to GitHub Pages
```

### GitHub Actions Integration

You can automate this by adding a step to your `.github/workflows/deploy.yml`:

```yaml
- name: Generate weekly summaries
  run: npm run generate-summaries
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

- name: Commit new summaries
  run: |
    git config user.name "GitHub Actions"
    git config user.email "actions@github.com"
    git add src/data/week-summaries/
    git diff --staged --quiet || git commit -m "Auto-generate weekly summaries"
    git push
```

Don't forget to add `ANTHROPIC_API_KEY` to your repository secrets!

## Cost Considerations

- Each summary uses Claude 3.5 Sonnet
- Typical cost: ~$0.01-0.03 per summary
- ~18 weeks per season = ~$0.18-0.54 per season
- Summaries are cached and committed, so you only pay once per week

## Customization

### Adding New Personas

Edit `src/data/generate-week-summaries.js` and add to the `PERSONAS` array:

```javascript
{
  name: "Your Persona",
  style: "Description of their style and catchphrases"
}
```

Then add styling in `src/matchups.md`:

```javascript
const personaStyles = {
  "Your Persona": {
    color: "#hex-color",
    gradient: "linear-gradient(...)",
    emoji: "🎯",
    badge: "CATCHPHRASE"
  }
};
```

### Adjusting Summary Length

Edit the `max_tokens` parameter in `generate-week-summaries.js`:

```javascript
const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024, // Increase for longer summaries
  // ...
});
```

### Changing the Model

To use a different Claude model:

```javascript
const message = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307', // Cheaper, faster
  // or
  model: 'claude-3-opus-20240229', // Most capable, higher cost
  // ...
});
```

## Troubleshooting

### "Matchups data not found"

Run `npm run build` first to generate the cached data files.

### "ANTHROPIC_API_KEY environment variable not set"

Make sure you've created a `.env` file with your API key.

### Summaries not appearing on the page

1. Check that the summary file exists: `ls src/data/week-summaries/`
2. Verify the filename matches the pattern: `week-{N}-{LEAGUE_ID}.json`
3. Rebuild the site: `npm run build`
4. Check browser console for errors

### Want to regenerate a summary

Run the script with a specific week number:
```bash
npm run generate-summary 5
```

This will overwrite the existing summary (possibly with a different persona).

## Tips

- **Preview First**: Use `npm run dev` to preview summaries before deploying
- **Batch Generation**: The script handles rate limiting automatically (1 second between requests)
- **Commit Early**: Commit summaries as soon as they're generated to avoid losing them
- **Season Transitions**: The script includes the league ID in filenames, so different seasons won't conflict
- **Quality Check**: Read generated summaries before committing - regenerate if the tone isn't quite right

## Example Output

Here's what a Pat McAfee summary might look like:

> HOLY MOLY folks, what a WEEK of fantasy football we just witnessed! Let me tell you, Week 5 was absolutely ELECTRIC! We had some BOOMS, we had some duds, and we had one game that was so close you needed a microscope to see the difference!
>
> First up, let's talk about the BANGER of the week - Team A absolutely DEMOLISHED Team B with a 45-point margin. That's not a win, that's a STATEMENT! Meanwhile, on the other end of the spectrum, we had Team C squeaking by Team D with less than 2 points separating them. That's the kind of nail-biter that makes you wanna pull your hair out!
>
> The scoring was WILD this week with an average of 115 points per team. That's some high-octane fantasy football right there! If you scored under 100, you were probably watching from the sidelines wondering what happened. But hey, that's the beautiful chaos of fantasy football, baby!

## Support

For issues or questions:
- Check the Observable Framework docs: [observablehq.com/framework](https://observablehq.com/framework)
- Anthropic API docs: [docs.anthropic.com](https://docs.anthropic.com/)
- Create an issue in your repository
