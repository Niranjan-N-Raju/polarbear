export function storeConfigRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
