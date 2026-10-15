export function storesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
