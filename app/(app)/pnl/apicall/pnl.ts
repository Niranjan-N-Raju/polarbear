export function pnlRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
