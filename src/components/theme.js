// Ledger chart theme — single source of truth for chart colors and Plot defaults.
// Usage:
//   import {T, plotTheme, positionColor, seriesColor} from "./components/theme.js";
//   Plot.plot(plotTheme({ marks: [ Plot.line(data, {stroke: T.brass}) ] }))

export const T = {
  ground: "#0b0e13",
  ground2: "#10151d",
  ground3: "#151b25",
  ink: "#efe9dc",
  ink2: "#c2bcb0",
  ink3: "#8d939d",
  ink4: "#5d646f",
  hair: "rgba(239, 233, 220, 0.10)",
  hair2: "rgba(239, 233, 220, 0.18)",
  brass: "#c9a43a",
  brass2: "#e3c15b",
  brassSoft: "rgba(201, 164, 58, 0.14)",
  up: "#86b37a",
  down: "#d9623b",
  slate: "#7f93ad",
  mauve: "#b08ea8",
  sand: "#d8c8a8"
};

// Categorical series, in priority order. Brass is the "this one" color; use it for the
// highlighted series and the muted tones for everything else.
export const series = [T.brass, T.slate, T.up, T.mauve, T.down, T.sand, T.ink3, T.ink4];
export const seriesColor = i => series[i % series.length];

// Many-series lines (one per team): draw all in ink at low opacity and highlight one in brass.
export const multiLine = { stroke: T.ink2, strokeOpacity: 0.25, strokeWidth: 1 };
export const highlightLine = { stroke: T.brass, strokeWidth: 2.25 };

// Diverging: negative -> neutral -> positive
export const diverging = [T.down, T.ink4, T.up];
// Sequential ramp for heatmaps / intensity: ground -> brass
export const sequential = ["#1b2230", "#4a4330", "#7a6830", "#a88a34", T.brass, T.brass2];

export const positionColors = { QB: T.slate, RB: T.up, WR: T.brass, TE: T.mauve, K: T.ink3, DEF: T.ink4, DST: T.ink4 };
export const positionColor = pos => positionColors[pos] || T.ink3;

// Win/loss or good/bad
export const outcome = v => (v > 0 ? T.up : v < 0 ? T.down : T.ink3);

/**
 * Merge Ledger defaults into a Plot options object.
 * Sets fonts, grid, background; leaves data/marks untouched.
 * Axes default to mono labels; pass x/y overrides freely — they're deep-merged.
 */
export function plotTheme(options = {}) {
  const {x = {}, y = {}, color = {}, style = {}, ...rest} = options;
  return {
    marginTop: 20,
    marginRight: 20,
    marginBottom: 40,
    marginLeft: 48,
    ...rest,
    style: {
      background: "transparent",
      color: T.ink3,
      fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
      fontSize: "11px",
      overflow: "visible",
      ...style
    },
    x: {grid: false, line: false, tickSize: 0, tickPadding: 8, labelAnchor: "center", labelOffset: 32, ...x},
    y: {grid: true, line: false, tickSize: 0, tickPadding: 8, labelAnchor: "top", ...y},
    color: color.range || color.scheme ? color : {range: series, ...color}
  };
}

// Tip styling for Plot.tip / tip: true
export const tipStyle = {fill: T.ground2, stroke: T.hair2, fontFamily: '"IBM Plex Mono", monospace', fontSize: 11};
