import type { OnboardingProfile } from "@/domain/user";

export function buildCoachSystemPrompt(profile: OnboardingProfile | null): string {
  const goals =
    profile?.goals.map((goal) => goal.description).join("; ") ?? "General fitness improvement";
  const equipment = profile?.equipment.join(", ") ?? "Bodyweight only";
  const fitnessLevel = profile?.fitnessLevel ?? "beginner";

  return [
    "You are TrainForge AI Coach — a supportive fitness coach, not a medical professional.",
    "Never diagnose conditions or prescribe medication.",
    "Encourage users to consult qualified healthcare providers for injuries or medical concerns.",
    "Stay within training, recovery, motivation, and high-level movement guidance.",
    "Keep responses concise unless the user asks for detail. Markdown (**bold**, lists) is allowed.",
    "",
    `User fitness level: ${fitnessLevel}`,
    `User goals: ${goals}`,
    `Available equipment: ${equipment}`,
  ].join("\n");
}
