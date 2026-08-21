# Ledger Design System

The site's visual identity: **warm ink on a dark ground, one brass accent, Fraunces for titles and hero numerals, Source Sans 3 for reading, IBM Plex Mono for data.** Restraint is the point — numbers and hairlines carry the design; color is rationed.

Source of truth: `src/observablehq.css` (tokens + components), `src/components/theme.js` (chart colors + Plot defaults), `observablehq.config.js` (shell). Fonts load from the config head.

## Rules for page code

1. **No inline `style="…"` attributes, no hex colors, no hardcoded fonts in `.md` pages.** Use the classes below. If something truly has no class, add a small `<style>` block at the top of the page using tokens (`var(--brass)`, `var(--space-4)`), never raw values. Aim for zero `style="` in a finished page.
2. **Charts import the theme:** `import {T, plotTheme, seriesColor, positionColor, multiLine, highlightLine, outcome, tipStyle} from "./components/theme.js";` and wrap options in `plotTheme({...})`. Replace every hex in a mark with `T.*` or a helper. Many-team line charts: draw all lines with `...multiLine` and the highlighted one with `...highlightLine`.
3. **Color means something.** Brass = the thing being looked at / the league's accent. `--up` = wins, gains, positive value. `--down` = losses, declines, negative. `--slate` = neutral/info series. `--mauve` = a third categorical tone. Do not use five colors where two will do. Never use a traffic-light (green/yellow/red) triple for a ranking — use brass for the top, ink for the middle, `--down` for the bottom, or just text.
4. **Headings are semantic and already styled.** Page title = `<h1>` inside `.page-head`. Sections = `<h2>` (Markdown `##`). Subsections = `<h3>`. Small mono overlines = `<h4>` or `.eyebrow`. Don't add color or emoji to headings; drop existing emoji from headings and labels.
5. **Copy**: plain verbs, sentence case, no filler ("Professional-grade", "Advanced", "🏆"). Labels name what the reader controls or recognizes. Empty and error states say what's missing and what to do.
6. **Keep all data logic, computations, interactivity, and DOM structure that scripts depend on.** This is a re-skin: don't change what a page computes or shows, only how it looks and reads. If a page builds HTML as strings and sets `innerHTML`, migrate those strings to classes too.
7. Don't touch `observablehq.css`, `theme.js`, or the config — if a component is missing, use the nearest one and note it in your report.

## Components (class → use)

### Page & sections
```html
<header class="page-head">
  <p class="eyebrow">Season 2026 · Week 3</p>
  <h1>Who holds the <em>surplus</em>?</h1>          <!-- one italic brass word max -->
  <p class="lede">One sentence on what this page answers.</p>
  <p class="meta">Updated from Sleeper · 12 teams</p>
</header>
```
- `##` Markdown headings render as hairline-ruled section titles. Optional right-aligned meta: `<h2>Standings <span class="section-meta">through week 3</span></h2>`.
- `<details class="section-collapse"><summary class="section-summary">Title <small>meta</small></summary><div class="section-content">…</div></details>` — existing collapsibles, already restyled.
- `.insights` — closing takeaways block: `<section class="insights"><h3>What this means</h3><ul><li><strong>Lead.</strong> sentence</li></ul></section>`

### Numbers
```html
<div class="stat-grid">
  <div class="stat"><div class="stat__k">Points for</div><div class="stat__v">1,653.8</div><div class="stat__d up">+4.2% vs avg</div></div>
  <div class="stat stat--brass"><div class="stat__k">Leader</div><div class="stat__v stat--text">Shogunation</div></div>
</div>
```
- `.stat-grid` = hairline-ruled row of stats (preferred over cards for KPIs). Children `.stat`.
- `.stat--hero` for the one number a page is about; `.stat--brass/--up/--down/--slate/--muted` tint the value; `.stat--text` for word values; `.stat__l` small grey line under the value.
- Legacy `.kpi-card .kpi-label .kpi-value .kpi-change.positive|negative` still work and are restyled — prefer converting to `.stat`.

