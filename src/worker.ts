import { createApp } from "@/presentation/app";
import { createContainer } from "@/composition/container";
import {
  isPlanGenerationJob,
  type PlanGenerationJob,
} from "@/application/jobs/planGenerationJob";

const app = createApp();

async function processQueueBatch(batch: MessageBatch<PlanGenerationJob>, env: Env) {
  const container = createContainer(env);

  for (const message of batch.messages) {
    if (!isPlanGenerationJob(message.body)) {
      message.ack();
      continue;
    }

    await container.generatePlan.processJob(message.body.planId, message.body.userId);
    message.ack();
  }
}

export default {
  fetch: app.fetch,
  queue: processQueueBatch,
  scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    const container = createContainer(env);
    ctx.waitUntil(container.syncWearableMetrics.syncAllDue());
  },
} satisfies ExportedHandler<Env, PlanGenerationJob>;
