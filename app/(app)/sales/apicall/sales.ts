export function salesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
