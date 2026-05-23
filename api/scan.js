const BASE_URL = "https://api.twitterapi.io";
const fs = require("fs");
const path = require("path");

const STRONG_QUERY = '(megaeth OR "mega eth" OR @megaeth_labs OR @megaeth OR "#megaeth")';
const MAX_WINDOWS = 18;
const MAX_SEARCH_REQUESTS = 90;
const WINDOW_RESULT_CAP = 18;
const MIN_WINDOW_SECONDS = 6 * 60 * 60;

function send(response, status, body) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.status(status).json(body);
}

function localEnvToken() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const contents = fs.readFileSync(envPath, "utf8");
    const line = contents.split(/\r?\n/).find((entry) => /^TWITTER_API(_TOKEN)?=/.test(entry));
    if (!line) return "";
    return line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}

function cleanHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0]
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 15);
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function confirmedMegaEthMention(text) {
  const value = String(text || "");
  return /\bmega[\s-]?eth\b/i.test(value) || /@megaeth(_labs)?\b/i.test(value) || /#megaeth\b/i.test(value);
}

function monthWindows() {
  const windows = [];
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);

  let cursor = new Date(start);
  while (cursor < end && windows.length < MAX_WINDOWS) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    windows.push({
      start: Math.floor(cursor.getTime() / 1000),
      end: Math.floor(Math.min(next.getTime(), end.getTime()) / 1000),
    });
    cursor = next;
  }

  return windows;
}

async function apiGet(pathname, params, token) {
  const url = new URL(pathname, BASE_URL);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`twitterapi.io returned a non-JSON response (${response.status}).`);
  }
  if (!response.ok || data.status === "error") {
    throw new Error(data.msg || data.message || text || response.statusText);
  }
  return data;
}

function unwrapUser(payload) {
  return payload?.data ?? payload?.user ?? payload;
}

function unwrapTweets(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tweets)) return payload.tweets;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function hasMoreResults(payload) {
  return Boolean(payload?.has_next_page || payload?.hasNextPage || payload?.has_more || payload?.hasMore);
}

function normalizeTweet(tweet, handle) {
  const author = tweet.author || {};
  const id = String(tweet.id || tweet.tweetId || tweet.rest_id || "");
  const text = String(tweet.text || tweet.fullText || tweet.content || "");
  const likeCount = toNumber(tweet.likeCount || tweet.likes);
  const repostCount = toNumber(tweet.retweetCount || tweet.retweets || tweet.reposts || tweet.retweet_count);
  const replyCount = toNumber(tweet.replyCount || tweet.replies);
  const quoteCount = toNumber(tweet.quoteCount || tweet.quotes);
  const viewCount = toNumber(tweet.viewCount || tweet.views);
  const createdAt = tweet.createdAt || tweet.created_at || "";
  return {
    id,
    url: tweet.url || (id ? `https://x.com/${handle}/status/${id}` : `https://x.com/${handle}`),
    text,
    createdAt,
    timestamp: Date.parse(createdAt) || 0,
    likeCount,
    repostCount,
    replyCount,
    quoteCount,
    viewCount,
    engagement: likeCount + repostCount + replyCount + quoteCount,
    author: {
      userName: author.userName || handle,
      name: author.name || handle,
      profilePicture: author.profilePicture || "",
      isBlueVerified: Boolean(author.isBlueVerified || author.verified || author.verifiedType),
    },
  };
}

function rankLabel(count, viewCount = 0) {
  if (count > 20 && viewCount > 10000) return "mega sexy";
  if (count > 15) return "megapilled";
  if (count > 10) return "kindamega";
  if (count >= 5) return "notmega";
  return "probably a monad fan";
}

