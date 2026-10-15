export function profileRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
