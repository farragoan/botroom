/**
 * Terminal mode debate harness.
 *
 * Usage:
 *   GROQ_API_KEY=<key> npx tsx scripts/debate.ts "<topic>" [options]
 *
 * Options:
 *   --json              Emit JSON lines to stdout (one object per event)
 *   --maker-model <id>  Model for MAKER agent  (default: llama-3.3-70b-versatile)
 *   --checker-model <id> Model for CHECKER agent (default: llama-3.3-70b-versatile)
 *   --max-turns <n>     Maximum debate turns    (default: 8)
 *   --verbose           Include agent thinking in output
 */

import { runDebate } from '../netlify/functions/lib/orchestrator.js';
import type { DebateConfig } from '../netlify/functions/lib/types.js';

// ── Arg parsing ──────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): {
  topic: string;
  config: DebateConfig;
  jsonMode: boolean;
} {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/debate.ts "<topic>" [options]

Options:
  --json                Emit JSON lines instead of human-readable output
  --maker-model <id>    Model for MAKER agent  (default: llama-3.3-70b-versatile)
  --checker-model <id>  Model for CHECKER agent (default: llama-3.3-70b-versatile)
  --max-turns <n>       Maximum debate turns    (default: 8)
  --verbose             Include agent thinking in output

Example:
  GROQ_API_KEY=gsk_... npx tsx scripts/debate.ts "Thanos was right to kill half of all life in the universe"
    `.trim());
    process.exit(0);
  }

  const topic = args[0];
  let jsonMode = false;
  let makerModel = 'llama-3.3-70b-versatile';
  let checkerModel = 'llama-3.3-70b-versatile';
  let maxTurns = 8;
  let verbose = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--json':
        jsonMode = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--maker-model':
        makerModel = args[++i];
        break;
      case '--checker-model':
        checkerModel = args[++i];
        break;
      case '--max-turns':
        maxTurns = parseInt(args[++i], 10);
        break;
    }
  }

  return {
    topic,
    jsonMode,
    config: { topic, makerModel, checkerModel, maxTurns, verbose },
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

function color(s: string, ...codes: string[]): string {
  return codes.join('') + s + RESET;
}

type TurnData = {
  turnNumber: number;
  agent: string;
  response: {
    thinking: string;
    message: string;
    action: string;
    conceded_points: string[];
    conclusion_summary: string | null;
  };
};

export function printHumanTurn(event: { type: 'turn'; data: TurnData }, verbose: boolean): void {
  const turn = event.data;
  const agentColor = turn.agent === 'MAKER' ? CYAN : YELLOW;
  const label = color(`[${turn.agent} T${turn.turnNumber}]`, BOLD, agentColor);
  const actionTag = color(`(${turn.response.action})`, DIM);

  console.log(`\n${label} ${actionTag}`);

  if (verbose && turn.response.thinking) {
    console.log(color(`  thinking: ${turn.response.thinking}`, DIM));
  }

  console.log(`  ${turn.response.message}`);

  if (turn.response.conceded_points.length > 0) {
    console.log(color(`  conceded: ${turn.response.conceded_points.join('; ')}`, MAGENTA));
  }

  if (turn.response.conclusion_summary) {
    console.log(color(`  summary:  ${turn.response.conclusion_summary}`, GREEN));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv): Promise<void> {
  const { topic, config, jsonMode } = parseArgs(argv);

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error('Error: GROQ_API_KEY environment variable is required');
    process.exit(1);
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!jsonMode) {
    console.log(color(`\nBotroom Debate`, BOLD));
    console.log(color(`Topic: ${topic}`, BOLD));
    console.log(color(`Models: MAKER=${config.makerModel}  CHECKER=${config.checkerModel}  maxTurns=${config.maxTurns}`, DIM));
    console.log(color('─'.repeat(60), DIM));
  }

  try {
    for await (const event of runDebate(config, groqApiKey, openRouterApiKey)) {
      if (jsonMode) {
        process.stdout.write(JSON.stringify(event) + '\n');
        continue;
      }

      if (event.type === 'turn') {
        printHumanTurn(event as { type: 'turn'; data: TurnData }, config.verbose);
      } else if (event.type === 'synthesis') {
        const s = event.data;
        console.log(color('\n' + '─'.repeat(60), DIM));
        console.log(color(`\nSYNTHESIS (${s.totalTurns} turns, concluded naturally: ${s.concludedNaturally})`, BOLD + GREEN));
        console.log(s.synthesis);
      } else if (event.type === 'error') {
        console.error(color(`\nError: ${event.data.message}`, RED));
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(color(`\nFatal: ${err instanceof Error ? err.message : String(err)}`, RED));
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Only auto-run when invoked directly as a script, not when imported as a module.

const scriptPath = new URL(import.meta.url).pathname;
const argPath = /* c8 ignore next */ process.argv[1] ?? '';
/* c8 ignore next 3 */
if (scriptPath === argPath || scriptPath.replace(/\.ts$/, '.js') === argPath) {
  main();
}
