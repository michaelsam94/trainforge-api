import { z } from "zod";
import { completeWorkoutBodySchema, logSetBodySchema } from "@/presentation/dto/workout";

export const offlineSyncEntrySchema = z.object({
  clientId: z.string().min(1).max(128),
  kind: z.enum(["log_set", "complete_workout"]),
  payload: z.union([logSetBodySchema, completeWorkoutBodySchema]),
});

export const offlineSyncBodySchema = z.object({
  entries: z.array(offlineSyncEntrySchema).min(1).max(50),
});

export type OfflineSyncEntryDto = z.infer<typeof offlineSyncEntrySchema>;
