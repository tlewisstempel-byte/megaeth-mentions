const form = document.querySelector("#scanForm");
const landingView = document.querySelector("#landingView");
const resultView = document.querySelector("#resultView");
const handleInput = document.querySelector("#handleInput");
const scanButton = document.querySelector("#scanButton");
const statusEl = document.querySelector("#status");
const cardMount = document.querySelector("#cardMount");
const resultEyebrow = document.querySelector("#resultEyebrow");
const resultTitle = document.querySelector("#resultTitle");
const resultCopy = document.querySelector("#resultCopy");
const resultControls = document.querySelector("#resultControls");
const qrtButton = document.querySelector("#qrtButton");
const shareButton = document.querySelector("#shareButton");
const downloadButton = document.querySelector("#downloadButton");
const topPost = document.querySelector("#topPost");
const topPostText = document.querySelector("#topPostText");
const topPostStats = document.querySelector("#topPostStats");

const STORAGE_KEY = "megaeth-mentions:last-result";
const SITE_URL = "https://www.megamentions.xyz";
const ORIGINAL_POST_URL = "";
let currentResult = null;

function showLandingView() {
  landingView.classList.add("is-active");
  resultView.classList.remove("is-active");
  topPost.hidden = true;
}

function showResultView() {
  landingView.classList.remove("is-active");
  resultView.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "auto" });
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function setStatus(message, mode = "") {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", mode === "error");
}

function avatarUrl(result) {
  const raw = result?.profile?.avatarUrl || `https://unavatar.io/twitter/${result?.handle || "megaeth"}`;
  return raw.replace("_normal.", "_400x400.");
}

function metricLabel(result) {
  return result?.totals?.viewCount > 0 ? "VIEWS GENERATED" : "VISIBLE INTERACTIONS";
}

function metricValue(result) {
  return result?.totals?.viewCount > 0 ? result.totals.viewCount : result?.totals?.visibleEngagement || 0;
}

