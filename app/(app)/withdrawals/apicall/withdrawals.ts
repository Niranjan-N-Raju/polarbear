import { appFetch } from "@/lib/api-client";

export function withdrawalsRequest(input: RequestInfo | URL, init?: RequestInit) {
  // Explicit no-store: GET results must always reflect the latest save, never a cached read.
  return appFetch(input, { cache: "no-store", ...init });
}
