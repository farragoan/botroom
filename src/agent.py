import json
import re
import time
import httpx
from typing import Optional

from src.models import AgentResponse
import config


MAKER_SYSTEM = """\
You are MAKER, an AI agent in a two-agent deliberation system. Your partner is CHECKER.
Your role: PROPOSE and DEFEND. Generate positions, build arguments, refine based on feedback.

TOPIC: {topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{{
  "thinking": "<1-3 sentence internal reasoning — not shown to CHECKER>",
  "message": "<your actual message to CHECKER>",
  "action": "<CONTINUE | CONCLUDE | CONCEDE>",
  "conceded_points": ["<point you're conceding>"],
  "conclusion_summary": "<your final position — required when action=CONCLUDE, else null>"
}}

== ACTIONS ==
CONTINUE  — you have more to add or are responding to a point
CONCEDE   — you acknowledge a valid critique; list it in conceded_points; discussion continues
CONCLUDE  — you are satisfied with where the discussion stands; include conclusion_summary

== GUIDELINES ==
- You are talking to another AI. Skip pleasantries. Be dense and efficient.
- Build incrementally — don't repeat points already made.
- Acknowledge when CHECKER is correct.
- Aim for convergence. After 3-4 turns seriously consider CONCLUDE.
- It's fine to divide positions (agree on X, disagree on Y).
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.\
"""

CHECKER_SYSTEM = """\
You are CHECKER, an AI agent in a two-agent deliberation system. Your partner is MAKER.
Your role: CRITIQUE and VERIFY. Find flaws, edge cases, and alternative perspectives.
Also validate when MAKER's reasoning is genuinely sound — false negatives waste turns.

TOPIC: {topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{{
  "thinking": "<1-3 sentence internal reasoning — not shown to MAKER>",
  "message": "<your actual message to MAKER>",
  "action": "<CONTINUE | CONCLUDE | CONCEDE>",
  "conceded_points": ["<point you're conceding>"],
  "conclusion_summary": "<your final position — required when action=CONCLUDE, else null>"
}}

== ACTIONS ==
CONTINUE  — you have a challenge or follow-up point
CONCEDE   — you acknowledge MAKER's point is valid; list it in conceded_points; discussion continues
CONCLUDE  — you are satisfied the topic has been adequately explored; include conclusion_summary

== GUIDELINES ==
- You are talking to another AI. Skip pleasantries. Be dense and efficient.
- Don't manufacture objections — only raise genuine issues.
- If MAKER has addressed your concern, move on or CONCLUDE.
- Aim for convergence. After 3-4 turns seriously consider CONCLUDE.
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.\
"""


def _extract_json(raw: str) -> dict:
    """Robustly extract a JSON object from LLM output."""
    raw = raw.strip()

    # 1. Direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown code fences
    stripped = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    stripped = re.sub(r"\s*```$", "", stripped, flags=re.MULTILINE).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # 3. Find first {...} block
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # 4. Fallback: treat whole response as a CONTINUE message
    return {
        "thinking": "",
        "message": raw,
        "action": "CONTINUE",
        "conceded_points": [],
        "conclusion_summary": None,
    }


class Agent:
    def __init__(
        self,
        name: str,
        role: str,          # "maker" | "checker"
        model: str,
        topic: str,
        api_key: str,
    ):
        self.name = name
        self.role = role
        self.model = model
        self.api_key = api_key

        system_template = MAKER_SYSTEM if role == "maker" else CHECKER_SYSTEM
        self._system = system_template.format(topic=topic)
        self._history: list[dict] = []   # OpenAI-format message list

    # ------------------------------------------------------------------ #

    def respond(self, incoming: str) -> AgentResponse:
        """Add incoming message and get this agent's response."""
        self._history.append({"role": "user", "content": incoming})

        raw = self._call_api()
        parsed = _extract_json(raw)

        response = AgentResponse(
            thinking=parsed.get("thinking", ""),
            message=parsed.get("message", raw),
            action=parsed.get("action", "CONTINUE").upper(),
            conceded_points=parsed.get("conceded_points", []) or [],
            conclusion_summary=parsed.get("conclusion_summary"),
            raw=raw,
        )

        # Add our reply to history so subsequent turns have full context
        self._history.append({"role": "assistant", "content": raw})
        return response

    def open(self, prompt: str) -> AgentResponse:
        """MAKER's first message — no incoming, just an opening prompt."""
        return self.respond(prompt)

    # ------------------------------------------------------------------ #

    def _build_messages(self) -> list[dict]:
        """
        Merge system prompt into the first user turn.
        Some providers (e.g. Google AI Studio / Gemma) reject a standalone
        system role, so we prepend the instructions to the first user message.
        """
        if not self._history:
            return [{"role": "user", "content": self._system}]
        first = self._history[0]
        merged_first = {
            "role": "user",
            "content": f"{self._system}\n\n---\n\n{first['content']}",
        }
        return [merged_first] + self._history[1:]

    def _call_api(self, retries: int = 4, base_delay: float = 4.0) -> str:
        messages = self._build_messages()

        # Groq is always primary. OpenRouter is fallback only if key is available.
        providers = [(config.GROQ_API_BASE, config.GROQ_API_KEY, {})]
        if config.OPENROUTER_API_KEY:
            providers.append((
                config.OPENROUTER_API_BASE, config.OPENROUTER_API_KEY,
                {"HTTP-Referer": "https://github.com/botroom", "X-Title": "botroom"},
            ))

        for api_base, api_key, extra_headers in providers:
            for attempt in range(retries):
                with httpx.Client(timeout=config.REQUEST_TIMEOUT) as client:
                    resp = client.post(
                        f"{api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                            **extra_headers,
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "max_tokens": config.MAX_TOKENS,
                            "temperature": 0.7,
                        },
                    )

                if resp.status_code == 429:
                    wait = base_delay * (2 ** attempt)
                    if attempt < retries - 1:
                        time.sleep(wait)
                        continue
                    break  # exhausted retries for this provider, try next

                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

        raise RuntimeError("Exceeded retry limit across all providers.")
