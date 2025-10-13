// Data loader for combining all weekly summaries into a single file
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read all summary files from the week-summaries directory
const summariesDir = join(__dirname, 'week-summaries');

let allSummaries = [];

if (existsSync(summariesDir)) {
  const files = readdirSync(summariesDir).filter(f => f.endsWith('.json'));

  allSummaries = files.map(file => {
    const content = readFileSync(join(summariesDir, file), 'utf-8');
    return JSON.parse(content);
  }).sort((a, b) => a.week - b.week); // Sort by week number
}

// Output combined summaries as JSON array
process.stdout.write(JSON.stringify(allSummaries, null, 2));
