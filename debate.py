#!/usr/bin/env python3
"""
botroom — two AI agents deliberate a topic to consensus.

Usage:
  python debate.py "Is Python better than JavaScript for backend services?"
  python debate.py --maker deepseek-r1 --checker llama-70b "Should we use microservices?"
  python debate.py --list-models
  python debate.py --verbose "What is the best sorting algorithm?"
  python debate.py --max-turns 6 "Is TDD worth the overhead?"
"""

import argparse
import sys

import config
from config import FREE_MODELS, ALL_MODELS
from src.agent import Agent
from src.display import DebateDisplay
from src.orchestrator import Orchestrator


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="debate",
        description="Run a two-agent AI deliberation via OpenRouter.",
    )
    p.add_argument("topic", nargs="?", help="The topic or question to debate.")
    p.add_argument(
        "--maker",
        default="llama-70b",
        choices=list(ALL_MODELS.keys()),
        help="Model key for MAKER agent (default: llama-70b via Groq).",
    )
    p.add_argument(
        "--checker",
        default="llama4-maverick",
        choices=list(ALL_MODELS.keys()),
        help="Model key for CHECKER agent (default: llama4-maverick via Groq).",
    )
    p.add_argument(
        "--max-turns",
        type=int,
        default=config.MAX_TURNS,
        metavar="N",
        help=f"Max debate turns before forced synthesis (default: {config.MAX_TURNS}).",
    )
    p.add_argument(
        "--api-key",
        default=None,
        metavar="KEY",
        help="OpenRouter API key (overrides OPENROUTER_API_KEY env var).",
    )
    p.add_argument(
        "--groq-key",
        default=None,
        metavar="KEY",
        help="Groq API key (overrides GROQ_API_KEY env var).",
    )
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Show each agent's internal 'thinking' trace.",
    )
    p.add_argument(
        "--list-models",
        action="store_true",
        help="Print available free model keys and exit.",
    )
    p.add_argument(
        "--probe-models",
        action="store_true",
        help="Ping each model and report which are reachable right now.",
    )
    return p


def _probe_models(api_key: str) -> None:
    import httpx as _httpx
    print("\nProbing free models...\n")
    for key, model_id in FREE_MODELS.items():
        try:
            resp = _httpx.post(
                f"{config.OPENROUTER_API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model_id, "messages": [{"role": "user", "content": "OK"}], "max_tokens": 3},
                timeout=15,
            )
            data = resp.json()
            if "choices" in data:
                print(f"  [OK]  {key:<16} {model_id}")
            else:
                code = data.get("error", {}).get("code", "?")
                print(f"  [{code}] {key:<16} {model_id}")
        except Exception as e:
            print(f"  [ERR] {key:<16} {e}")
    print()


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.list_models:
        defaults = (config.DEFAULT_MAKER_MODEL, config.DEFAULT_CHECKER_MODEL)
        print("\nGroq models (primary):\n")
        for key, model_id in config.GROQ_MODELS.items():
            marker = " *" if model_id in defaults else ""
            print(f"  {key:<20} {model_id}{marker}")
        print("\nOpenRouter free models (fallback):\n")
        for key, model_id in FREE_MODELS.items():
            marker = " *" if model_id in defaults else ""
            print(f"  {key:<20} {model_id}{marker}")
        print("\n* current defaults\n")
        sys.exit(0)

    if args.probe_models:
        _probe_models(args.api_key or config.OPENROUTER_API_KEY)
        sys.exit(0)

    # Apply Groq key override if provided
    if args.groq_key:
        config.GROQ_API_KEY = args.groq_key

    # Resolve topic
    topic = args.topic
    if not topic:
        try:
            topic = input("Topic to debate: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(0)
    if not topic:
        parser.error("A topic is required.")

    # Resolve API key
    api_key = args.api_key or config.OPENROUTER_API_KEY
    if not api_key:
        print(
            "\nNo OpenRouter API key found.\n"
            "Set OPENROUTER_API_KEY in your environment or .env file,\n"
            "or pass --api-key <key>.\n"
        )
        sys.exit(1)

    maker_model   = ALL_MODELS[args.maker]
    checker_model = ALL_MODELS[args.checker]

    display = DebateDisplay(verbose=args.verbose)
    display.header(topic, maker_model, checker_model)

    maker = Agent(
        name="MAKER",
        role="maker",
        model=maker_model,
        topic=topic,
        api_key=api_key,
    )
    checker = Agent(
        name="CHECKER",
        role="checker",
        model=checker_model,
        topic=topic,
        api_key=api_key,
    )

    orchestrator = Orchestrator(
        topic=topic,
        maker=maker,
        checker=checker,
        display=display,
        max_turns=args.max_turns,
    )

    try:
        orchestrator.run()
    except KeyboardInterrupt:
        print("\n\n[Interrupted]\n")
        sys.exit(0)
    except Exception as e:
        display.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
