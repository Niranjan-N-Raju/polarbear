import { describe, it, expect } from "vitest";
import { validateCsrf } from "@/lib/csrf";
import { NextRequest } from "next/server";

function makeRequest(
  method: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/test"), {
    method,
    headers: { host: "localhost:3000", ...headers },
  });
}

describe("validateCsrf", () => {
  it("allows GET requests without validation", () => {
    const req = makeRequest("GET");
    expect(validateCsrf(req)).toBeNull();
  });

  it("blocks POST without origin or referer", () => {
    const req = makeRequest("POST");
    const result = validateCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("allows POST with matching origin", () => {
    const req = makeRequest("POST", { origin: "http://localhost:3000" });
    expect(validateCsrf(req)).toBeNull();
  });

  it("blocks POST with mismatched origin", () => {
    const req = makeRequest("POST", { origin: "http://evil.com" });
    const result = validateCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("allows POST with matching referer when origin absent", () => {
    const req = makeRequest("POST", {
      referer: "http://localhost:3000/page",
    });
    expect(validateCsrf(req)).toBeNull();
  });

  it("blocks POST with mismatched referer", () => {
    const req = makeRequest("POST", {
      referer: "http://evil.com/page",
    });
    const result = validateCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
