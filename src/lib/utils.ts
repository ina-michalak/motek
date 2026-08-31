import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Yarn } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isYarnExhausted(yarn: Pick<Yarn, "quantity_skeins" | "quantity_grams">): boolean {
  const definedQuantities = [yarn.quantity_skeins, yarn.quantity_grams].filter(
    (quantity): quantity is number => quantity !== null,
  );
  return definedQuantities.length > 0 && definedQuantities.every((quantity) => quantity === 0);
}
