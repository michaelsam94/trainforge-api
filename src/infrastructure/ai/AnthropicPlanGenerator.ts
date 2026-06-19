import {
  generatedPlanSchema,
  type GeneratedPlan,
} from "@/domain/plan";
import type { OnboardingProfile } from "@/domain/user";
import type { ILLMPlanGenerator } from "@/application/ports/plan";
import { sanitizeGoalDescription } from "@/domain/user";
import { StubPlanGenerator } from "@/infrastructure/ai/StubPlanGenerator";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export class AnthropicPlanGenerator implements ILLMPlanGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly fallback: ILLMPlanGenerator = new StubPlanGenerator(),
  ) {}

  async generate(profile: OnboardingProfile): Promise<GeneratedPlan> {
    if (!this.apiKey) {
      return await this.fallback.generate(profile);
    }

    const sanitizedGoals = profile.goals.map((goal) => ({
      ...goal,
      description: sanitizeGoalDescription(goal.description),
    }));

    const prompt = `You are a fitness programming assistant. Return ONLY valid JSON matching this schema:
{"weekStart":"YYYY-MM-DD","days":[{"dayIndex":0,"title":"string","focus":"string","estimatedMinutes":45,"exercises":[{"name":"string","sets":3,"reps":"8-12"}]}]}

Constraints:
- fitnessLevel: ${profile.fitnessLevel}
- equipment: ${profile.equipment.join(", ")}
- sessionMinutes: ${String(profile.sessionMinutes)}
- availableWeekdays (0=Sun): ${profile.availableDays.join(", ")}
- goals: ${JSON.stringify(sanitizedGoals)}

Create up to 7 workout days aligned to available weekdays for the current week starting Monday UTC.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt } satisfies AnthropicMessage],
        }),
      });

      if (!response.ok) {
        return await this.fallback.generate(profile);
      }

      const payload: { content?: { type: string; text?: string }[] } = await response.json();
      const text = payload.content?.find((part) => part.type === "text")?.text;
      if (!text) {
        return await this.fallback.generate(profile);
      }

      const jsonMatch = /\{[\s\S]*\}/.exec(text);
      if (!jsonMatch) {
        return await this.fallback.generate(profile);
      }

      return generatedPlanSchema.parse(JSON.parse(jsonMatch[0]));
    } catch {
      return await this.fallback.generate(profile);
    }
  }
}
