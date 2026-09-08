import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** Insensible aux accents/casse — même logique que la recherche de métiers (onboarding). */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}
