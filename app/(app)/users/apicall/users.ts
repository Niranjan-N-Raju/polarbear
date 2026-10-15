export function usersRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init);
}
