export function inventoryRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
