// ============================================
// In-Memory State Manager
//
// Menyimpan "posisi" setiap user di dalam flow
// Key: telegram_id (number)
// Value: UserFlowState object
//
// Analogi: seperti useState di React, tapi
// disimpan di server, bukan di browser.
//
// ⚠️ Data hilang kalau bot restart → ini OK
//    karena flow workout hanya butuh beberapa menit
// ============================================

export type FlowStep =
  | 'idle'
  | 'selecting_split'
  | 'selecting_exercise'
  | 'entering_weight'
  | 'entering_reps'
  | 'set_logged';

export interface UserFlowState {
  step: FlowStep;

  // Data session
  sessionId?: string;
  splitName?: string;

  // Data exercise yang sedang dilog
  exerciseId?: string;
  exerciseName?: string;
  sessionExerciseId?: string;

  // Data set yang sedang diinput
  pendingWeight?: number;       // weight sudah diinput, nunggu reps
  currentSetNumber?: number;    // set ke berapa untuk exercise ini

  // Tracking message untuk bisa di-edit
  flowMessageId?: number;
}

// ── Storage ───────────────────────────────────
// Map<telegram_id, state>
const states = new Map<number, UserFlowState>();

// ── Public API ────────────────────────────────

export function getFlowState(telegramId: number): UserFlowState {
  return states.get(telegramId) ?? { step: 'idle' };
}

export function setFlowState(telegramId: number, state: UserFlowState): void {
  states.set(telegramId, state);
}

// Update sebagian field saja (seperti setState di React)
export function updateFlowState(
  telegramId: number,
  update: Partial<UserFlowState>
): void {
  const current = getFlowState(telegramId);
  states.set(telegramId, { ...current, ...update });
}

export function clearFlowState(telegramId: number): void {
  states.delete(telegramId);
}

// Cek apakah user sedang nunggu input teks
export function isWaitingForInput(telegramId: number): boolean {
  const state = getFlowState(telegramId);
  return state.step === 'entering_weight' || state.step === 'entering_reps';
}