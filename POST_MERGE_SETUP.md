# Post-Merge Setup for Trade Analyzer

## Required: Add GitHub Actions Workflow

The Trade Analyzer GitHub Actions workflow couldn't be pushed due to permissions restrictions. After merging this PR, you'll need to manually add the workflow file.

### Steps:

1. **After merging the PR**, create the file `.github/workflows/trade-analysis.yml` with the following content:

```yaml
name: Generate Trade Analyses

on:
  # Run twice per week during NFL season to catch new trades
  # Tuesday at 11 AM UTC (after MNF) and Friday at 2 PM UTC (after waiver clears)
  schedule:
    - cron: '0 11 * * 2'  # Tuesday 11 AM UTC
    - cron: '0 14 * * 5'  # Friday 2 PM UTC

  # Allow manual trigger
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate-trade-analyses:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build data
        run: npm run build
        env:
          SLEEPER_LEAGUE_ID: ${{ secrets.SLEEPER_LEAGUE_ID }}

      - name: Generate trade analyses
        run: npm run generate-trade-analysis
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SLEEPER_LEAGUE_ID: ${{ secrets.SLEEPER_LEAGUE_ID }}

      - name: Check for new analyses
        id: check_changes
        run: |
          if [ -z "$(git status --porcelain src/data/trade-summaries/)" ]; then
            echo "changes=false" >> $GITHUB_OUTPUT
            echo "No new trade analyses generated"
          else
            echo "changes=true" >> $GITHUB_OUTPUT
            echo "New trade analyses detected!"
          fi

      - name: Commit and push new analyses
        if: steps.check_changes.outputs.changes == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/trade-summaries/
          git commit -m "$(cat <<'EOF'
          🤖 Auto-generate trade analyses

          Generated new AI-powered trade commentary with NFL analyst personas.

          🤖 Automated by GitHub Actions
          Co-Authored-By: Claude <noreply@anthropic.com>
          EOF
          )"
          git push

      - name: Summary
        if: steps.check_changes.outputs.changes == 'true'
        run: |
          echo "✅ New trade analyses generated and pushed!"
          echo "🚀 Deployment will trigger automatically"

      - name: No new analyses
        if: steps.check_changes.outputs.changes == 'false'
        run: |
          echo "ℹ️ All trades already have analyses"
          echo "No action needed"
```

2. **Commit and push** the workflow file:
```bash
git add .github/workflows/trade-analysis.yml
git commit -m "Add GitHub Actions workflow for automated trade analysis"
git push
```

3. **Verify** the workflow appears in the GitHub Actions tab

### What This Enables:

- **Automated trade analysis generation** twice per week
- **Tuesday at 11 AM UTC** (after Monday Night Football)
- **Friday at 2 PM UTC** (after waivers clear)
- **Manual trigger** available anytime via GitHub Actions UI

### Required Secrets:

Make sure these are already set in your GitHub repository (they should be from weekly summaries):
- ✅ `ANTHROPIC_API_KEY` - Your Claude API key
- ✅ `SLEEPER_LEAGUE_ID` - Your league ID

### Testing:

After adding the workflow, you can test it by:
1. Going to GitHub Actions tab
2. Selecting "Generate Trade Analyses" workflow
3. Clicking "Run workflow" button
4. Checking the logs to ensure it runs successfully

---

Once this workflow is added, the Trade Analyzer feature will be fully automated! 🎉

**You can delete this file after completing the setup.**
