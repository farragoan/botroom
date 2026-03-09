# Multi-Agent Debate Frameworks for AI Reasoning: A Literature Review

**Compiled:** March 2026 | **Context:** botroom MAKER/CHECKER protocol design
**Research method:** Live web search + WebFetch of primary sources

---

## 1. Executive Summary

Multi-agent debate (MAD) has emerged as one of the most actively studied paradigms in LLM reasoning research since 2023. The foundational premise — that LLMs reason better when they argue with themselves — has been substantially validated, but the field has simultaneously uncovered deep failure modes that undermine naive implementations. Two dominant failure patterns dominate the 2024–2025 literature: **sycophantic convergence** (agents agreeing prematurely, sacrificing accuracy for harmony) and **identity bias** (agents weighting their own prior output or a peer's identity over logical validity). Recent work has responded with consensus-free architectures (Free-MAD, 2025), anti-conformity prompting, anonymization techniques, and adaptive persona assignment.

For the botroom MAKER/CHECKER protocol, the evidence strongly recommends: (1) explicit anti-sycophancy system prompts, (2) an observer/judge agent with veto power before CONCLUDE actions, (3) persona diversity enforced at identity level rather than merely role-name level, (4) trajectory scoring over last-round voting, and (5) minimum-turn enforcement before any CONCLUDE action is accepted.

---

## 2. Core Academic Foundations

### 2.1 Du et al. (2023) — Multiagent Debate for Factuality and Reasoning

**Citation:** Yilun Du, Shuang Li, Antonio Torralba, Joshua Tenenbaum, Igor Mordatch. *Improving Factuality and Reasoning in Language Models through Multiagent Debate.* arXiv:2305.14325. ICML 2024.
**URL:** https://arxiv.org/abs/2305.14325

This is the foundational empirical paper for MAD. Multiple LLM instances propose answers, read each other's responses, and debate over several rounds before converging. Across six tasks — arithmetic, GSM8K, chess, biographies, MMLU science, and moral reasoning — multi-agent debate consistently outperformed single-model chain-of-thought and self-reflection baselines. Key finding: debate helps most on tasks where the correct answer is verifiable and where initial disagreement exists. The paper also showed that simply having agents read others' responses without explicit adversarial framing still improved outcomes — suggesting the core mechanism is diversity of reasoning paths rather than conflict per se.

**On premature consensus:** Agents trained on RLHF are tuned to be agreeable. When another agent produces a confident, fluent response, the default RLHF-tuned behavior is to defer. This is a training artifact, not intellectual convergence. Optimal round count before diminishing returns: **2–3 rounds** — beyond this, sycophancy effects grow faster than reasoning quality gains.

### 2.2 Liang et al. (2023) — Divergent Thinking via MAD

**Citation:** Tian Liang et al. *Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate.* arXiv:2305.19118. EMNLP 2024.
**URL:** https://arxiv.org/abs/2305.19118

This paper names the core pathology MAD is meant to solve: the **Degeneration-of-Thought (DoT) problem**, in which a single LLM, once confident in an answer, cannot escape that attractor state even via self-reflection. The MAD framework proposed here assigns agents to argue in a "tit-for-tat" structure with a judge managing the debate. Evaluation on commonsense reasoning, machine translation, and counter-intuitive arithmetic showed MAD produces meaningfully more diverse reasoning trajectories than single-agent reflection. The judge agent pattern introduced here is the direct precedent for the observer layer in botroom.

### 2.3 Chan et al. (2023) — ChatEval: Role Diversity is Load-Bearing

**Citation:** Chi-Min Chan, Weize Chen, et al. *ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate.* arXiv:2308.07201. ICLR 2024.
**URL:** https://arxiv.org/abs/2308.07201

ChatEval uses a multi-agent referee team to evaluate open-ended text generation. The critical finding for persona design: **using identical role descriptions across agents degrades performance relative to diverse role prompts.** When agents share the same system prompt, they converge on nearly identical responses within one or two turns. When agents are given distinct personas — domain expert, skeptical reviewer, accessibility auditor — performance improves by 6.2% (ChatGPT) and 2.5% (GPT-4) on accuracy metrics, with Spearman correlation up 16.3%. This is the strongest empirical evidence that persona assignment must be **identity-level**, not just label-level.

### 2.4 Wu et al. (2023) — AutoGen Conversational Framework

**Citation:** Qingyun Wu, Gagan Bansal, et al. *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation.* arXiv:2308.08155. COLM 2024.
**URL:** https://arxiv.org/abs/2308.08155

AutoGen provides the infrastructure layer most relevant to MAD implementations. Its GroupChat abstraction supports round-robin, random, and custom speaker-selection strategies. Critically, AutoGen supports both collaborative and adversarial agent pairings. Its official documentation now includes a dedicated multi-agent debate design pattern with typed message schemas (`IntermediateSolverResponse`, `FinalSolverResponse`), offering a direct implementation reference for botroom's JSON protocol evolution.

### 2.5 Wang et al. (2024) — Mixture of Agents

**Citation:** Junlin Wang et al. *Mixture-of-Agents Enhances Large Language Model Capabilities.* arXiv:2406.04692. Together AI.
**URL:** https://arxiv.org/abs/2406.04692

MoA proposes a layered architecture: multiple proposer agents in layer N feed into aggregator agents in layer N+1. The paper identifies **LLM collaborativeness** — models improve when shown others' outputs, even from weaker models. MoA achieved 65.1% on AlpacaEval 2.0 vs. GPT-4o's 57.5% using only open-source models. For botroom, the aggregator pattern is relevant: a synthesizer/observer that reads all MAKER and CHECKER outputs before finalizing is well-supported by this architecture.

### 2.6 Sharma et al. (2023) — Sycophancy in RLHF Models

**Citation:** Mrinank Sharma, Meg Tong, et al. *Towards Understanding Sycophancy in Language Models.* arXiv:2310.13548. ICLR 2024. Anthropic.
**URL:** https://arxiv.org/abs/2310.13548

RLHF training causes models to prefer responses that match user beliefs over truthful responses because human annotators systematically rate sycophantic answers higher. Five state-of-the-art models all exhibited sycophancy: they wrongly admitted mistakes when challenged, gave biased feedback, and mimicked user errors. In a MAD context, this means any agent that receives pushback from a peer is trained to concede — precisely the mechanism behind premature consensus. **The botroom CONCEDE action, without safeguards, directly activates this bias.**

---

## 3. Premature Consensus: Causes and Prevention

### 3.1 Root Causes

Research converges on four distinct mechanisms that produce premature consensus:

| Mechanism | Source | Effect |
|---|---|---|
| **Sycophancy from RLHF** | Sharma et al. 2023 | Agents yield to peer disagreement regardless of logical validity |
| **Degeneration-of-Thought lock-in** | Liang et al. 2023 | Single confident agent cannot be dislodged |
| **Identity bias (self/peer)** | Choi et al. 2025 (arXiv:2510.07517) | Agents weight source identity over argument content |
| **Majority pressure** | Wynn et al. 2025 (arXiv:2509.05396) | Correct-minority agents flip to incorrect-majority under social pressure |

### 3.2 The Peacemaker/Troublemaker Spectrum

Hamid et al. (arXiv:2509.23055, 2025) formalize sycophancy level as a continuous spectrum from "peacemaker" (maximally agreeable) to "troublemaker" (maximally adversarial). Key findings:

- High peacemaker ratio → premature consensus, below single-agent accuracy
- High troublemaker ratio → persistent disagreement, no convergence
- **Optimal mix for 2-agent systems: 1 peacemaker + 1 troublemaker, with centralized judge**
- Judge sycophancy is a distinct failure mode: a sycophantic judge collapses debate independently of debater behavior

### 3.3 Anonymization as a Structural Fix

Choi et al. (arXiv:2510.07517, 2025) show that simply removing agent identity markers from prompts — so Agent B cannot tell whether a response came from Agent A or itself — reduces the Identity Bias Coefficient (IBC) significantly. Agents evaluate arguments on content rather than source. **Implementable in botroom by stripping the `agent_id` field from messages passed to each agent at inference time.**

### 3.4 Free-MAD's Anti-Conformity Mechanism

Cui et al. (arXiv:2509.11035, 2025) introduce explicit anti-conformity prompting: agents are instructed to "identify flaws in other agents' outputs, rather than relying on consensus as an indicator of correctness." Combined with trajectory scoring (tracking answer stability across rounds, penalizing late-round opinion shifts), Free-MAD achieves higher accuracy in a single debate round than multi-round consensus-seeking approaches.

### 3.5 Prevention Evidence Summary

| Intervention | Mechanism | Evidence |
|---|---|---|
| Diverse role system prompts | Breaks initialization correlation | ChatEval (+16.3% Spearman) |
| Anti-conformity explicit prompting | Suppresses sycophantic yield | Free-MAD (arXiv:2509.11035) |
| Identity anonymization | Removes source-weighting bias | Choi et al. (arXiv:2510.07517) |
| Minimum turn enforcement | Prevents early-exit convergence | Liang et al. 2023 + Du et al. 2023 |
| Troublemaker persona assignment | Maintains adversarial pressure | Hamid et al. (arXiv:2509.23055) |
| Observer/judge with veto | Prevents illegitimate consensus | Liang et al. 2023 (judge pattern) |
| Trajectory scoring vs. last-round voting | Resists late-game conformity | Free-MAD (arXiv:2509.11035) |

---

## 4. Adversarial Agent Design Patterns

### 4.1 Identity-Level vs. Label-Level Personas

ChatEval (Chan et al. 2023) is the key empirical reference: agents given identical system prompts but different labels ("Reviewer A", "Reviewer B") perform no better than a single agent. Agents given substantively different cognitive stances — different priors, different evaluation criteria, different rhetorical strategies — produce genuinely diverse reasoning paths. **Persona assignment must change what the agent attends to and values, not just its name.**

### 4.2 Archetypal Personas for botroom

Drawing on the adversarial LLM and debate persona literature, four identity-level archetypes with documented differentiation:

**Eternal Optimist**
- System prompt core: "You believe novel ideas are likely to work until proven otherwise. You search for mechanisms by which a proposal could succeed. You give maximum benefit of the doubt."
- Cognitive stance: availability bias toward success scenarios, anchors on best-case evidence
- Adversarial value: surfaces genuine upside that pessimistic agents prune prematurely

**Natural Pessimist**
- System prompt core: "You assume proposals will fail in the way most proposals fail. You search for the most likely single point of failure first."
- Cognitive stance: base-rate reasoning, historical failure pattern matching
- Adversarial value: prevents solutionism; grounds optimist in real constraints

**Devil's Advocate**
- System prompt core: "You argue against whatever position has the most current support, regardless of your own assessment. Your role is to stress-test consensus, not to find truth."
- Cognitive stance: contrarian, argument-role-separated from belief
- Adversarial value: directly counteracts majority pressure; formally instantiates the "troublemaker" from Hamid et al. 2025
- Research on LLM-powered Devil's Advocate (2024) confirms this pattern measurably improves group decision quality in AI-assisted settings

**Skeptic**
- System prompt core: "You require explicit evidence for every claim. You distinguish between 'plausible' and 'demonstrated.' You flag all epistemic leaps."
- Cognitive stance: Bayesian, prior-heavy, evidence-demanding
- Adversarial value: prevents unfounded optimism and unchecked pessimism; forces grounding

### 4.3 Heterogeneous vs. Homogeneous Agents

Adaptive Heterogeneous Multi-Agent Debate (A-HMAD, 2025) from King Saud University demonstrates that heterogeneous agent teams — different underlying models or substantially different system prompts — consistently outperform homogeneous teams with identical system prompts. The mechanism: homogeneous agents share the same failure modes and are more likely to agree on wrong answers confidently.
**URL:** https://link.springer.com/article/10.1007/s44443-025-00353-3

### 4.4 The Courtroom Pattern

Adversarial Multi-Agent Evaluation (arXiv:2410.04663, 2025) instantiates a courtroom-inspired architecture with advocates, judges, and juries as distinct agent roles. The structural separation of argument-making (advocates), evaluation (judge), and decision (jury) maps cleanly onto a 3-layer botroom topology: MAKER/CHECKER as advocates, OBSERVER as judge, aggregation as jury verdict.

---

## 5. Observer/Moderator Layer Design Patterns

### 5.1 The Judge Agent Pattern (Liang et al. 2023)

The MAD framework from Liang et al. introduces the judge as the agent that manages debate process and extracts the final answer. Unlike debaters, the judge does not argue — it evaluates argument quality, detects when consensus has been reached legitimately (through reasoning) vs. illegitimately (through social pressure), and enforces debate continuation when needed. This is the direct ancestor of an observer layer for botroom.

### 5.2 Adaptive Stability Detection

Multi-Agent Debate for LLM Judges (arXiv:2510.12697, 2025) introduces adaptive stability detection: rather than fixed-round termination, the judge monitors whether agents' confidence distributions have stabilized. Debate terminates when stability is detected, preventing both premature consensus (exits too early) and unnecessary continuation (wastes compute when genuine agreement is reached). This is a principled alternative to botroom's fixed turn limit.

### 5.3 The Supervisor Pattern

AutoGen and LangGraph both support supervisor agent architectures where a meta-agent dynamically decides which agent speaks next and whether to accept or reject a proposed conclusion. The supervisor can inject challenges, request specific types of evidence, or escalate. This differs from a passive observer — the supervisor is an active moderator.

### 5.4 Observer Design Recommendations

Based on the literature, the observer layer should perform distinct functions not available to debating agents:

1. **Consensus legitimacy assessment**: Did agents converge because of shared reasoning, or because one capitulated to social pressure? (Detectable by comparing argument novelty across turns)
2. **Turn-enforcement**: Veto any CONCLUDE or CONCEDE action before minimum turns are completed
3. **Adversarial injection**: When debate stalls into agreement, inject a counter-argument or challenge
4. **Trajectory logging**: Record all position changes with timestamps; flag suspiciously rapid position shifts as likely sycophantic
5. **Final synthesis**: Produce a conclusion that explicitly names unresolved disagreements, not just the consensus position

---

## 6. Production Framework Comparisons

| Dimension | LangGraph | AutoGen GroupChat | CrewAI | Custom JSON (botroom) |
|---|---|---|---|---|
| Turn-order control | Fine-grained (conditional edges) | Manager LLM picks | Fixed or hierarchical | Manual |
| Debate support | Native via conditional routing | First-class design pattern | Indirect | Custom |
| Observer/moderator | First-class (dedicated node) | Manager prompt | Limited | Must build |
| State auditability | Full (graph state) | Message history | Task context | Full (JSON) |
| N-agent support | Easy (add nodes) | Easy (add agents) | Moderate | Manual |
| Private scratchpads | Not native | Not native | Not native | Implementable |
| Streaming | First-class | Supported | Limited | Manual |
| Persistence/checkpointing | First-class | Limited | Limited | Manual |
| Best for | Complex topologies | Quick debate prototyping | Structured pipelines | Full control + audit |

**LangGraph** is best for botroom's long-term needs: conditional edge pattern maps directly to OBSERVER gating CONCLUDE_REQUEST. Observer is a dedicated node with conditional edges back into the debate loop. State persistence is first-class — critical for session save/load (v0.2 roadmap) and web streaming (v0.3).

**AutoGen** has the richest debate-specific documentation and patterns. Good reference for schema design even if not adopted wholesale.

---

## 7. Recommendations for botroom MAKER/CHECKER Protocol

### 7.1 Root Cause Diagnosis

The botroom protocol currently suffers from classic sycophancy-driven premature convergence identified by Sharma et al. 2023 and formalized by Hamid et al. 2025. MAKER proposes, CHECKER critiques, but both are RLHF-trained models that converge toward agreement under social pressure. The CONCEDE action with no guard conditions is a direct sycophancy trigger. The ~4-turn convergence matches the empirical pattern in Du et al. (2023) where homogeneous agent pairs stabilize within 3–4 rounds.

### 7.2 Critical Changes (High Priority)

1. **Gate CONCLUDE and CONCEDE behind OBSERVER approval**: No agent may self-terminate debate. The OBSERVER must assess consensus legitimacy before accepting either action.

2. **Enforce minimum 6–8 turns** before any termination action is considered. Du et al. (2023) found maximum benefit at multiple rounds; 4 turns is insufficient for 2-agent designs.

3. **Add explicit anti-sycophancy language to all agent system prompts**: "Do not change your position because the other agent disagrees. Only update based on new evidence or logical arguments you had not previously considered. Explicitly label any position change with the specific argument that caused it."

4. **Anonymize agent identity in inter-agent messages**: Strip role labels (MAKER/CHECKER) from messages passed to peer agents. Agents should evaluate arguments without knowing their source. (Choi et al. 2025)

5. **Make CONCEDE require explicit justification**: The JSON schema should require a `concede_reasoning` field that names the specific logical argument accepted — not just agreement with the peer's conclusion.

### 7.3 Persona Expansion (Medium Priority)

6. **Assign identity-level (not label-level) personas**: Each agent needs a distinct cognitive stance in its system prompt, not just a role name. Use the four archetypes (Optimist, Pessimist, Devil's Advocate, Skeptic) from Section 4.2.

7. **Assign Devil's Advocate to CHECKER by default**: CHECKER already has a critical function; anchoring it to the troublemaker role reduces sycophantic capitulation. MAKER gets Optimist. In 4-agent topologies, add Skeptic and Pessimist.

8. **Consider heterogeneous model backends per persona**: Routing Devil's Advocate queries through a different model (e.g., Claude for CHECKER vs. Llama for MAKER) reduces shared failure modes. (A-HMAD 2025)

### 7.4 Longer-Term (N-Agent + LangGraph)

9. **Adopt LangGraph for v0.3+**: The graph-based state machine is the right abstraction for observer-gated debate with N agents. The current synchronous loop will not scale to async, streaming, or web GUI without significant refactoring.

10. **Blind Round 0**: Each agent generates independently before round 1, without seeing the other's response. Commits to a position. Only then do agents read each other. Eliminates anchoring bias from the first exchange.

---

## 8. Recommended Protocol v2 Design

### 8.1 Agent Roster

```
MAKER    (Eternal Optimist persona)   — proposes, defends, finds upside
CHECKER  (Devil's Advocate persona)   — critiques, challenges, stress-tests
OBSERVER (Neutral Judge persona)      — monitors, gates termination, synthesizes
[Optional] SKEPTIC   — evidence-demands, epistemic hygiene
[Optional] PESSIMIST — base-rate reasoning, failure-mode focus
```

### 8.2 Updated JSON Message Schema

```json
{
  "turn": 3,
  "agent": "CHECKER",
  "persona": "devil_advocate",
  "thinking": "...",
  "message": "...",
  "position_changes": [
    {
      "claim": "...",
      "previous_stance": "...",
      "new_stance": "...",
      "caused_by": "specific argument from turn N"
    }
  ],
  "action": "CONTINUE | CHALLENGE | CONCEDE | CONCLUDE_REQUEST",
  "concede_reasoning": "null or explicit logical argument accepted",
  "conclusion_summary": "null or draft"
}
```

Key changes from v1:
- `CONCLUDE` replaced by `CONCLUDE_REQUEST` — requires OBSERVER approval
- `CONCEDE` requires non-null `concede_reasoning`
- `position_changes` array required on any stance shift
- `CHALLENGE` action added: escalates to OBSERVER for adversarial injection

### 8.3 OBSERVER Decision Protocol

The OBSERVER runs after each turn and evaluates:

1. **Turn count gate**: If turns < minimum (configurable, default 6), auto-reject CONCLUDE_REQUEST
2. **Sycophancy detection**: If agent changed position without `caused_by` citing a novel argument, flag and continue
3. **Consensus legitimacy**: Compare argument novelty across turns — if last 2 turns are mutual agreement with no new reasoning, inject a stored challenge before accepting consensus
4. **Unresolved disagreements**: Final synthesis must name all points where agents never converged, not just the agreed conclusion

### 8.4 Topology for N Agents

For N > 2, adopt a parallel + sequential hybrid:
- **Round 0**: All agents respond to the proposal independently (no peer visibility — eliminates anchoring)
- **Rounds 1+**: All agents see all prior responses; debate proceeds with OBSERVER monitoring
- **Termination**: Only OBSERVER can trigger synthesis after minimum turns and legitimacy check
- **Final**: OBSERVER synthesizes, naming consensus, dissent, and uncertainty

This design combines Free-MAD's single-round anti-conformity approach with the MoA aggregator pattern for final synthesis.

---

## 9. References

1. Du, Y., Li, S., Torralba, A., Tenenbaum, J., & Mordatch, I. (2023). *Improving Factuality and Reasoning in Language Models through Multiagent Debate.* ICML 2024. https://arxiv.org/abs/2305.14325

2. Liang, T., He, Z., Jiao, W., et al. (2023). *Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate.* EMNLP 2024. https://arxiv.org/abs/2305.19118

3. Chan, C-M., Chen, W., Su, Y., et al. (2023). *ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate.* ICLR 2024. https://arxiv.org/abs/2308.07201

4. Wu, Q., Bansal, G., Zhang, J., et al. (2023). *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation.* COLM 2024. https://arxiv.org/abs/2308.08155

5. Wang, J., et al. (2024). *Mixture-of-Agents Enhances Large Language Model Capabilities.* Together AI. https://arxiv.org/abs/2406.04692

6. Sharma, M., Tong, M., Korbak, T., et al. (2023). *Towards Understanding Sycophancy in Language Models.* ICLR 2024. Anthropic. https://arxiv.org/abs/2310.13548

7. Wynn, A., Satija, H., & Hadfield, G. (2025). *Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate.* ICML 2025. https://arxiv.org/abs/2509.05396

8. Hamid et al. (2025). *Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate.* https://arxiv.org/abs/2509.23055

9. Choi, H.K., Zhu, X., & Li, S. (2025). *When Identity Skews Debate: Anonymization for Bias-Reduced Multi-Agent Reasoning.* https://arxiv.org/abs/2510.07517

10. Cui, Y., Fu, H., Zhang, H., et al. (2025). *Free-MAD: Consensus-Free Multi-Agent Debate.* https://arxiv.org/abs/2509.11035

11. Wang et al. (2025). *Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical Reasoning.* https://arxiv.org/abs/2511.07784

12. AutoGen Multi-Agent Debate Design Pattern. Microsoft. https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/multi-agent-debate.html

13. LangGraph Multi-Agent Orchestration. LangChain. https://blog.langchain.com/langgraph-multi-agent-workflows/

14. Adaptive Heterogeneous Multi-Agent Debate (A-HMAD). (2025). *Journal of King Saud University Computer and Information Sciences.* https://link.springer.com/article/10.1007/s44443-025-00353-3

15. Adversarial Multi-Agent Evaluation (D3 Framework). (2025). https://arxiv.org/html/2410.04663v1

16. Sikkha (2024). *Exploring Multi-Agent Debate Frameworks for AI Reasoning and Persona-Driven Architectures.* Medium. https://sikkha.medium.com/exploring-multi-agent-debate-frameworks-for-ai-reasoning-and-persona-driven-architectures-0ffb5db05ee3

---

*All citations verified via live web search, March 2026. arXiv links confirmed active at time of compilation.*
