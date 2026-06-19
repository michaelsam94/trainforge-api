import { describe, expect, it } from "vitest";
import { toWeekPlanDto } from "@/presentation/dto/weekPlan";
import { SyncOfflineWorkoutsUseCase } from "@/application/use-cases/WorkoutUseCases";
import type { IPlanRepository } from "@/application/ports/plan";
import type { IWorkoutRepository } from "@/application/ports/workout";
import {
  CompleteWorkoutUseCase,
  LogWorkoutUseCase,
} from "@/application/use-cases/WorkoutUseCases";
import type { TrainingPlan, WorkoutDay } from "@/domain/plan";
import type { WorkoutLog } from "@/domain/workout";
import { isOk } from "@/domain/shared/result";

describe("toWeekPlanDto", () => {
  it("returns a slim week payload without audit fields", () => {
    const dto = toWeekPlanDto({
      id: "plan-1",
      userId: "user-1",
      status: "ready",
      weekStart: "2026-06-16",
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z",
      days: [
        {
          id: "day-1",
          dayIndex: 0,
          scheduledDate: "2026-06-16",
          title: "Strength",
          estimatedMinutes: 45,
          exercises: [{ id: "ex-1", name: "Squat", sets: 3, reps: "8" }],
        },
      ],
    });

    expect(dto.days[0]?.exercises[0]?.name).toBe("Squat");
    expect(dto).not.toHaveProperty("createdAt");
    expect(dto.days[0]).not.toHaveProperty("focus");
  });
});

class MemoryWorkoutRepository implements IWorkoutRepository {
  private logs = new Map<string, WorkoutLog>();

  async findByIdempotencyKey(): Promise<WorkoutLog | null> {
    return null;
  }

  async findActiveByPlanDay(_userId: string, planDayId: string): Promise<WorkoutLog | null> {
    for (const log of this.logs.values()) {
      if (log.planDayId === planDayId && log.status === "in_progress") return log;
    }
    return null;
  }

  async findById(workoutLogId: string): Promise<WorkoutLog | null> {
    return this.logs.get(workoutLogId) ?? null;
  }

  async logSet(input: import("@/domain/workout").LogSetInput, planId: string): Promise<WorkoutLog> {
    const existing = await this.findActiveByPlanDay(input.userId, input.planDayId);
    const now = new Date().toISOString();
    const workout =
      existing ??
      ({
        id: crypto.randomUUID(),
        userId: input.userId,
        planId,
        planDayId: input.planDayId,
        status: "in_progress",
        startedAt: now,
        sets: [],
      } satisfies WorkoutLog);

    workout.sets.push({
      id: crypto.randomUUID(),
      workoutLogId: workout.id,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      completed: true,
      loggedAt: now,
    });
    this.logs.set(workout.id, workout);
    return workout;
  }

  async completeWorkout(input: import("@/domain/workout").CompleteWorkoutInput): Promise<WorkoutLog> {
    const workout = this.logs.get(input.workoutLogId);
    if (!workout) throw new Error("missing workout");
    workout.status = "completed";
    workout.difficultyRating = input.difficultyRating;
    workout.completedAt = new Date().toISOString();
    return workout;
  }

  async countCompletedSince(): Promise<number> {
    return 0;
  }
}

class MemoryPlanRepository implements IPlanRepository {
  constructor(private readonly day: WorkoutDay) {}

  async createGenerating() {
    return { id: "plan-1" };
  }

  async markReady() {
    return;
  }

  async markFailed() {
    return;
  }

  async findCurrentByUserId() {
    return null;
  }

  async findById() {
    return null;
  }

  async findDayById(planDayId: string, userId: string) {
    if (planDayId !== this.day.id) return null;
    const plan: TrainingPlan = {
      id: "plan-1",
      userId,
      status: "ready",
      weekStart: "2026-06-16",
      days: [this.day],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { planId: plan.id, day: this.day, plan };
  }
}

describe("SyncOfflineWorkoutsUseCase", () => {
  it("replays queued log and complete entries", async () => {
    const day: WorkoutDay = {
      id: "day-1",
      dayIndex: 0,
      scheduledDate: "2026-06-19",
      title: "Strength",
      estimatedMinutes: 45,
      exercises: [{ id: "ex-1", name: "Squat", sets: 3, reps: "8" }],
    };

    const workouts = new MemoryWorkoutRepository();
    const plans = new MemoryPlanRepository(day);
    const logWorkout = new LogWorkoutUseCase(workouts, plans);
    const completeWorkout = new CompleteWorkoutUseCase(workouts);
    const sync = new SyncOfflineWorkoutsUseCase(logWorkout, completeWorkout);

    const result = await sync.execute("user-1", [
      {
        clientId: "c1",
        kind: "log_set",
        payload: {
          planDayId: "day-1",
          exerciseId: "ex-1",
          setNumber: 1,
          reps: 8,
          idempotencyKey: "offline-log-1",
        },
      },
      {
        clientId: "c2",
        kind: "complete_workout",
        payload: {
          workoutLogId: "",
          difficultyRating: 3,
          idempotencyKey: "offline-complete-1",
        },
      },
    ]);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.results.every((item) => item.ok)).toBe(true);
  });
});
