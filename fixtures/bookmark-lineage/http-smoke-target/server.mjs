import { createServer } from "node:http";

const requestedPort = Number.parseInt(process.env.SAH_HTTP_PORT ?? "0", 10);
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/bookmarks") {
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        bookmarks: [
          {
            id: "bookmark-1",
            title: "SAH",
            url: "https://sah.dev",
          },
        ],
      }),
    );
    return;
  }

  response.statusCode = 404;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end("not found\n");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
server.listen(requestedPort, "127.0.0.1", () => {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    process.stderr.write("The HTTP fixture did not receive a bound address.\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`READY ${address.address}:${address.port}\n`);
});
