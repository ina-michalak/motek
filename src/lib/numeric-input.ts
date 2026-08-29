import type { KeyboardEvent } from "react";

const BLOCKED_NUMBER_KEYS = new Set(["-", "+", "e", "E"]);

export function blockInvalidNumberKey(e: KeyboardEvent<HTMLInputElement>) {
  if (BLOCKED_NUMBER_KEYS.has(e.key)) {
    e.preventDefault();
  }
}

export function sanitizeNonNegativeNumberInput(value: string): string {
  return value.replace(/[eE+-]/g, "");
}
