export type FlowStep =
  | 'idle'
  | 'selecting_split'
  | 'selecting_exercise'
  | 'entering_weight'
  | 'entering_reps'
  | 'set_logged'
  | 'entering_custom_exercise'
  | 'entering_custom_split'
  | 'entering_weight_log'
  | 'managing_exercises'      // BARU: di menu ⚙️ Kelola Exercise
  | 'deleting_exercise';      // BARU: user pilih exercise yang mau dihapus

export interface UserFlowState {
  step: FlowStep;
  sessionId?: string;
  splitName?: string;
  exerciseId?: string;
  exerciseName?: string;
  sessionExerciseId?: string;
  pendingWeight?: number;
  currentSetNumber?: number;
  flowMessageId?: number;
}

const states = new Map<number, UserFlowState>();

export function getFlowState(telegramId: number): UserFlowState {
  return states.get(telegramId) ?? { step: 'idle' };
}

export function setFlowState(telegramId: number, state: UserFlowState): void {
  states.set(telegramId, state);
}

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

export function isWaitingForInput(telegramId: number): boolean {
  const { step } = getFlowState(telegramId);
  return (
    step === 'entering_weight' ||
    step === 'entering_reps' ||
    step === 'entering_custom_exercise' ||
    step === 'entering_custom_split' ||
    step === 'entering_weight_log'
  );
}