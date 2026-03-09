import time
import httpx

from src.agent import Agent
from src.models import AgentResponse, DebateResult, Turn
import config


SYNTHESIS_PROMPT = """\
You just observed a debate between two AI agents (MAKER and CHECKER) on this topic:
"{topic}"

Below is the full exchange (in order):
{transcript}

Produce a concise synthesis with three sections:
1. **Consensus** — points both agents agreed on
2. **Remaining disagreements** — anything unresolved
3. **Recommended conclusion** — the best-supported position given the exchange

Be direct. Bullet points preferred. No padding.\
"""


class Orchestrator:
    def __init__(
        self,
        topic: str,
        maker: Agent,
        checker: Agent,
        display,
        max_turns: int = config.MAX_TURNS,
    ):
        self.topic = topic
        self.maker = maker
        self.checker = checker
        self.display = display
        self.max_turns = max_turns
        self._turns: list[Turn] = []

    # ------------------------------------------------------------------ #

    def run(self) -> DebateResult:
        display = self.display

        # --- Opening move: MAKER proposes ---
        display.status("MAKER is opening...")
        maker_open = self.maker.open(
            f"Open the discussion on this topic: {self.topic}\n"
            "State your initial position clearly."
        )
        display.agent_message("MAKER", self.maker.model, maker_open, config.MAKER_COLOR)

        # CHECKER responds to opening
        display.status("CHECKER is responding...")
        checker_resp = self.checker.respond(maker_open.message)
        display.agent_message("CHECKER", self.checker.model, checker_resp, config.CHECKER_COLOR)

        turn = Turn(turn_number=1, maker_response=maker_open, checker_response=checker_resp)
        self._turns.append(turn)

        maker_concluded = maker_open.wants_to_conclude
        checker_concluded = checker_resp.wants_to_conclude

        # --- Main loop ---
        for t in range(2, self.max_turns + 1):
            if maker_concluded and checker_concluded:
                break

            display.turn_header(t, self.max_turns)

            # Build MAKER's incoming: CHECKER's last message + optional conclude notice
            maker_incoming = checker_resp.message
            if checker_concluded and not maker_concluded:
                maker_incoming += "\n\n[CHECKER has indicated they are ready to CONCLUDE. Respond with CONCLUDE if you agree, or CONTINUE if you have more to add.]"

            display.status("MAKER is thinking...")
            maker_resp = self.maker.respond(maker_incoming)
            display.agent_message("MAKER", self.maker.model, maker_resp, config.MAKER_COLOR)
            maker_concluded = maker_resp.wants_to_conclude

            # Build CHECKER's incoming
            checker_incoming = maker_resp.message
            if maker_concluded and not checker_concluded:
                checker_incoming += "\n\n[MAKER has indicated they are ready to CONCLUDE. Respond with CONCLUDE if you agree, or CONTINUE if you have more to add.]"

            display.status("CHECKER is thinking...")
            checker_resp = self.checker.respond(checker_incoming)
            display.agent_message("CHECKER", self.checker.model, checker_resp, config.CHECKER_COLOR)
            checker_concluded = checker_resp.wants_to_conclude

            self._turns.append(Turn(t, maker_resp, checker_resp))

            if maker_concluded and checker_concluded:
                break

        concluded_naturally = maker_concluded and checker_concluded

        # --- Synthesis ---
        display.status("Generating synthesis...")
        synthesis = self._synthesize()
        display.synthesis(synthesis, concluded_naturally, len(self._turns))

        return DebateResult(
            topic=self.topic,
            maker_model=self.maker.model,
            checker_model=self.checker.model,
            turns=self._turns,
            synthesis=synthesis,
            concluded_naturally=concluded_naturally,
            total_turns=len(self._turns),
        )

    # ------------------------------------------------------------------ #

    def _synthesize(self) -> str:
        transcript_lines = []
        for t in self._turns:
            transcript_lines.append(f"[Turn {t.turn_number} — MAKER]: {t.maker_response.message}")
            if t.maker_response.conceded_points:
                transcript_lines.append(f"  (MAKER conceded: {', '.join(t.maker_response.conceded_points)})")
            transcript_lines.append(f"[Turn {t.turn_number} — CHECKER]: {t.checker_response.message}")
            if t.checker_response.conceded_points:
                transcript_lines.append(f"  (CHECKER conceded: {', '.join(t.checker_response.conceded_points)})")

        transcript = "\n".join(transcript_lines)
        prompt = SYNTHESIS_PROMPT.format(topic=self.topic, transcript=transcript)

        # Try Groq first, fall back to OpenRouter
        providers = []
        if config.GROQ_API_KEY:
            providers.append((config.GROQ_API_BASE, config.GROQ_API_KEY, {}))
        if config.OPENROUTER_API_KEY:
            providers.append((config.OPENROUTER_API_BASE, config.OPENROUTER_API_KEY,
                               {"HTTP-Referer": "https://github.com/botroom", "X-Title": "botroom"}))

        last_exc: Exception | None = None
        for api_base, api_key, extra_headers in providers:
            try:
                with httpx.Client(timeout=config.REQUEST_TIMEOUT) as client:
                    resp = client.post(
                        f"{api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                            **extra_headers,
                        },
                        json={
                            "model": config.SYNTHESIS_MODEL,
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 1024,
                            "temperature": 0.3,
                        },
                    )
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                last_exc = e
                continue

        return f"[Synthesis unavailable: {last_exc}]\n\nLast MAKER position: {self._turns[-1].maker_response.conclusion_summary or self._turns[-1].maker_response.message}\n\nLast CHECKER position: {self._turns[-1].checker_response.conclusion_summary or self._turns[-1].checker_response.message}"
