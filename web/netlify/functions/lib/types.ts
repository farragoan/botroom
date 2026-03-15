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
}
