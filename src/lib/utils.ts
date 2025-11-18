import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get date in IST timezone (UTC+5:30)
 * @param daysOffset - Number of days to offset from today (0 = today, 1 = tomorrow, etc.)
 * @returns Date string in YYYY-MM-DD format based on IST timezone
 */
export function getISTDate(daysOffset: number = 0): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const date = new Date(Date.now() + IST_OFFSET + (daysOffset * 86400000));
  return date.toISOString().split('T')[0];
}
