/** Web search for the agent: Brave (preferred) or Wikipedia / DuckDuckGo fallback. */

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchProvider = "brave" | "wikipedia" | "duckduckgo";

export interface WebSearchOutcome {
  ok: boolean;
  provider: WebSearchProvider;
  results: WebSearchHit[];
  error?: string;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;
const MAX_SNIPPET = 280;
const USER_AGENT = "ChatGPA/0.1 (educational assistant; +https://github.com/chatgpa)";

export function clampSearchLimit(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw)));
}

function truncate(text: string, max = MAX_SNIPPET): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function formatHits(hits: WebSearchHit[]): string {
  if (hits.length === 0) return "(brak wyników)";
  return hits
    .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`)
    .join("\n\n");
}

export function formatWebSearchOutput(
  provider: string,
  query: string,
  hits: WebSearchHit[],
): string {
  return `Wyszukiwanie (${provider}): "${query}"\n\n${formatHits(hits)}`;
}

async function searchBrave(query: string, limit: number, apiKey: string): Promise<WebSearchHit[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("search_lang", "pl");
  url.searchParams.set("country", "PL");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brave Search HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const data = await res.json() as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  const results = data.web?.results ?? [];
  return results
    .filter((r) => typeof r.title === "string" && typeof r.url === "string")
    .slice(0, limit)
    .map((r) => ({
      title: truncate(r.title!, 120),
      url: r.url!,
      snippet: truncate(r.description ?? ""),
    }));
}

type DdgTopic = {
  Text?: string;
  FirstURL?: string;
  Topics?: DdgTopic[];
};

function flattenDdgTopics(topics: DdgTopic[] | undefined, out: WebSearchHit[], limit: number) {
  if (!topics) return;
  for (const t of topics) {
    if (out.length >= limit) return;
    if (t.Topics?.length) {
      flattenDdgTopics(t.Topics, out, limit);
      continue;
    }
    if (!t.Text || !t.FirstURL) continue;
    const dash = t.Text.indexOf(" - ");
    const title = dash > 0 ? t.Text.slice(0, dash) : t.Text;
    const snippet = dash > 0 ? t.Text.slice(dash + 3) : t.Text;
    out.push({
      title: truncate(title, 120),
      url: t.FirstURL,
      snippet: truncate(snippet),
    });
  }
}

async function searchDuckDuckGo(query: string, limit: number): Promise<WebSearchHit[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo HTTP ${res.status}`);
  }

  const data = await res.json() as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    Answer?: string;
    RelatedTopics?: DdgTopic[];
    Results?: Array<{ Text?: string; FirstURL?: string }>;
  };

  const hits: WebSearchHit[] = [];

  if (data.AbstractText && data.AbstractURL) {
    hits.push({
      title: truncate(data.Heading || query, 120),
      url: data.AbstractURL,
      snippet: truncate(data.AbstractText),
    });
  } else if (data.Answer) {
    hits.push({
      title: truncate(query, 120),
      url: data.AbstractURL || "https://duckduckgo.com/",
      snippet: truncate(data.Answer),
    });
  }

  for (const r of data.Results ?? []) {
    if (hits.length >= limit) break;
    if (!r.Text || !r.FirstURL) continue;
    hits.push({
      title: truncate(r.Text, 120),
      url: r.FirstURL,
      snippet: truncate(r.Text),
    });
  }

  flattenDdgTopics(data.RelatedTopics, hits, limit);
  return hits.slice(0, limit);
}

async function wikiSummary(lang: string, title: string): Promise<string> {
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return "";
  const data = await res.json() as { extract?: string };
  return typeof data.extract === "string" ? data.extract : "";
}

async function searchWikipedia(query: string, limit: number): Promise<WebSearchHit[]> {
  const langs = ["pl", "en"] as const;
  for (const lang of langs) {
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "opensearch");
    url.searchParams.set("search", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("namespace", "0");
    url.searchParams.set("format", "json");

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) continue;

    const data = await res.json() as [string, string[], string[], string[]];
    const titles = data[1] ?? [];
    const urls = data[3] ?? [];
    if (titles.length === 0) continue;

    const top = titles.slice(0, limit);
    const extracts = await Promise.all(
      top.map((title) => wikiSummary(lang, title).catch(() => "")),
    );

    return top.map((title, i) => ({
      title: truncate(title, 120),
      url: urls[i] ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      snippet: truncate(extracts[i] || `(Wikipedia ${lang}) ${title}`),
    }));
  }
  return [];
}

/**
 * Search the web. Uses Brave when BRAVE_SEARCH_API_KEY is set;
 * otherwise Wikipedia (pl/en) with DuckDuckGo Instant Answer as a secondary fallback.
 */
export async function webSearch(
  query: string,
  limit: number = DEFAULT_LIMIT,
  env: { braveApiKey?: string } = {},
): Promise<WebSearchOutcome> {
  const q = query.trim();
  if (!q) {
    return { ok: false, provider: "wikipedia", results: [], error: "Brak query" };
  }

  const capped = clampSearchLimit(limit);
  const braveKey = env.braveApiKey?.trim() || Deno.env.get("BRAVE_SEARCH_API_KEY")?.trim();

  if (braveKey) {
    try {
      const results = await searchBrave(q, capped, braveKey);
      return { ok: true, provider: "brave", results };
    } catch (err) {
      try {
        const wiki = await searchWikipedia(q, capped);
        if (wiki.length > 0) return { ok: true, provider: "wikipedia", results: wiki };
      } catch {
        // ignore
      }
      return {
        ok: false,
        provider: "brave",
        results: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  try {
    const wiki = await searchWikipedia(q, capped);
    if (wiki.length > 0) {
      return { ok: true, provider: "wikipedia", results: wiki };
    }
  } catch {
    // try DuckDuckGo below
  }

  try {
    const results = await searchDuckDuckGo(q, capped);
    if (results.length > 0) {
      return { ok: true, provider: "duckduckgo", results };
    }
  } catch (err) {
    return {
      ok: false,
      provider: "duckduckgo",
      results: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    ok: false,
    provider: "wikipedia",
    results: [],
    error:
      "Brak wyników. Ustaw BRAVE_SEARCH_API_KEY (https://brave.com/search/api/) dla pełnego wyszukiwania sieci.",
  };
}
