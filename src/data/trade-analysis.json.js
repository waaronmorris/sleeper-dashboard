// Data loader for trade analysis summaries
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load all trade analysis summaries from the trade-summaries directory
 */
function loadTradeAnalyses() {
  const summariesDir = join(__dirname, 'trade-summaries');

  // Return empty array if directory doesn't exist
  if (!existsSync(summariesDir)) {
    console.error('Trade summaries directory not found. Run "node src/data/generate-trade-analysis.js" to generate analyses.');
    return [];
  }

  const files = readdirSync(summariesDir);
  const analyses = [];

  files.forEach(file => {
    if (file.startsWith('trade-') && file.endsWith('.json')) {
      try {
        const filePath = join(summariesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        analyses.push(data);
      } catch (error) {
        console.error(`Error loading ${file}:`, error.message);
      }
    }
  });

  // Sort by season and week (most recent first)
  analyses.sort((a, b) => {
    if (a.season !== b.season) {
      return parseInt(b.season) - parseInt(a.season);
    }
    return b.week - a.week;
  });

  return analyses;
}

const analyses = loadTradeAnalyses();
process.stdout.write(JSON.stringify(analyses, null, 2));
