import type { SearchResult } from '../types.js';

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

/**
 * Search the web via the Tavily API.
 * Requires TAVILY_API_KEY to be available in the calling environment.
 */
export async function webSearch(
  query: string,
  apiKey: string,
  options: TavilySearchOptions = {},
): Promise<SearchResult[]> {
  const { maxResults = 3, searchDepth = 'basic' } = options;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TavilyResponse;

  return (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
  }));
}

/** Format search results into a compact string for injection into agent context. */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No results found.';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`)
    .join('\n\n');
}
