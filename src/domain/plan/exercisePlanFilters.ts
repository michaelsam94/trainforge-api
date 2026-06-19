import type { ExerciseDifficulty, ExerciseLocation } from "@/domain/exercise";
import type { FitnessLevel } from "@/domain/user";

export const BODY_PART_OPTIONS = [
  "chest",
  "back",
  "shoulders",
  "upper arms",
  "upper legs",
  "lower legs",
  "waist",
  "cardio",
] as const;

export type BodyPart = (typeof BODY_PART_OPTIONS)[number];

const CATALOG_ROTATION: BodyPart[] = [
  "chest",
  "back",
  "upper legs",
  "shoulders",
  "upper arms",
  "waist",
  "cardio",
];

export function resolveLocationFilter(equipment: string[]): ExerciseLocation | undefined {
  if (equipment.some((item) => /full gym/i.test(item))) return "gym";
  if (
    equipment.length > 0 &&
    equipment.every((item) => /bodyweight|resistance bands/i.test(item))
  ) {
    return "home";
  }
  return undefined;
}

export function resolveDifficultyFilters(level: FitnessLevel): ExerciseDifficulty[] | undefined {
  if (level === "beginner") return ["easy", "medium"];
  if (level === "intermediate") return ["easy", "medium", "hard"];
  return undefined;
}

export function pickBodyPartsForCatalog(dayCount: number): BodyPart[] {
  return CATALOG_ROTATION.slice(0, Math.max(1, Math.min(dayCount, CATALOG_ROTATION.length)));
}

export function pickBodyPartsForManual(selection: string[], dayCount: number): BodyPart[] {
  const normalized = selection
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is BodyPart => BODY_PART_OPTIONS.includes(item as BodyPart));

  if (!normalized.length) {
    return pickBodyPartsForCatalog(dayCount);
  }

  const parts: BodyPart[] = [];
  for (let index = 0; index < dayCount; index += 1) {
    parts.push(normalized[index % normalized.length]!);
  }
  return parts;
}
