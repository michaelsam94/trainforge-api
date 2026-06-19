import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { DomainError } from "@/domain/shared/errors";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import {
  createPostBodySchema,
  createThreadBodySchema,
  listThreadsQuerySchema,
  toPostDto,
  toThreadDetailDto,
  toThreadDto,
} from "@/presentation/dto/community";

export const communityRoutes = new Hono<{ Bindings: Env }>();

communityRoutes.get(
  "/threads",
  requireAuth(),
  zValidator("query", listThreadsQuerySchema),
  async (c) => {
    const container = c.get("container");
    const query = c.req.valid("query");
    const result = await container.listThreads.execute({
      limit: query.limit,
      offset: query.offset,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({ threads: result.value.map(toThreadDto) });
  },
);

communityRoutes.post(
  "/threads",
  requireAuth(),
  zValidator("json", createThreadBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");
    const result = await container.createThread.execute({
      authorId: user.id,
      authorDisplayName: user.displayName,
      title: body.title,
      body: body.body,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({ thread: toThreadDto(result.value) }, 201);
  },
);

communityRoutes.get("/threads/:id", requireAuth(), async (c) => {
  const container = c.get("container");
  const threadId = c.req.param("id");
  if (!threadId) {
    throw DomainError.validation("Thread id is required");
  }
  const result = await container.getThread.execute(threadId);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ thread: toThreadDetailDto(result.value) });
});

communityRoutes.post(
  "/threads/:id/posts",
  requireAuth(),
  zValidator("json", createPostBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const threadId = c.req.param("id");
    if (!threadId) {
      throw DomainError.validation("Thread id is required");
    }
    const body = c.req.valid("json");
    const result = await container.createPost.execute({
      threadId,
      authorId: user.id,
      authorDisplayName: user.displayName,
      body: body.body,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({ post: toPostDto(result.value) }, 201);
  },
);
