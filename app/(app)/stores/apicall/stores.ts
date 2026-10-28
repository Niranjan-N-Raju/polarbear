import { appFetch } from "@/lib/api-client";

export function storesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
