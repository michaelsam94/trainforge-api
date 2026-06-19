import { getChatMessageLimit } from "@/domain/chat";
import { DomainError } from "@/domain/shared/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import { requireFeature } from "@/presentation/middleware/require-feature";
import {
  createChatSessionBodySchema,
  sendChatMessageBodySchema,
  toChatMessageDto,
  toChatSessionDto,
} from "@/presentation/dto/chat";

export const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.get("/sessions", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.listChatSessions.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ sessions: result.value.map(toChatSessionDto) });
});

chatRoutes.post(
  "/sessions",
  requireAuth(),
  requireFeature("chat"),
  zValidator("json", createChatSessionBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");
    const result = await container.createChatSession.execute(user.id, body.title);

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({ session: toChatSessionDto(result.value) }, 201);
  },
);

chatRoutes.get("/sessions/:id/messages", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const sessionId = c.req.param("id");
  if (!sessionId) {
    throw DomainError.validation("Session id is required");
  }
  const result = await container.getChatMessages.execute(user.id, sessionId);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ messages: result.value.map(toChatMessageDto) });
});

chatRoutes.post(
  "/sessions/:id/messages",
  requireAuth(),
  requireFeature("chat"),
  zValidator("json", sendChatMessageBodySchema),
  (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const sessionId = c.req.param("id");
    if (!sessionId) {
      throw DomainError.validation("Session id is required");
    }
    const body = c.req.valid("json");
    const signal = c.req.raw.signal;

    c.header("X-RateLimit-Limit", String(getChatMessageLimit(user.subscriptionTier)));

    return streamSSE(c, async (stream) => {
      try {
        const result = await container.streamChatMessage.execute({
          userId: user.id,
          sessionId,
          content: body.content,
          subscriptionTier: user.subscriptionTier,
          signal,
          onToken: async (token) => {
            await stream.writeSSE({
              event: "token",
              data: JSON.stringify({ text: token }),
            });
          },
        });

        if (isErr(result)) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: result.error.message }),
          });
          return;
        }

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            userMessage: toChatMessageDto(result.value.userMessage),
            assistantMessage: toChatMessageDto(result.value.assistantMessage),
          }),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          await stream.writeSSE({ event: "cancelled", data: "{}" });
          return;
        }
        throw error;
      }
    });
  },
);
