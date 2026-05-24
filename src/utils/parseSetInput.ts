// src/utils/parseSetInput.ts
// Utility untuk parsing format "80x6", "80 X 6", "80 x 6", dll.

export interface ParsedSet {
  weight: number;
  reps: number;
}

/**
 * parseSetInput
 *
 * Input  : "80x6" | "80 X 6" | "80x6" | "100 x 12"
 * Output : { weight: 80, reps: 6 } atau null kalau format salah
 */
export function parseSetInput(input: string): ParsedSet | null {
  // Trim + normalize spasi ganda
  const cleaned = input.trim().replace(/\s+/g, ' ');

  // Regex: angka (boleh desimal) + spasi opsional + x/X + spasi opsional + angka
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+)$/);
  if (!match) return null;

  const weight = parseFloat(match[1]);
  const reps   = parseInt(match[2], 10);

  // Validasi range
  if (isNaN(weight) || weight <= 0 || weight > 500) return null;
  if (isNaN(reps)   || reps   <= 0 || reps   > 200) return null;

  return { weight, reps };
}