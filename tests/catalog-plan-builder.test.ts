import { describe, expect, it } from "vitest";

import { buildCatalogPlan } from "@/domain/plan/CatalogPlanBuilder";

const profile = {
  availableDays: [1],
  sessionMinutes: 45,
  fitnessLevel: "intermediate",
};

const chestExercises = Array.from({ length: 6 }, (_, index) => ({
  name: `Chest exercise ${index + 1}`,
  category: "chest",
  equipments: ["dumbbell"],
}));

function buildFirstExerciseName(seed: string): string {
  const plan = buildCatalogPlan({
    seed,
    mode: "body_parts",
    profile,
    bodyParts: ["chest"],
    exercisesByBodyPart: new Map([["chest", chestExercises]]),
  } as any);

  return plan.days[0]?.exercises[0]?.name ?? "";
}

describe("buildCatalogPlan", () => {
  it("rotates eligible catalog exercises by seed", () => {
    expect(buildFirstExerciseName("seed-a")).toBe(buildFirstExerciseName("seed-a"));
    expect(buildFirstExerciseName("seed-a")).not.toBe(buildFirstExerciseName("seed-b"));
  });
});