### Containers
- `.card` — quiet bordered box (`.card--accent` brass top rule, `.card--up`, `.card--down`, `.card--slate`, `.card--tight`, `.card--flat`). Inside: `.card__title`, `.card__k`, `.card__v`, `.card__foot`.
- `.note` — methodology/caveat with a hairline left rule (`.note--brass/--up/--down/--slate`). Legacy `.alert .alert-success|warning|danger|info` map here.
- `.grid`, `.grid-2`, `.grid-3`, `.grid-4`, `.stack`, `.row`, `.split` (1:2 two-column at ≥900px), `.split--even`.

### Labels
- `.badge` (+ `.badge--brass`, `.badge--up`, `.badge--down`, `.badge--slate`, `.badge--solid`, `.badge--pos-qb|rb|wr|te|k|def`). Legacy `.badge-success|warning|danger|info` map.
- `.rank` circled mono rank (`.rank--top`, `.rank--bottom`).
- `.delta.up|down` signed change with ▲/▼.
- `.eyebrow`, `.mono`, `.num`, `.muted`, `.ink-2`, `.up`, `.down`, `.brass`, `.slate`, `.text-sm`, `.text-xs`, `.text-right`.

### Tables
- Raw `<table>`: wrap in `<div class="table-wrap">` when wide. Numeric cells get `class="num"`. Row states: `tr.is-me`, `tr.is-top`, `tr.is-bottom`. Header/body are already styled; don't add borders/backgrounds.
- `Inputs.table(...)` is styled globally; keep its `format`/`width` options, remove color hacks.

### Forms
- `Inputs.radio/select/range/text` are styled globally (mono, brass accent). Group controls in a `.row`.
- Buttons: `<button>` default is hairline; `.button--primary` brass fill.

### Charts
```js
import * as Plot from "npm:@observablehq/plot";
import {T, plotTheme, seriesColor, positionColor, multiLine, highlightLine, outcome, tipStyle} from "./components/theme.js";

display(Plot.plot(plotTheme({
  height: 320,
  x: {label: "Week"}, y: {label: "Points"},
  marks: [
    Plot.line(data, {x: "week", y: "points", z: "team", ...multiLine}),
    Plot.line(data.filter(d => d.team === me), {x: "week", y: "points", ...highlightLine}),
    Plot.dot(data, {x: "week", y: "points", fill: T.brass, tip: true})
  ]
})));
```
- Wrap in `<figure class="chart"><div class="chart__title">Title</div><p class="chart__sub">One line on how to read it</p>${plot}<div class="chart__cap">Source/caveat</div></figure>` when a title is needed; otherwise the plot alone.
- Bars ranked best→worst: top 3 `T.brass`, rest `T.ink3`, bottom 3 `T.down` (or all `T.ink2` with one highlight). Win/loss: `outcome(v)`. Positions: `positionColor(pos)`. Diverging scales: `color: {type: "diverging", range: diverging}`.
- Never: gradients, drop shadows, rounded plot backgrounds, `#22c55e`, `#ef4444`, `#3b82f6`, `#8b5cf6`, `#f59e0b`.

## Tokens (for the rare `<style>` block)
Ground `--ground` `--ground-2` `--ground-3` `--ground-4` · Ink `--ink` `--ink-2` `--ink-3` `--ink-4` · Lines `--hair` `--hair-2` · Accent `--brass` `--brass-2` `--brass-soft` `--brass-hair` · Semantic `--up` `--up-soft` `--down` `--down-soft` `--slate` `--slate-soft` `--mauve` · Positions `--pos-qb` … `--pos-def` · Type `--font-display` `--font-body` `--font-mono`, sizes `--text-xs … --text-2xl --text-hero` · Space `--space-1 … --space-8` · `--radius` (4px) `--radius-lg` (6px).

## Consistency rules (settled after the first migration pass)

