import type { H3Event } from "h3";

export type KeyFunction = (event: H3Event) => Promise<string>;
export let keys: KeyFunction[] = [keyByIP];

export async function keyByIP(event: H3Event): Promise<string> {
  const forwarded = event.node.req.headers["x-forwarded-for"];

  if (!forwarded) {
    console.warn("Could not determine IP address.");
    return "::";
  }

  if (Array.isArray(forwarded)) {
    console.warn("Multiple forwarded headers.");
    return forwarded[0];
  }

  return forwarded;
}

export function useKeyFunctions(...fns: KeyFunction[]) {
  keys = fns;
}

export function useKeyFunction(fn: KeyFunction) {
  keys = [fn];
}
