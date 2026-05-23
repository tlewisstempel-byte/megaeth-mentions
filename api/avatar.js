function send(response, status, body) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.status(status).json(body);
}

function allowedAvatarUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["pbs.twimg.com", "unavatar.io"].includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
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

  const url = allowedAvatarUrl(request.body?.url);
  if (!url) {
    send(response, 400, { error: "Unsupported avatar URL." });
    return;
  }

  try {
    const avatarResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!avatarResponse.ok) throw new Error("Avatar request failed.");

    const contentType = avatarResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error("Avatar response was not an image.");

    const buffer = Buffer.from(await avatarResponse.arrayBuffer());
    send(response, 200, {
      dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
    });
  } catch {
    send(response, 502, { error: "Could not prepare avatar image." });
  }
};
