export function salaryRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
