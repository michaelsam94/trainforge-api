import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const goalSchema = z.object({
  type: z.enum(["fitness", "skill", "hybrid"]),
  description: z.string().min(3).max(500),
  targetTimelineWeeks: z.number().int().min(1).max(52).optional(),
});

export const onboardingBodySchema = z.object({
  goals: z.array(goalSchema).min(1).max(5),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]),
  equipment: z.array(z.string().min(1).max(40)).min(1).max(20),
  availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(180),
  complete: z.boolean().optional().default(false),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type OnboardingBody = z.infer<typeof onboardingBodySchema>;
