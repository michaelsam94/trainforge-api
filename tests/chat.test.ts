import { describe, expect, it } from "vitest";
import {
  buildCoachSystemPrompt,
  sanitizeCoachMarkdown,
  getChatMessageLimit,
} from "@/domain/chat";
import { StreamChatMessageUseCase } from "@/application/use-cases/ChatUseCases";
import type { IChatRateLimiter, IChatRepository, ILLMChatStreamer } from "@/application/ports/chat";
import type { IOnboardingReader } from "@/application/ports/plan";
import type { ChatMessage, ChatSession } from "@/domain/chat";
import { createUserId, type OnboardingProfile } from "@/domain/user";
import { isOk } from "@/domain/shared/result";

class MemoryChatRepository implements IChatRepository {
  private sessions = new Map<string, ChatSession>();
  private messages = new Map<string, ChatMessage[]>();

  async listSessions(userId: string) {
    return [...this.sessions.values()].filter((session) => session.userId === userId);
  }

  async findSession(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    return session?.userId === userId ? session : null;
  }

  async createSession(userId: string, title = "Coach chat") {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    return session;
  }

  async listMessages(sessionId: string, userId: string) {
    const session = await this.findSession(sessionId, userId);
    if (!session) return [];
    return this.messages.get(sessionId) ?? [];
  }

  async appendMessage(sessionId: string, role: ChatMessage["role"], content: string, contentPlain: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
      contentPlain,
      createdAt: new Date().toISOString(),
    };
    const list = this.messages.get(sessionId) ?? [];
    list.push(message);
    this.messages.set(sessionId, list);
    return message;
  }

  async touchSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) session.updatedAt = new Date().toISOString();
  }
}

class AllowAllRateLimiter implements IChatRateLimiter {
  async checkAndIncrement() {
    return { allowed: true, remaining: 19, limit: 20 };
  }
}

class SlowTokenStreamer implements ILLMChatStreamer {
  async streamReply(input: Parameters<ILLMChatStreamer["streamReply"]>[0]): Promise<string> {
    const tokens = ["Hello", " ", "coach", " ", "stream"];
    let text = "";
    for (const token of tokens) {
      if (input.signal?.aborted) {
        throw new DOMException("Stream aborted", "AbortError");
      }
      text += token;
      await input.onToken(token);
    }
    return text;
  }
}

const profile: OnboardingProfile = {
  userId: createUserId("user-1"),
  goals: [{ type: "fitness", description: "Build endurance" }],
  fitnessLevel: "intermediate",
  equipment: ["Dumbbells"],
  availableDays: [1, 3, 5],
  sessionMinutes: 45,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

class MemoryOnboardingReader implements IOnboardingReader {
  async findByUserId(userId: import("@/domain/user").UserId) {
    return userId === profile.userId ? profile : null;
  }
}

describe("sanitizeCoachMarkdown", () => {
  it("strips script tags and returns plain text", () => {
    const result = sanitizeCoachMarkdown('Hello **world** <script>alert(1)</script>');
    expect(result.content).not.toContain("<script>");
    expect(result.plainText).toBe("Hello world");
  });
});

describe("buildCoachSystemPrompt", () => {
  it("includes fitness context", () => {
    const prompt = buildCoachSystemPrompt(profile);
    expect(prompt).toContain("intermediate");
    expect(prompt).toContain("not a medical professional");
  });
});

describe("getChatMessageLimit", () => {
  it("returns tier-based limits", () => {
    expect(getChatMessageLimit("free")).toBe(20);
    expect(getChatMessageLimit("pro")).toBe(100);
    expect(getChatMessageLimit("premium")).toBe(200);
  });
});

describe("StreamChatMessageUseCase", () => {
  it("streams tokens and persists assistant message", async () => {
    const chat = new MemoryChatRepository();
    const session = await chat.createSession("user-1");
    const useCase = new StreamChatMessageUseCase(
      chat,
      new MemoryOnboardingReader(),
      new SlowTokenStreamer(),
      new AllowAllRateLimiter(),
    );

    const tokens: string[] = [];
    const result = await useCase.execute({
      userId: "user-1",
      sessionId: session.id,
      content: "How should I train today?",
      subscriptionTier: "pro",
      onToken: (token) => {
        tokens.push(token);
      },
    });

    expect(isOk(result)).toBe(true);
    expect(tokens.join("")).toContain("Hello");
    if (!isOk(result)) return;
    expect(result.value.assistantMessage.role).toBe("assistant");
  });

  it("respects abort signal mid-stream", async () => {
    const chat = new MemoryChatRepository();
    const session = await chat.createSession("user-1");
    const useCase = new StreamChatMessageUseCase(
      chat,
      new MemoryOnboardingReader(),
      new SlowTokenStreamer(),
      new AllowAllRateLimiter(),
    );

    const controller = new AbortController();
    const tokens: string[] = [];

    await expect(
      useCase.execute({
        userId: "user-1",
        sessionId: session.id,
        content: "Need advice",
        subscriptionTier: "pro",
        signal: controller.signal,
        onToken: (token) => {
          tokens.push(token);
          if (tokens.length >= 2) controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    const messages = await chat.listMessages(session.id, "user-1");
    expect(messages.some((message) => message.role === "assistant")).toBe(false);
  });
});
