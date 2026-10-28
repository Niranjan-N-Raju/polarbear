import { appFetch } from "@/lib/api-client";

export function usersRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
