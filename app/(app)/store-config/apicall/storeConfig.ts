import { appFetch } from "@/lib/api-client";

export function storeConfigRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
