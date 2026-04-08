export type AgentRole = 'MAKER' | 'CHECKER';
export type DebateAction = 'CONTINUE' | 'CONCLUDE' | 'CONCEDE';

export interface AgentResponse {
  thinking: string;
  message: string;
  action: DebateAction;
  conceded_points: string[];
  conclusion_summary: string | null;
}

export interface Turn {
  turnNumber: number;
  agent: AgentRole;
  response: AgentResponse;
}

export interface DebateConfig {
  topic: string;
  makerModel: string;
  checkerModel: string;
  maxTurns: number;
  verbose: boolean;
  /** When true, MAKER is asked one clarifying question before Turn 1. Default false. */
  allowClarification?: boolean;
  /**
   * Minimum turns before CONCLUDE/CONCEDE is permitted.
   * Observer overrides early termination back to CONTINUE.
   * Default 0 (disabled). Recommended: 6.
   */
  minTurnsBeforeConclusion?: number;
  /** When true, agents may call the Tavily web-search tool (requires TAVILY_API_KEY env). */
  enableWebSearch?: boolean;
}

/** A tool-use request emitted by an agent mid-turn. Never surfaces to the orchestrator. */
export interface ToolUseRequest {
  tool: 'web_search';
  query: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}