async function searchWindow(handle, window, token, state) {
  state.searchRequests += 1;
  const payload = await apiGet(
    "/twitter/tweet/advanced_search",
    {
      query: `from:${handle} ${STRONG_QUERY} -filter:retweets since_time:${window.start} until_time:${window.end}`,
      queryType: "Latest",
    },
    token
  );

  const tweets = unwrapTweets(payload);
  const duration = window.end - window.start;
  const mightBeCapped = tweets.length >= WINDOW_RESULT_CAP || hasMoreResults(payload);

  if (mightBeCapped && duration > MIN_WINDOW_SECONDS && state.searchRequests < MAX_SEARCH_REQUESTS) {
    const midpoint = Math.floor(window.start + duration / 2);
    const [older, newer] = await Promise.all([
      searchWindow(handle, { start: window.start, end: midpoint }, token, state),
      searchWindow(handle, { start: midpoint, end: window.end }, token, state),
    ]);
    return [...older, ...newer];
  }

  return tweets;
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    send(response, 405, { error: "Method not allowed" });
    return;
  }

  const token = String(
    process.env.TWITTER_API_TOKEN ||
      process.env.TWITTER_API ||
      process.env.TWITTERAPI_IO_KEY ||
      localEnvToken() ||
      ""
  ).trim();
  const handle = cleanHandle(request.body?.handle);

  if (!handle) {
    send(response, 400, { error: "Enter a valid X handle." });
    return;
  }

  if (!token) {
    send(response, 400, { error: "TWITTER_API_TOKEN is not configured." });
    return;
  }

  try {
    const searchState = { searchRequests: 0 };
    const [profilePayload, searchResults] = await Promise.all([
      apiGet("/twitter/user/info", { userName: handle }, token),
      Promise.all(monthWindows().map((window) => searchWindow(handle, window, token, searchState))),
    ]);

    const tweetsById = new Map();
    for (const results of searchResults) {
      for (const raw of results) {
        const tweet = normalizeTweet(raw, handle);
        if (!tweet.id || !confirmedMegaEthMention(tweet.text)) continue;
        tweetsById.set(tweet.id, tweet);
      }
    }

    const user = unwrapUser(profilePayload) || {};
    const tweets = [...tweetsById.values()].sort((a, b) => b.timestamp - a.timestamp);
    const oldest = tweets.length ? tweets[tweets.length - 1] : null;
    const latest = tweets.length ? tweets[0] : null;
    const topTweets = [...tweets]
      .sort((a, b) => b.viewCount - a.viewCount || b.engagement - a.engagement)
      .slice(0, 5);
    const totals = tweets.reduce(
      (acc, tweet) => {
        acc.likeCount += tweet.likeCount;
        acc.repostCount += tweet.repostCount;
        acc.replyCount += tweet.replyCount;
        acc.quoteCount += tweet.quoteCount;
        acc.viewCount += tweet.viewCount;
        acc.visibleEngagement += tweet.engagement;
        return acc;
      },
      { likeCount: 0, repostCount: 0, replyCount: 0, quoteCount: 0, viewCount: 0, visibleEngagement: 0 }
    );
    const label = rankLabel(tweets.length, totals.viewCount);

    send(response, 200, {
      scannedAt: new Date().toISOString(),
      handle,
      profile: {
        handle,
        name: user.name || topTweets[0]?.author?.name || handle,
        avatarUrl:
          user.profilePicture ||
          user.profile_image_url_https ||
          topTweets[0]?.author?.profilePicture ||
          `https://unavatar.io/twitter/${handle}`,
        verified: Boolean(user.verified || user.isBlueVerified || user.verifiedType || topTweets[0]?.author?.isBlueVerified),
        followers: toNumber(user.followers || user.followersCount || user.follower_count),
      },
      mentionCount: tweets.length,
      label,
      totals,
      firstMention: oldest,
      latestMention: latest,
      searchedTerms: ["megaeth", "mega eth", "@megaeth_labs", "@megaeth", "#megaeth"],
    });
  } catch (error) {
    send(response, 500, {
      error: error instanceof Error ? error.message : "Scan failed.",
    });
  }
};
