import type { ChatMessage, ChatSession } from "@/domain/chat";

export interface IChatRepository {
  listSessions(userId: string): Promise<ChatSession[]>;
  findSession(sessionId: string, userId: string): Promise<ChatSession | null>;
  createSession(userId: string, title?: string): Promise<ChatSession>;
  listMessages(sessionId: string, userId: string): Promise<ChatMessage[]>;
  appendMessage(
    sessionId: string,
    role: ChatMessage["role"],
    content: string,
    contentPlain: string,
  ): Promise<ChatMessage>;
  touchSession(sessionId: string): Promise<void>;
}

export type ChatStreamMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatStreamInput = {
  systemPrompt: string;
  messages: ChatStreamMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void | Promise<void>;
};

export interface ILLMChatStreamer {
  streamReply(input: ChatStreamInput): Promise<string>;
}

export interface IChatRateLimiter {
  checkAndIncrement(
    userId: string,
    tier: import("@/domain/billing").SubscriptionTier,
  ): Promise<{ allowed: boolean; remaining: number; limit: number }>;
}
