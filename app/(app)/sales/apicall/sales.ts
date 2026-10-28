import { appFetch } from "@/lib/api-client";

export function salesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
