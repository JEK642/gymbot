// src/state/userFlowState.ts

export type FlowStep =
  | 'idle'
  | 'selecting_split'
  | 'selecting_exercise'
  | 'entering_set'
  | 'set_logged'
  | 'entering_custom_exercise'
  | 'entering_custom_split'
  | 'entering_weight_log'
  | 'managing_exercises'
  | 'deleting_exercise';

export interface UserFlowState {
  step: FlowStep;
  sessionId?: string;
  splitName?: string;
  exerciseId?: string;
  exerciseName?: string;
  sessionExerciseId?: string;
  currentSetNumber?: number;
  flowMessageId?: number;

  // PHASE 3: last set memory — untuk repeat system
  lastWeight?: number;
  lastReps?: number;

  // PHASE 3: session start time snapshot (untuk elapsed time tanpa DB call)
  sessionStartedAt?: string;
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
    step === 'entering_set'
    || step === 'entering_custom_exercise'
    || step === 'entering_custom_split'
    || step === 'entering_weight_log'
  );
}