1. **Sections.** Every section is a Markdown `##`. Collapsibles (`.section-collapse`) are only for long secondary detail *inside* a section, and default **open**. Never wrap a single collapsible in a `##` with a near-duplicate title, and never repeat a section's title as an `h3` inside it. A page must not be an empty shell on load.
2. **Page head.** Always: `.eyebrow` → `h1` → `.lede`, optional `.meta` only for data provenance ("Based on 2025 results"). Eyebrow grammar is **season first**: `2026 season · in season`, `2025 season · final`. No badges, timestamps, or rows of chips in the head. Page controls (selects, radios) sit directly under the page head in a `.row` — not in a "Filters" section and not inside the first data section.
3. **Containers.** Do not wrap tables or charts in `.card`. Tables and charts sit bare under their `##`. `.card` is only for repeated per-item groups (one team, one trade, one pick). Methodology lives in **one** closing `<section class="insights"><h3>Reading this page</h3>…</section>` on every page — never as cards at the top.
4. **Empty states.** When there is no data: show the `.note` and **hide** the chart, table, pager, or placeholder cards. Never render both. Never tint a placeholder (`—` is always `.stat--muted`).
5. **Color.** Counts and totals are never tinted. Brass = the leader / the thing being looked at. Ember (`--down`) = worst / negative. Green (`--up`) only for wins and positive deltas. "Who won the trade" is shown with a brass left rule on the winning side (`.trade-side--win`) and nothing on the other — no green/red boxes. Color words in copy: *brass*, *ember*, *green*.
6. **Charts.** A titled chart is always `<figure class="chart"><div class="chart__title">…</div><p class="chart__sub">…</p>${plot}</figure>`; ranked bars are brass (top 3) / `T.ink4` (middle) / `T.down` (bottom 3); width is `Math.min(width, 800)` and left margins shrink below 640px.
7. **Per-team lists.** A repeated per-team group is a `.card` with the team name as `.card__title` (not an `h2`/`h3`) and a `.rank` marker when ranked.
8. **Shared pieces** now in CSS: `.hero-num` (Fraunces numeral for grades/scores/pick numbers; `--sm`, `--brass`, `--down`), `.table-wrap .sticky-col`. Replace page-local equivalents with them.

## Season picker (every page)

All pages mount the global season picker so the reader's choice persists across the site:
```js
import {mountSeasonPicker} from "./components/season.js";
const seasonsData = await FileAttachment("data/seasons.json").json();
const season = Generators.input(mountSeasonPicker(seasonsData));
```
```js
const S = seasonsData.by_season[season];   // { season, league_id, status, is_current, league, rosters, users, matchups, playoff_week_start }
```
- **Season-keyed pages** (index, players, matchups, allplay): drop the `league.json`/`rosters.json`/`users.json`/`matchups.json` attachments and read `S.league`, `S.rosters`, `S.users`, `S.matchups` instead (same shapes). Put `S` in its own cell so everything recomputes when the season changes. Eyebrow: `${season} season · ${S.is_current ? S.status.replace(/_/g, " ") : "final"}`. Anything that only exists for the current season (week summaries, projections) is shown only when `S.is_current`.
- **Multi-year pages with their own season control** (draft-overview, draft-retro, trade-retro, trade-analysis): mount the picker; read team names from `S.rosters`/`S.users`; set the internal season select's default to `season` when that season exists in its options (keep "All seasons" as the default only when the picker is on the current season). 
- **Current-season-only or all-time pages** (power-rankings, atrocity, trade-finder, next-season, ring-of-honor): mount the picker; when `!S.is_current` show, directly under the page head, `<aside class="note note--brass"><b>Showing the ${seasonsData.current} season.</b> This page is only available for the season in progress.</aside>` and keep rendering current data. Ring of Honor is all-time: no note needed.

## Definition of done for a migrated page
- `grep -c 'style="' page.md` → 0 (or a handful, each justified in your report).
- `grep -cE '#[0-9a-fA-F]{6}' page.md` → 0.
- Page loads with no `.observablehq--error` cells; interactive controls still work; every chart still renders with the same data.
- Has a `.page-head` with a real `<h1>` thesis and a one-line `.lede`.
- Reads well at 390px wide (no horizontal page scroll; wide tables inside `.table-wrap`).
