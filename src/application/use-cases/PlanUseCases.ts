import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { getWeekStartDate, type TrainingPlan } from "@/domain/plan";
import { buildCatalogPlan, type ManualPlanMode } from "@/domain/plan/CatalogPlanBuilder";
import {
  pickBodyPartsForCatalog,
  pickBodyPartsForManual,
  resolveDifficultyFilters,
  resolveLocationFilter,
} from "@/domain/plan/exercisePlanFilters";
import { createUserId, isOnboardingComplete } from "@/domain/user";
import type { IExerciseRepository } from "@/application/ports/exercise";
import type { ILLMPlanGenerator, IOnboardingReader, IPlanRepository } from "@/application/ports/plan";

export type GeneratePlanInput = {
  userId: string;
};

export type GeneratePlanResult = {
  planId: string;
  status: TrainingPlan["status"];
};

export class GeneratePlanUseCase {
  constructor(
    private readonly plans: IPlanRepository,
    private readonly onboarding: IOnboardingReader,
    private readonly generator: ILLMPlanGenerator,
  ) {}

  async execute(input: GeneratePlanInput): Promise<Result<GeneratePlanResult, DomainError>> {
    const profile = await this.onboarding.findByUserId(createUserId(input.userId));
    if (!profile || !isOnboardingComplete(profile)) {
      return err(DomainError.validation("Complete onboarding before generating a plan"));
    }

    const current = await this.plans.findCurrentByUserId(input.userId);
    if (current?.status === "generating") {
      return ok({ planId: current.id, status: current.status });
    }

    const weekStart = getWeekStartDate();
    const { id } = await this.plans.createGenerating(input.userId, weekStart);

    return ok({ planId: id, status: "generating" });
  }

  async processJob(planId: string, userId: string): Promise<Result<void, DomainError>> {
    const profile = await this.onboarding.findByUserId(createUserId(userId));
    if (!profile || !isOnboardingComplete(profile)) {
      await this.plans.markFailed(planId, "Onboarding profile missing");
      return err(DomainError.validation("Onboarding profile missing"));
    }

    try {
      const generated = await this.generator.generate(profile);
      await this.plans.markReady(planId, generated.days, generated.weekStart);
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Plan generation failed";
      await this.plans.markFailed(planId, message);
      return err(DomainError.validation(message));
    }
  }
}

export type BuildManualPlanInput = {
  userId: string;
  mode: ManualPlanMode;
  bodyParts?: string[];
};

export type BuildManualPlanResult = {
  planId: string;
  status: TrainingPlan["status"];
};

export class BuildManualPlanUseCase {
  constructor(
    private readonly plans: IPlanRepository,
    private readonly onboarding: IOnboardingReader,
    private readonly exercises: IExerciseRepository,
  ) {}

  async execute(input: BuildManualPlanInput): Promise<Result<BuildManualPlanResult, DomainError>> {
    const profile = await this.onboarding.findByUserId(createUserId(input.userId));
    if (!profile || !isOnboardingComplete(profile)) {
      return err(DomainError.validation("Complete onboarding before building a plan"));
    }

    const current = await this.plans.findCurrentByUserId(input.userId);
    if (current?.status === "generating") {
      return ok({ planId: current.id, status: current.status });
    }

    const sortedDays = [...profile.availableDays].sort((a, b) => a - b);
    const dayCount = sortedDays.length || 1;
    const categories =
      input.mode === "body_parts"
        ? pickBodyPartsForManual(input.bodyParts ?? [], dayCount)
        : pickBodyPartsForCatalog(dayCount);

    const weekStart = getWeekStartDate();
    const exercisesByBodyPart = await this.exercises.sampleByCategories({
      categories,
      location: resolveLocationFilter(profile.equipment),
      difficulties: resolveDifficultyFilters(profile.fitnessLevel),
      perCategory: 6,
      seed: `${input.userId}:${weekStart}`,
    });

    const generated = buildCatalogPlan({
      profile,
      mode: input.mode,
      bodyParts: input.bodyParts,
      exercisesByBodyPart,
    });

    const { id } = await this.plans.createGenerating(input.userId, weekStart);
    await this.plans.markReady(id, generated.days, generated.weekStart);

    return ok({ planId: id, status: "ready" });
  }
}

export class GetCurrentPlanUseCase {
  constructor(private readonly plans: IPlanRepository) {}

  async execute(userId: string): Promise<Result<TrainingPlan | null, DomainError>> {
    const plan = await this.plans.findCurrentByUserId(userId);
    return ok(plan);
  }
}

export class GetPlanByIdUseCase {
  constructor(private readonly plans: IPlanRepository) {}

  async execute(planId: string, userId: string): Promise<Result<TrainingPlan, DomainError>> {
    const plan = await this.plans.findById(planId, userId);
    if (!plan) {
      return err(DomainError.notFound("plan"));
    }
    return ok(plan);
  }
}
