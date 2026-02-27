import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the current date/time in KST (Asia/Seoul).
 * Returns a Date object adjusted so that its local methods (getFullYear, getMonth, etc.)
 * return KST values regardless of the user's browser timezone.
 */
export function nowKST(): Date {
  const now = new Date();
  // KST is UTC+9
  const kstOffset = 9 * 60; // minutes
  const localOffset = now.getTimezoneOffset(); // minutes (negative for east of UTC)
  const diff = (kstOffset + localOffset) * 60 * 1000;
  return new Date(now.getTime() + diff);
}

/**
 * Convert any Date or ISO string to a Date whose local methods return KST values.
 */
export function toKST(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  const kstOffset = 9 * 60;
  const localOffset = d.getTimezoneOffset();
  const diff = (kstOffset + localOffset) * 60 * 1000;
  return new Date(d.getTime() + diff);
}

/**
 * Check if two dates are the same day in KST.
 */
export function isSameDayKST(a: Date | string, b: Date | string): boolean {
  const ka = toKST(a);
  const kb = toKST(b);
  return ka.getFullYear() === kb.getFullYear() && ka.getMonth() === kb.getMonth() && ka.getDate() === kb.getDate();
}

/**
 * Get today's date string in KST as YYYY-MM-DD.
 */
export function todayKSTString(): string {
  const k = nowKST();
  return `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
}
