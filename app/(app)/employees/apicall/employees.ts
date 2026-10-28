import { appFetch } from "@/lib/api-client";

export function employeesRequest(input: RequestInfo | URL, init?: RequestInit) {
  return appFetch(input, init);
}
