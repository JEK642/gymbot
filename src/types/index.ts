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

export interface Split {
  id: string;
  name: string;                  // contoh: "Push Pull Legs"
  description?: string;
  is_default: boolean;           // true = bawaan sistem
  created_by?: string;           // telegram_id jika custom
}

export interface MovementPattern {
  id: string;
  name: string;                  // contoh: "Horizontal Push"
  description?: string;
  is_default: boolean;
  created_by?: string;
}

export interface MuscleGroup {
  id: string;
  name: string;                  // contoh: "Chest", "Triceps"
  body_region: string;           // contoh: "Upper Body"
  is_default: boolean;
  created_by?: string;
}

export interface Exercise {
  id: string;
  name: string;                  // contoh: "Bench Press"
  movement_pattern_id?: string;
  equipment?: string;            // contoh: "Barbell", "Dumbbell"
  is_bilateral: boolean;         // true = dua sisi bersamaan
  is_default: boolean;
  created_by?: string;
}

// Exercise dengan relasi yang sudah di-join
// Dipakai ketika butuh info lengkap (tampil ke user)
export interface ExerciseWithDetails extends Exercise {
  movement_pattern?: MovementPattern;
  muscles?: ExerciseMuscle[];
}

export interface ExerciseMuscle {
  exercise_id: string;
  muscle_group_id: string;
  role: 'primary' | 'secondary';  // otot utama atau pendukung
  muscle_group?: MuscleGroup;
}

// ------------------------------------------------------------
// WORKOUT SESSION
// Satu sesi latihan dari mulai sampai selesai
// ------------------------------------------------------------

export type SessionStatus = 'in_progress' | 'completed' | 'cancelled';

export interface WorkoutSession {
  id: string;
  telegram_id: string;
  split_id?: string;             // optional, user mungkin tidak pakai split
  name?: string;                 // contoh: "Push Day Senin"
  started_at: string;
  finished_at?: string;
  duration_minutes?: number;
  notes?: string;
  status: SessionStatus;
}

// Session dengan semua data turunannya (untuk summary/status)
export interface WorkoutSessionWithDetails extends WorkoutSession {
  split?: Split;
  exercises?: SessionExerciseWithSets[];
}

// ------------------------------------------------------------
// SESSION EXERCISE
// Exercise yang dilakukan dalam sebuah session
// ------------------------------------------------------------

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;        // urutan exercise dalam session
  notes?: string;
}

export interface SessionExerciseWithSets extends SessionExercise {
  exercise?: Exercise;
  sets?: ExerciseSet[];
}

// ------------------------------------------------------------
// EXERCISE SET
// Satu set dari satu exercise (misal: bench press 60kg x 8)
// ------------------------------------------------------------

export type SetType = 'working' | 'warmup' | 'dropset' | 'failure';

export interface ExerciseSet {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight_kg?: number;            // bisa null untuk bodyweight
  reps?: number;                 // bisa null untuk time-based
  duration_seconds?: number;     // untuk plank, dll
  rpe?: number;                  // Rate of Perceived Exertion (1-10)
  set_type: SetType;
  is_pr: boolean;                // apakah ini Personal Record baru?
}

// ------------------------------------------------------------
// PERSONAL RECORD
// Catatan rekor terbaik per exercise per user
// ------------------------------------------------------------

export interface PersonalRecord {
  id: string;
  telegram_id: string;
  exercise_id: string;
  session_id: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;         // dihitung pakai Epley Formula
  achieved_at: string;
  exercise?: Exercise;           // joined data
}

// ------------------------------------------------------------
// HELPER TYPES
// Untuk input command dan return value service
// ------------------------------------------------------------

// Input dari command /log bench press 60 8
export interface LogSetInput {
  telegram_id: string;
  exercise_name: string;         // raw input dari user, perlu dicari di DB
  weight_kg: number;
  reps: number;
  set_type?: SetType;            // default: 'working'
  rpe?: number;
}

// Input dari command /session start push
export interface StartSessionInput {
  telegram_id: string;
  split_name?: string;           // optional
  session_name?: string;         // optional custom name
}

// Hasil dari proses log set (dikembalikan ke command handler)
export interface LogSetResult {
  set: ExerciseSet;
  exercise: Exercise;
  setNumber: number;             // urutan set ke-berapa untuk exercise ini
  isPR: boolean;
  newPR?: PersonalRecord;        // ada isinya kalau isPR = true
  previousPR?: PersonalRecord;   // PR sebelumnya untuk perbandingan
}