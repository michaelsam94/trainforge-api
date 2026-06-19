export type SkillRadar = {
  strength: number;
  endurance: number;
  mobility: number;
  consistency: number;
};

export type SkillRadarInput = {
  adherencePercent: number;
  weightedSetRatio: number;
  durationSetRatio: number;
  totalWorkouts: number;
};

export function computeSkillRadar(input: SkillRadarInput): SkillRadar {
  const consistency = Math.min(100, Math.max(0, input.adherencePercent));
  const workoutBonus = Math.min(input.totalWorkouts, 10) * 2;

  return {
    strength: Math.min(
      100,
      Math.round(input.weightedSetRatio * 80 + workoutBonus),
    ),
    endurance: Math.min(
      100,
      Math.round(input.durationSetRatio * 80 + workoutBonus),
    ),
    mobility: Math.min(100, Math.round(40 + consistency * 0.3 + workoutBonus)),
    consistency,
  };
}
