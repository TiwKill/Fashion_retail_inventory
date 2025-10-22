import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function brandToApiKey(brandName: string): string {
  // Convert brand names like "H&M" to "H_M" for API compatibility
  return brandName
    .replace(/&/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toUpperCase()
}
