import { z } from "zod";

export const sendChatMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const createChatSessionBodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export function toChatSessionDto(session: import("@/domain/chat").ChatSession) {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function toChatMessageDto(message: import("@/domain/chat").ChatMessage) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    contentPlain: message.contentPlain,
    createdAt: message.createdAt,
  };
}
