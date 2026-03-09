from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.text import Text
from rich.table import Table
from rich import box

from src.models import AgentResponse

console = Console()

ACTION_STYLE = {
    "CONTINUE":  ("◆ CONTINUE",  "dim"),
    "CONCLUDE":  ("✓ CONCLUDE",  "bold green"),
    "CONCEDE":   ("○ CONCEDE",   "yellow"),
}


class DebateDisplay:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    # ------------------------------------------------------------------ #

    def header(self, topic: str, maker_model: str, checker_model: str) -> None:
        console.print()
        console.rule("[bold white]botroom[/bold white]", style="white")

        table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
        table.add_column(style="dim")
        table.add_column()
        table.add_row("topic",   f"[bold]{topic}[/bold]")
        table.add_row("MAKER",   f"[cyan]{maker_model}[/cyan]")
        table.add_row("CHECKER", f"[magenta]{checker_model}[/magenta]")
        console.print(table)
        console.print()

    def turn_header(self, turn: int, max_turns: int) -> None:
        console.rule(
            f"[dim]Turn {turn} / {max_turns}[/dim]",
            style="dim",
        )

    def status(self, msg: str) -> None:
        console.print(f"  [dim italic]{msg}[/dim italic]")

    # ------------------------------------------------------------------ #

    def agent_message(
        self,
        name: str,
        model: str,
        response: AgentResponse,
        color: str,
    ) -> None:
        action_label, action_style = ACTION_STYLE.get(
            response.action, (response.action, "dim")
        )

        # Build panel content
        body = Text()
        body.append(response.message)

        if response.conceded_points:
            body.append("\n\nConceded: ", style="yellow")
            body.append(", ".join(response.conceded_points), style="yellow italic")

        if response.wants_to_conclude and response.conclusion_summary:
            body.append("\n\nFinal position: ", style="bold green")
            body.append(response.conclusion_summary, style="green")

        if self.verbose and response.thinking:
            body.append("\n\n[thinking] ", style="dim")
            body.append(response.thinking, style="dim italic")

        subtitle = f"[{action_style}]{action_label}[/{action_style}]  [dim]{model}[/dim]"

        console.print(
            Panel(
                body,
                title=f"[bold {color}]{name}[/bold {color}]",
                subtitle=subtitle,
                border_style=color,
                padding=(1, 2),
            )
        )
        console.print()

    # ------------------------------------------------------------------ #

    def synthesis(
        self,
        text: str,
        concluded_naturally: bool,
        total_turns: int,
    ) -> None:
        console.print()
        console.rule("[bold white]Synthesis[/bold white]", style="white")

        status_text = (
            "[bold green]Concluded naturally[/bold green]"
            if concluded_naturally
            else "[yellow]Max turns reached — partial synthesis[/yellow]"
        )
        console.print(f"  {status_text}  |  [dim]{total_turns} turn(s)[/dim]")
        console.print()

        console.print(
            Panel(
                text,
                title="[bold white]Result[/bold white]",
                border_style="white",
                padding=(1, 2),
            )
        )
        console.print()

    def error(self, msg: str) -> None:
        console.print(f"\n[bold red]Error:[/bold red] {msg}\n")
