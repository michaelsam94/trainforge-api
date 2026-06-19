import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  createUserId,
  sanitizeGoalDescription,
  type OnboardingDraft,
  type OnboardingProfile,
} from "@/domain/user";
import type { IOnboardingRepository } from "@/application/ports";

export class SaveOnboardingUseCase {
  constructor(private readonly onboarding: IOnboardingRepository) {}

  async execute(
    userId: string,
    draft: OnboardingDraft,
    complete: boolean,
  ): Promise<Result<OnboardingProfile, DomainError>> {
    if (draft.goals.length === 0) {
      return err(DomainError.validation("At least one goal is required"));
    }

    if (draft.availableDays.length === 0) {
      return err(DomainError.validation("Select at least one available day"));
    }

    const sanitized: OnboardingDraft = {
      ...draft,
      goals: draft.goals.map((goal) => ({
        ...goal,
        description: sanitizeGoalDescription(goal.description),
      })),
    };

    const saved = await this.onboarding.saveDraft(createUserId(userId), sanitized);

    if (complete) {
      return ok(await this.onboarding.markComplete(createUserId(userId)));
    }

    return ok(saved);
  }
}
