import { appFetch } from "@/lib/api-client";

export function dashboardRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
