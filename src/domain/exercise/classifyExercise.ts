export type ExerciseLocation = "home" | "gym" | "both";
export type ExerciseDifficulty = "easy" | "medium" | "hard";

const GYM_EQUIPMENT = new Set([
  "cable",
  "leverage machine",
  "smith machine",
  "sled machine",
  "stationary bike",
  "stepmill machine",
  "elliptical machine",
  "upper body ergometer",
  "skierg machine",
  "assisted",
]);

const HOME_EQUIPMENT = new Set([
  "body weight",
  "band",
  "resistance band",
  "stability ball",
  "bosu ball",
  "roller",
  "wheel roller",
]);

const HARD_NAME_PATTERNS = [
  /muscle[- ]?up/,
  /pistol/,
  /one[- ]arm/,
  /single[- ](arm|leg)/,
  /handstand/,
  /archer/,
  /planche/,
  /front lever/,
  /back lever/,
  /snatch/,
  /clean and jerk/,
  /olympic/,
  /intense/,
  /360/,
  /540/,
];

const EASY_BODYWEIGHT_PATTERNS = [
  /push[- ]?up/,
  /sit[- ]?up/,
  /crunch/,
  /plank/,
  /lunge/,
  /squat/,
  /step[- ]?up/,
  /stretch/,
  /raise/,
  /hold/,
];

function normalizeEquipment(equipments: string[]): string[] {
  return equipments.map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function classifyExerciseLocation(equipments: string[]): ExerciseLocation {
  const normalized = normalizeEquipment(equipments);
  if (!normalized.length) return "both";
  if (normalized.some((item) => GYM_EQUIPMENT.has(item))) return "gym";
  if (normalized.every((item) => HOME_EQUIPMENT.has(item))) return "home";
  return "both";
}

export function classifyExerciseDifficulty(
  name: string,
  equipments: string[],
): ExerciseDifficulty {
  const normalizedName = name.trim().toLowerCase();
  const normalizedEquipment = normalizeEquipment(equipments);

  if (
    normalizedEquipment.includes("olympic barbell") ||
    HARD_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName))
  ) {
    return "hard";
  }

  if (
    normalizedEquipment.includes("assisted") ||
    normalizedEquipment.includes("band") ||
    normalizedEquipment.includes("resistance band")
  ) {
    return "easy";
  }

  if (normalizedEquipment.includes("body weight")) {
    if (EASY_BODYWEIGHT_PATTERNS.some((pattern) => pattern.test(normalizedName))) {
      return "easy";
    }
    return "medium";
  }

  if (normalizedEquipment.includes("stability ball") || normalizedEquipment.includes("bosu ball")) {
    return "easy";
  }

  return "medium";
}

export function matchesLocationFilter(
  exerciseLocation: ExerciseLocation,
  filter: ExerciseLocation,
): boolean {
  if (filter === "both") return exerciseLocation === "both";
  if (filter === "home") return exerciseLocation === "home" || exerciseLocation === "both";
  return exerciseLocation === "gym" || exerciseLocation === "both";
}
