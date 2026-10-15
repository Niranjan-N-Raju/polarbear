export function employeesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
