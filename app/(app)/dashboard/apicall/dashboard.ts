export function dashboardRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
