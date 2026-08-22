const port = Number.parseInt(process.argv[2] ?? "", 10);
const mode = process.argv[3];

if (!Number.isInteger(port) || port < 1 || mode === undefined) {
  throw new Error("Usage: node smoke.mjs <loopback-port> <loopback|surface>");
}

const baseUrl = `http://127.0.0.1:${port}`;

async function request(path) {
  return fetch(`${baseUrl}${path}`);
}

async function assertBookmarkResponse(response) {
  if (!response.ok) throw new Error(`Expected bookmark response, got ${response.status}`);
  const body = await response.json();
  if (body.bookmarks?.[0]?.id !== "bookmark-1")
    throw new Error("The bookmark response did not contain bookmark-1.");
}

if (mode === "loopback") {
  await assertBookmarkResponse(await request("/bookmarks"));
} else if (mode === "surface") {
  await assertBookmarkResponse(await request("/bookmarks"));
  const nonBookmark = await request("/users");
  if (nonBookmark.status !== 404)
    throw new Error(`Non-bookmark surface returned ${nonBookmark.status}.`);
} else {
  throw new Error(`Unknown smoke mode ${mode}.`);
}
