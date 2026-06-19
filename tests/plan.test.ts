import { describe, expect, it } from "vitest";
import { assignScheduledDates, generatedPlanSchema, getWeekStartDate } from "@/domain/plan";
import { StubPlanGenerator } from "@/infrastructure/ai/StubPlanGenerator";
import {
  GeneratePlanUseCase,
  GetCurrentPlanUseCase,
} from "@/application/use-cases/PlanUseCases";
import { createUserId, type OnboardingProfile } from "@/domain/user";
import type { IOnboardingReader, IPlanRepository } from "@/application/ports/plan";
import type { GeneratedWorkoutDay } from "@/domain/plan";
import { isOk } from "@/domain/shared/result";

class MemoryPlanRepository implements IPlanRepository {
  private readonly plans = new Map<string, import("@/domain/plan").TrainingPlan>();

  async createGenerating(userId: string, weekStart: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.plans.set(id, {
      id,
      userId,
      status: "generating",
      weekStart,
      days: [],
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  }

  async markReady(planId: string, days: GeneratedWorkoutDay[], weekStart: string) {
    const plan = this.plans.get(planId);
    if (!plan) return;
    plan.status = "ready";
    plan.weekStart = weekStart;
    plan.days = assignScheduledDates(weekStart, days);
    plan.updatedAt = new Date().toISOString();
  }

  async markFailed(planId: string, message: string) {
    const plan = this.plans.get(planId);
    if (!plan) return;
    plan.status = "failed";
    plan.errorMessage = message;
  }

  async findCurrentByUserId(userId: string) {
    return [...this.plans.values()]
      .filter((plan) => plan.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  async findById(planId: string, userId: string) {
    const plan = this.plans.get(planId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  }

  async findDayById(planDayId: string, userId: string) {
    for (const plan of this.plans.values()) {
      if (plan.userId !== userId) continue;
      const day = plan.days.find((item) => item.id === planDayId);
      if (day) return { planId: plan.id, day, plan };
    }
    return null;
  }

  async deleteCurrentByUserId(userId: string) {
    const current = await this.findCurrentByUserId(userId);
    if (!current) return false;
    this.plans.delete(current.id);
    return true;
  }
}

class MemoryOnboardingReader implements IOnboardingReader {
  constructor(private readonly profile: OnboardingProfile) {}

  async findByUserId(userId: import("@/domain/user").UserId) {
    return this.profile.userId === userId ? this.profile : null;
  }
}

const completedProfile: OnboardingProfile = {
  userId: createUserId("user-1"),
  goals: [{ type: "fitness", description: "Build strength for hiking" }],
  fitnessLevel: "intermediate",
  equipment: ["Dumbbells", "Bodyweight only"],
  availableDays: [1, 3, 5],
  sessionMinutes: 45,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("plan domain", () => {
  it("validates generated plan schema", () => {
    const parsed = generatedPlanSchema.parse({
      weekStart: getWeekStartDate(),
      days: [
        {
          dayIndex: 0,
          title: "Monday strength",
          estimatedMinutes: 45,
          exercises: [{ name: "Squat", sets: 3, reps: "8-10" }],
        },
      ],
    });
    expect(parsed.days).toHaveLength(1);
  });
});

describe("GeneratePlanUseCase", () => {
  it("creates a generating plan and processes it to ready", async () => {
    const plans = new MemoryPlanRepository();
    const onboarding = new MemoryOnboardingReader(completedProfile);
    const generator = new StubPlanGenerator();
    const generate = new GeneratePlanUseCase(plans, onboarding, generator);
    const getCurrent = new GetCurrentPlanUseCase(plans);

    const created = await generate.execute({ userId: "user-1" });
    expect(isOk(created)).toBe(true);
    if (!isOk(created)) return;

    await generate.processJob(created.value.planId, "user-1");

    const current = await getCurrent.execute("user-1");
    expect(isOk(current)).toBe(true);
    if (!isOk(current) || !current.value) return;

    expect(current.value.status).toBe("ready");
    expect(current.value.days.length).toBeGreaterThan(0);
  });
});

describe("StubPlanGenerator", () => {
  it("builds workouts from onboarding profile", async () => {
    const generator = new StubPlanGenerator();
    const plan = await generator.generate(completedProfile);
    expect(plan.days.length).toBe(3);
  });
});
