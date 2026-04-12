import { tokenToKeyHash } from "./crypto";
import { getSiteByKeyHash } from "./db";
import { error } from "./response";
import type { ApiResponse, LambdaUrlEvent, Site } from "./types";

const TOKEN_RE = /^[a-f0-9]{64}$/;

export async function authenticate(
  event: LambdaUrlEvent,
): Promise<Site | ApiResponse> {
  const header = event.headers["authorization"];
  if (!header) {
    return error(401, "Missing Authorization header");
  }

  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!TOKEN_RE.test(token)) {
    return error(401, "Invalid token format");
  }

  const keyHash = tokenToKeyHash(token);
  const site = await getSiteByKeyHash(keyHash);

  if (!site) {
    return error(401, "Invalid credentials");
  }

  return site;
}

export function isError(result: Site | ApiResponse): result is ApiResponse {
  return "statusCode" in result;
}
