// ============================================
// Shared TypeScript interfaces
// Updated: WorkoutLog punya field baru
// ============================================

export interface User {
  id?: string;
  telegram_id: number;
  username: string | null;
  created_at?: string;
}

export interface WeightLog {
  id?: string;
  telegram_id: number;
  weight: number;
  logged_at?: string;
}

export interface WorkoutLog {
  id?: string;
  telegram_id: number;
  workout_type: string;
  duration?: number | null;       // menit, opsional
  intensity?: string | null;      // 'low' | 'medium' | 'high', opsional
  notes?: string | null;          // catatan bebas, opsional
  logged_at?: string;
}

// Shape untuk weight progress comparison
export interface WeightProgress {
  latest: WeightLog | null;
  previous: WeightLog | null;
  diff: number | null;            // positif = naik, negatif = turun
  trend: 'up' | 'down' | 'same' | 'none';
}

export interface UserStats {
  latestWeight: number | null;
  weeklyWorkouts: number;
  totalWorkouts: number;
  weightProgress: WeightProgress;
}