import { appFetch } from "@/lib/api-client";

export function inventoryRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
