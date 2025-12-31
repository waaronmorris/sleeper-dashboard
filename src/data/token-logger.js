/**
 * Token Usage Logger
 *
 * Tracks and logs token usage from Anthropic API calls for cost monitoring
 * and prompt optimization.
 *
 * Usage:
 *   import { createTokenLogger } from './token-logger.js';
 *   const tokenLogger = createTokenLogger();
 *
 *   // After each API call:
 *   tokenLogger.log('generate-summary', message.usage);
 *
 *   // At script end:
 *   tokenLogger.summary();
 */

// Claude Sonnet 4.5 pricing (as of 2024)
const PRICING = {
  'claude-sonnet-4-5': {
    input: 3.00,   // $ per 1M input tokens
    output: 15.00  // $ per 1M output tokens
  },
  // Add other models as needed
  'claude-opus-4-5': {
    input: 15.00,
    output: 75.00
  },
  'claude-haiku-3-5': {
    input: 0.80,
    output: 4.00
  }
};

const DEFAULT_MODEL = 'claude-sonnet-4-5';

/**
 * Calculate cost in dollars from token counts
 */
function calculateCost(inputTokens, outputTokens, model = DEFAULT_MODEL) {
  const pricing = PRICING[model] || PRICING[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
}

/**
 * Format cost for display
 */
function formatCost(cost) {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(3)}c`; // Show in cents for tiny amounts
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format token count with commas
 */
function formatTokens(count) {
  return count.toLocaleString();
}

/**
 * Create a token logger instance for tracking usage across a script run
 */
export function createTokenLogger(options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const silent = options.silent || false;

  // Cumulative tracking
  const calls = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  return {
    /**
     * Log token usage from an API call
     * @param {string} operation - Name of the operation (e.g., 'generate-summary', 'fetch-context')
     * @param {object} usage - The usage object from Anthropic response (contains input_tokens, output_tokens)
     * @param {object} [metadata] - Optional additional context (e.g., { week: 5 })
     */
    log(operation, usage, metadata = {}) {
      if (!usage || typeof usage.input_tokens !== 'number') {
        console.warn(`⚠️  No token usage data for operation: ${operation}`);
        return null;
      }

      const { input_tokens, output_tokens } = usage;
      const cost = calculateCost(input_tokens, output_tokens, model);

      // Track cumulative
      totalInputTokens += input_tokens;
      totalOutputTokens += output_tokens;

      const callData = {
        operation,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        totalTokens: input_tokens + output_tokens,
        cost: cost.totalCost,
        metadata,
        timestamp: new Date().toISOString()
      };
      calls.push(callData);

      // Log to console unless silent
      if (!silent) {
        const metaStr = Object.keys(metadata).length > 0
          ? ` (${Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join(', ')})`
          : '';
        console.log(
          `📊 Tokens [${operation}]${metaStr}: ` +
          `${formatTokens(input_tokens)} in → ${formatTokens(output_tokens)} out ` +
          `(${formatTokens(input_tokens + output_tokens)} total, ${formatCost(cost.totalCost)})`
        );
      }

      return callData;
    },

    /**
     * Log and return session summary
     */
    summary() {
      const cost = calculateCost(totalInputTokens, totalOutputTokens, model);

      console.log('\n' + '='.repeat(60));
      console.log('📈 TOKEN USAGE SUMMARY');
      console.log('='.repeat(60));
      console.log(`   Model: ${model}`);
      console.log(`   API Calls: ${calls.length}`);
      console.log(`   Input Tokens: ${formatTokens(totalInputTokens)}`);
      console.log(`   Output Tokens: ${formatTokens(totalOutputTokens)}`);
      console.log(`   Total Tokens: ${formatTokens(totalInputTokens + totalOutputTokens)}`);
      console.log('-'.repeat(60));
      console.log(`   Input Cost: ${formatCost(cost.inputCost)}`);
      console.log(`   Output Cost: ${formatCost(cost.outputCost)}`);
      console.log(`   Total Cost: ${formatCost(cost.totalCost)}`);
      console.log('='.repeat(60) + '\n');

      // Breakdown by operation
      if (calls.length > 1) {
        const byOperation = {};
        for (const call of calls) {
          if (!byOperation[call.operation]) {
            byOperation[call.operation] = {
              count: 0,
              inputTokens: 0,
              outputTokens: 0,
              cost: 0
            };
          }
          byOperation[call.operation].count++;
          byOperation[call.operation].inputTokens += call.inputTokens;
          byOperation[call.operation].outputTokens += call.outputTokens;
          byOperation[call.operation].cost += call.cost;
        }

        console.log('📋 BREAKDOWN BY OPERATION:');
        for (const [op, data] of Object.entries(byOperation)) {
          console.log(`   ${op}:`);
          console.log(`     Calls: ${data.count}`);
          console.log(`     Tokens: ${formatTokens(data.inputTokens + data.outputTokens)} (${formatTokens(data.inputTokens)} in / ${formatTokens(data.outputTokens)} out)`);
          console.log(`     Cost: ${formatCost(data.cost)}`);
        }
        console.log('');
      }

      return {
        model,
        callCount: calls.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        cost,
        calls
      };
    },

    /**
     * Get current totals without logging
     */
    getTotals() {
      return {
        callCount: calls.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        cost: calculateCost(totalInputTokens, totalOutputTokens, model)
      };
    },

    /**
     * Get all logged calls
     */
    getCalls() {
      return [...calls];
    }
  };
}

export default createTokenLogger;
