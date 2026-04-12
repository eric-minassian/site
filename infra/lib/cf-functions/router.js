import cf from "cloudfront";

var kvsHandle = cf.kvs();

// eslint-disable-next-line no-unused-vars
async function handler(event) {
  var request = event.request;
  var host = (request.headers.host && request.headers.host.value) || "";
  var username;

  // Extract username from subdomain (e.g. alice.sitename.app -> alice)
  var parts = host.split(".");
  if (parts.length >= 3) {
    username = parts[0];
  } else {
    // Custom domain — look up mapping in KVS
    try {
      username = await kvsHandle.get("domain:" + host);
    } catch (e) {
      return {
        statusCode: 404,
        statusDescription: "Not Found",
        headers: { "content-type": { value: "text/html" } },
        body: { encoding: "text", data: "<h1>Site not found</h1>" },
      };
    }
  }

  // Check if site is suspended
  try {
    await kvsHandle.get("suspended:" + username);
    return {
      statusCode: 451,
      statusDescription: "Unavailable For Legal Reasons",
      headers: { "content-type": { value: "text/html" } },
      body: {
        encoding: "text",
        data: "<h1>This site has been suspended</h1>",
      },
    };
  } catch (e) {
    // Key not found — site is not suspended, continue
  }

  // Rewrite path for S3 origin
  var uri = request.uri;
  if (uri === "/" || uri === "") {
    request.uri = "/" + username + "/index.html";
  } else {
    request.uri = "/" + username + uri;
  }

  return request;
}
