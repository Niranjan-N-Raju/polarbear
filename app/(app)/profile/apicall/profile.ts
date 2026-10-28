import { appFetch } from "@/lib/api-client";

export function profileRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
