export function withdrawalsRequest(input: RequestInfo | URL, init?: RequestInit) {
  // Explicit no-store: GET results must always reflect the latest save, never a cached read.
  return fetch(input, { cache: "no-store", ...init });
}
