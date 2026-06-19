import { describe, expect, it } from "vitest";
import {
  calculateAdjustedLoad,
  isWorkoutComplete,
} from "@/domain/plan/calculateAdjustedLoad";

describe("calculateAdjustedLoad", () => {
  it("increases load when all sets completed and session felt easy", () => {
    const result = calculateAdjustedLoad({
      prescribedSets: 4,
      completedSets: 4,
      difficultyRating: 2,
    });

    expect(result.loadMultiplier).toBeGreaterThan(1);
    expect(result.reason).toContain("load increased");
  });

  it("decreases load when sets incomplete or too hard", () => {
    const result = calculateAdjustedLoad({
      prescribedSets: 4,
      completedSets: 2,
      difficultyRating: 5,
    });

    expect(result.loadMultiplier).toBeLessThan(1);
    expect(result.reason).toContain("lowering intensity");
  });

  it("maintains load for balanced feedback", () => {
    const result = calculateAdjustedLoad({
      prescribedSets: 3,
      completedSets: 3,
      difficultyRating: 3,
    });

    expect(result.loadMultiplier).toBe(1);
    expect(result.adjustSets).toBe(3);
  });

  it("respects previous multiplier bounds", () => {
    const result = calculateAdjustedLoad({
      prescribedSets: 3,
      completedSets: 0,
      difficultyRating: 5,
      previousLoadMultiplier: 0.72,
    });

    expect(result.loadMultiplier).toBeGreaterThanOrEqual(0.7);
  });
});

describe("isWorkoutComplete", () => {
  it("returns true when every exercise hit prescribed sets", () => {
    expect(
      isWorkoutComplete(
        { ex1: 3, ex2: 2 },
        { ex1: 3, ex2: 2 },
      ),
    ).toBe(true);
  });

  it("returns false when an exercise is short", () => {
    expect(
      isWorkoutComplete(
        { ex1: 3, ex2: 2 },
        { ex1: 2, ex2: 2 },
      ),
    ).toBe(false);
  });
});