function cardSvg(result) {
  const safeName = escapeHtml(result.profile?.name || result.handle);
  const safeHandle = escapeHtml(result.handle);
  const avatar = escapeHtml(avatarUrl(result));
  const main = compactNumber(result.mentionCount);
  const secondary = compactNumber(metricValue(result));
  const label = escapeHtml(result.label || "MegaETH poster");
  const first = formatDate(result.firstMention?.createdAt);
  const latest = formatDate(result.latestMention?.createdAt);
  const likes = compactNumber(result.totals?.likeCount);
  const reposts = compactNumber(result.totals?.repostCount);
  const replies = compactNumber(result.totals?.replyCount);
  const metric = metricLabel(result);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${main} MegaETH mentions for @${safeHandle}">
  <defs>
    <clipPath id="avatarClip"><circle cx="164" cy="164" r="70"/></clipPath>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b7ff2a" stop-opacity=".55"/>
      <stop offset=".46" stop-color="#f4f5ee" stop-opacity=".14"/>
      <stop offset="1" stop-color="#b7ff2a" stop-opacity=".22"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#050604"/>
  <path d="M0 0h1200v630H0z" fill="none" stroke="url(#edge)" stroke-width="2"/>
  <g opacity=".16">
    ${Array.from({ length: 25 }, (_, i) => `<path d="M${i * 48} 0v630" stroke="#f4f5ee" stroke-width="1"/>`).join("")}
    ${Array.from({ length: 14 }, (_, i) => `<path d="M0 ${i * 48}h1200" stroke="#f4f5ee" stroke-width="1"/>`).join("")}
  </g>
  <text x="72" y="72" fill="#b7ff2a" font-family="Space Mono, monospace" font-size="22" font-weight="700" letter-spacing="4">MEGAETH MENTIONS</text>

  <circle cx="164" cy="164" r="74" fill="none" stroke="#b7ff2a" stroke-width="3"/>
  <image href="${avatar}" x="94" y="94" width="140" height="140" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
  <text x="270" y="145" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900">${safeName}</text>
  <text x="270" y="190" fill="rgba(244,245,238,.62)" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">@${safeHandle}</text>

  <text x="72" y="410" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="178" font-weight="900">${main}</text>
  <text x="78" y="459" fill="#b7ff2a" font-family="Space Mono, monospace" font-size="23" font-weight="700" letter-spacing="7">MEGAETH MENTIONS</text>

  <path d="M672 118v354" stroke="rgba(244,245,238,.16)" stroke-width="1"/>
  <text x="754" y="190" fill="#b7ff2a" font-family="Space Mono, monospace" font-size="24" font-weight="700" letter-spacing="6">${label.toUpperCase()}</text>
  <text x="748" y="295" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="120" font-weight="900">${secondary}</text>
  <text x="754" y="344" fill="rgba(244,245,238,.68)" font-family="Space Mono, monospace" font-size="20" font-weight="700" letter-spacing="7">${metric}</text>

  <rect x="72" y="500" width="1056" height="78" fill="rgba(244,245,238,.035)" stroke="rgba(244,245,238,.16)"/>
  <text x="126" y="534" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900">${likes}</text>
  <text x="126" y="560" fill="rgba(244,245,238,.58)" font-family="Space Mono, monospace" font-size="12" font-weight="700" letter-spacing="2">LIKES</text>
  <text x="350" y="534" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900">${reposts}</text>
  <text x="350" y="560" fill="rgba(244,245,238,.58)" font-family="Space Mono, monospace" font-size="12" font-weight="700" letter-spacing="2">REPOSTS</text>
  <text x="574" y="534" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900">${replies}</text>
  <text x="574" y="560" fill="rgba(244,245,238,.58)" font-family="Space Mono, monospace" font-size="12" font-weight="700" letter-spacing="2">REPLIES</text>
  <text x="790" y="534" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900">${first}</text>
  <text x="790" y="560" fill="rgba(244,245,238,.58)" font-family="Space Mono, monospace" font-size="12" font-weight="700" letter-spacing="2">FIRST</text>
  <text x="980" y="534" fill="#f4f5ee" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900">${latest}</text>
  <text x="980" y="560" fill="rgba(244,245,238,.58)" font-family="Space Mono, monospace" font-size="12" font-weight="700" letter-spacing="2">LATEST</text>
</svg>`.trim();
}

function renderCard(result) {
  cardMount.innerHTML = cardSvg(result);
}

function renderLoadingCard(handle) {
  cardMount.innerHTML = `
    <div class="loading-card">
      <p class="eyebrow">Scanning @${escapeHtml(handle)}</p>
      <div class="loading-dots" aria-label="Loading">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p>Checking public posts from the last 12 months.</p>
    </div>
  `;
}

function renderTopPost(result) {
  const tweet = result.topTweets?.[0];
  topPost.hidden = !tweet;
  if (!tweet) {
    topPost.removeAttribute("href");
    topPostText.textContent = "";
    topPostStats.textContent = "";
    return;
  }

  topPost.href = tweet.url;
  topPostText.textContent = tweet.text;
  topPostStats.textContent = `${compactNumber(tweet.likeCount)} likes / ${compactNumber(tweet.repostCount)} reposts / ${compactNumber(tweet.replyCount)} replies / ${compactNumber(tweet.viewCount)} views`;
}

function applyResult(result) {
  currentResult = result;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  showResultView();
  renderCard(result);
  renderTopPost(result);

  const count = compactNumber(result.mentionCount);
  const noun = result.mentionCount === 1 ? "mention" : "mentions";
  resultEyebrow.textContent = "Result";
  resultTitle.textContent = `${count} MegaETH ${noun}`;
  resultCopy.textContent =
    result.mentionCount > 0
      ? `@${result.handle} has been posting in real time.`
      : `@${result.handle} has not mentioned MegaETH in the last 12 months.`;
  resultControls.hidden = false;
  qrtButton.disabled = !ORIGINAL_POST_URL;
  qrtButton.title = ORIGINAL_POST_URL ? "" : "Add the launch tweet URL in app.js after posting.";
  shareButton.disabled = false;
  downloadButton.disabled = false;
}

async function scan(handle) {
  showResultView();
  currentResult = null;
  renderLoadingCard(handle);
  renderTopPost({ topTweets: [] });
  resultControls.hidden = true;
  resultEyebrow.textContent = "Scanning";
  resultTitle.textContent = `Scanning @${handle}`;
  resultCopy.textContent = "Finding confirmed MegaETH mentions from the last 12 months.";
  setStatus("Scanning public posts");
  scanButton.disabled = true;
  scanButton.textContent = "Scanning";

  try {
    await new Promise((resolve) => setTimeout(resolve, 220));
    setStatus("Counting confirmed MegaETH mentions");
    resultCopy.textContent = "Counting confirmed MegaETH mentions.";
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(response.ok ? "The scan returned an unreadable response." : "The scan service is temporarily unavailable.");
    }
    if (!response.ok) throw new Error(data.error || response.statusText);
    setStatus("Building your card");
    resultCopy.textContent = "Building your card.";
    applyResult(data);
    setStatus(`Scan complete. ${data.mentionCount} confirmed MegaETH mentions found.`);
    history.replaceState(null, "", `/result/${data.handle}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    setStatus(message, "error");
    resultEyebrow.textContent = "Error";
    resultTitle.textContent = "Scan did not complete.";
    resultCopy.textContent = message;
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Check";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const handle = cleanHandle(handleInput.value);
  if (!handle) {
    setStatus("Enter a valid X handle.", "error");
    return;
  }
  handleInput.value = handle;
  scan(handle);
});

function resultShareText(result) {
  if (result.mentionCount > 0) {
    return `I mentioned MegaETH ${result.mentionCount} times in the last 12 months.\n\n${result.label}.\n\nCheck yours: ${SITE_URL}`;
  }

  return `Apparently I have mentioned MegaETH 0 times in the last 12 months.\n\n${result.label}.\n\nCheck yours: ${SITE_URL}`;
}

qrtButton.addEventListener("click", () => {
  if (!currentResult) return;
  if (!ORIGINAL_POST_URL) return;
  const text = `${resultShareText(currentResult)}\n\n${ORIGINAL_POST_URL}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
});

shareButton.addEventListener("click", () => {
  if (!currentResult) return;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(resultShareText(currentResult))}`,
    "_blank",
    "noopener,noreferrer"
  );
});

downloadButton.addEventListener("click", () => {
  if (!currentResult) return;
  const blob = new Blob([cardSvg(currentResult)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `megaeth-mentions-${currentResult.handle}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

function boot() {
  const routeHandle = cleanHandle(window.location.pathname.replace(/^\/result\//, ""));
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const result = JSON.parse(stored);
      if (routeHandle && routeHandle.toLowerCase() === result.handle?.toLowerCase()) {
        handleInput.value = result.handle || "";
        applyResult(result);
        return;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  if (routeHandle) {
    handleInput.value = routeHandle;
    scan(routeHandle);
  } else {
    showLandingView();
  }
}

boot();
