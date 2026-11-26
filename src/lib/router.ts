import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
export const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash || "#/senior/dashboard");
export const go = (hash: string) => {
  window.location.hash = hash;
};
export interface Route {
  area: "senior" | "exec" | "tech";
  page: string;
  param?: string;
}
export function parse(hash: string): Route {
  const [, area, page = "", param] = hash.replace(/^#/, "").split("/");
  if (area === "exec") return { area, page: page || "dashboard" };
  if (area === "tech") return { area, page: page || "home" };
  return { area: "senior", page: page || "dashboard", param };
}
