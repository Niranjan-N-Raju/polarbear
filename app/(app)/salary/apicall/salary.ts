import { appFetch } from "@/lib/api-client";

export function salaryRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
