from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AgentResponse:
    thinking: str
    message: str
    action: str                          # CONTINUE | CONCLUDE | CONCEDE
    conceded_points: list[str] = field(default_factory=list)
    conclusion_summary: Optional[str] = None
    raw: str = ""                        # original LLM output, for debug

    @property
    def wants_to_conclude(self) -> bool:
        return self.action.upper() == "CONCLUDE"

    @property
    def is_conceding(self) -> bool:
        return self.action.upper() == "CONCEDE"


@dataclass
class Turn:
    turn_number: int
    maker_response: AgentResponse
    checker_response: AgentResponse


@dataclass
class DebateResult:
    topic: str
    maker_model: str
    checker_model: str
    turns: list[Turn]
    synthesis: str
    concluded_naturally: bool   # True = both CONCLUDEd, False = max_turns hit
    total_turns: int
