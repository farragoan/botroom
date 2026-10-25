export const DEFAULT_MAX_TURNS = 8;

/**
 * Sub-path the app is served under (e.g. "/botroom"), no trailing slash.
 * Comes from Vite's `base`, which is set from NEXT_PUBLIC_BASE_PATH at build time.
 * Use BASE for raw <a href>, <img src> and fetch() URLs that bypass react-router.
 */
export const BASE: string = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
export const API_BASE = `${BASE}/api`;

/** UI names for the two agents (wire protocol keeps MAKER / CHECKER). */
export const AGENT_LABEL = { MAKER: 'Analyst', CHECKER: 'Reviewer' } as const;
