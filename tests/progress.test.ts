import { describe, expect, it } from "vitest";
import {
  aggregateWeeklyVolume,
  calculateStreak,
  computeSkillRadar,
  evaluateBadges,
} from "@/domain/progress";

describe("calculateStreak", () => {
  it("returns zero when no workouts logged", () => {
    expect(calculateStreak([], "2026-06-19")).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
    });
  });

  it("counts consecutive days for current and longest streak", () => {
    const result = calculateStreak(
      [
        "2026-06-16T10:00:00.000Z",
        "2026-06-17T10:00:00.000Z",
        "2026-06-18T10:00:00.000Z",
        "2026-06-19T10:00:00.000Z",
      ],
      "2026-06-19",
    );

    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
    expect(result.lastWorkoutDate).toBe("2026-06-19");
  });

  it("breaks current streak when last workout is older than yesterday", () => {
    const result = calculateStreak(["2026-06-15T10:00:00.000Z"], "2026-06-19");
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
  });
});

describe("evaluateBadges", () => {
  it("awards first workout badge after one session", () => {
    const badges = evaluateBadges({
      totalWorkouts: 1,
      totalSets: 8,
      currentStreak: 1,
      longestStreak: 1,
      weeklyCompleted: 1,
    });

    expect(badges.find((badge) => badge.id === "first_workout")?.earned).toBe(true);
    expect(badges.find((badge) => badge.id === "century_sets")?.earned).toBe(false);
  });

  it("awards intermediate skill badge for trained intermediate users", () => {
    const badges = evaluateBadges({
      totalWorkouts: 5,
      totalSets: 40,
      currentStreak: 3,
      longestStreak: 3,
      weeklyCompleted: 3,
      fitnessLevel: "intermediate",
    });

    expect(badges.find((badge) => badge.id === "skill_intermediate")?.earned).toBe(true);
  });
});

describe("computeSkillRadar", () => {
  it("caps all axes at 100", () => {
    const radar = computeSkillRadar({
      adherencePercent: 120,
      weightedSetRatio: 2,
      durationSetRatio: 2,
      totalWorkouts: 50,
    });

    expect(radar.strength).toBeLessThanOrEqual(100);
    expect(radar.endurance).toBeLessThanOrEqual(100);
    expect(radar.mobility).toBeLessThanOrEqual(100);
    expect(radar.consistency).toBe(100);
  });
});

describe("aggregateWeeklyVolume", () => {
  it("groups workouts into weekly buckets", () => {
    const points = aggregateWeeklyVolume(
      [
        { completedAt: "2026-06-16T10:00:00.000Z", setCount: 9 },
        { completedAt: "2026-06-17T10:00:00.000Z", setCount: 6 },
        { completedAt: "2026-06-23T10:00:00.000Z", setCount: 12 },
      ],
      2,
      new Date("2026-06-23T12:00:00.000Z"),
    );

    expect(points).toHaveLength(2);
    expect(points[0]?.workouts).toBe(2);
    expect(points[0]?.sets).toBe(15);
    expect(points[1]?.workouts).toBe(1);
  });
});
