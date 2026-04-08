/**
 * Terminal mode debate harness.
 *
 * Usage:
 *   GROQ_API_KEY=<key> npx tsx scripts/debate.ts "<topic>" [options]
 *
 * Options:
 *   --json                  Emit JSON lines to stdout (one object per event)
 *   --maker-model <id>      Model for MAKER agent  (default: llama-3.3-70b-versatile)
 *   --checker-model <id>    Model for CHECKER agent (default: llama-3.3-70b-versatile)
 *   --max-turns <n>         Maximum debate turns    (default: 8)
 *   --min-turns <n>         Minimum turns before CONCLUDE/CONCEDE allowed (default: 0)
 *   --allow-clarification   Ask MAKER a clarifying question before Turn 1
 *   --web-search            Enable Tavily web search (requires TAVILY_API_KEY)
 *   --verbose               Include agent thinking in output
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { runDebate, getClarificationQuestion } from '../netlify/functions/lib/orchestrator.js';
import type { DebateConfig } from '../netlify/functions/lib/types.js';

// ── Arg parsing ──────────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): {
  topic: string;
  config: DebateConfig;
  jsonMode: boolean;
  allowClarification: boolean;
} {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/debate.ts "<topic>" [options]

Options:
  --json                  Emit JSON lines instead of human-readable output
  --maker-model <id>      Model for MAKER agent  (default: llama-3.3-70b-versatile)
  --checker-model <id>    Model for CHECKER agent (default: llama-3.3-70b-versatile)
  --max-turns <n>         Maximum debate turns    (default: 8)
  --min-turns <n>         Minimum turns before CONCLUDE/CONCEDE is allowed (default: 0)
  --allow-clarification   Ask MAKER a clarifying question before Turn 1
  --web-search            Enable Tavily web search (requires TAVILY_API_KEY env var)
  --verbose               Include agent thinking in output

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
  let minTurns = 0;
  let verbose = false;
  let allowClarification = false;
  let enableWebSearch = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--json':
        jsonMode = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--allow-clarification':
        allowClarification = true;
        break;
      case '--web-search':
        enableWebSearch = true;
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
      case '--min-turns':
        minTurns = parseInt(args[++i], 10);
        break;
    }
  }

  return {
    topic,
    allowClarification,
    jsonMode,
    config: {
      topic,
      makerModel,
      checkerModel,
      maxTurns,
      verbose,
      allowClarification,
      minTurnsBeforeConclusion: minTurns,
      enableWebSearch,
    },
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
  const { topic, config, jsonMode, allowClarification } = parseArgs(argv);

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error('Error: GROQ_API_KEY environment variable is required');
    process.exit(1);
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const tavilyApiKey = process.env.TAVILY_API_KEY;

  // Pre-debate clarification phase
  let effectiveTopic = topic;
  if (allowClarification) {
    if (!jsonMode) {
      process.stdout.write(color('\nChecking whether MAKER needs clarification…\n', DIM));
    }

    const question = await getClarificationQuestion(config, groqApiKey, openRouterApiKey);

    if (question) {
      if (jsonMode) {
        process.stdout.write(
          JSON.stringify({ type: 'clarification_request', data: { question } }) + '\n',
        );
        // In JSON mode, read the answer from stdin
        const rl = readline.createInterface({ input, output });
        const answer = await rl.question('');
        rl.close();
        if (answer.trim()) {
          effectiveTopic = `${topic}\n\n[User clarification: ${answer.trim()}]`;
          process.stdout.write(
            JSON.stringify({ type: 'clarification_answer', data: { answer: answer.trim() } }) + '\n',
          );
        }
      } else {
        console.log(color(`\nMAKER asks: `, BOLD) + question);
        const rl = readline.createInterface({ input, output });
        const answer = await rl.question(color('Your answer (Enter to skip): ', DIM));
        rl.close();
        if (answer.trim()) {
          effectiveTopic = `${topic}\n\n[User clarification: ${answer.trim()}]`;
        }
      }
    } else if (!jsonMode) {
      console.log(color('Topic is clear — no clarification needed.\n', DIM));
    }
  }

  // Run debate with (potentially enhanced) topic
  const finalConfig: DebateConfig = { ...config, topic: effectiveTopic };

  if (!jsonMode) {
    console.log(color(`\nBotroom Debate`, BOLD));
    console.log(color(`Topic: ${effectiveTopic}`, BOLD));
    console.log(
      color(
        `Models: MAKER=${config.makerModel}  CHECKER=${config.checkerModel}  maxTurns=${config.maxTurns}` +
          (config.minTurnsBeforeConclusion ? `  minTurns=${config.minTurnsBeforeConclusion}` : '') +
          (config.enableWebSearch ? '  webSearch=on' : ''),
        DIM,
      ),
    );
    console.log(color('─'.repeat(60), DIM));
  }

  try {
    for await (const event of runDebate(finalConfig, groqApiKey, openRouterApiKey, tavilyApiKey)) {
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
