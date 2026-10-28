import { appFetch } from "@/lib/api-client";

export function attendanceRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
