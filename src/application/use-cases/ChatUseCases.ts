import {
  buildCoachSystemPrompt,
  sanitizeCoachMarkdown,
  type ChatMessage,
  type ChatSession,
} from "@/domain/chat";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import type { IOnboardingReader } from "@/application/ports/plan";
import type {
  IChatRateLimiter,
  IChatRepository,
  ILLMChatStreamer,
} from "@/application/ports/chat";

export class ListChatSessionsUseCase {
  constructor(private readonly chat: IChatRepository) {}

  async execute(userId: string): Promise<Result<ChatSession[], DomainError>> {
    const sessions = await this.chat.listSessions(userId);
    return ok(sessions);
  }
}

export class CreateChatSessionUseCase {
  constructor(private readonly chat: IChatRepository) {}

  async execute(userId: string, title?: string): Promise<Result<ChatSession, DomainError>> {
    const session = await this.chat.createSession(userId, title);
    return ok(session);
  }
}

export class GetChatMessagesUseCase {
  constructor(private readonly chat: IChatRepository) {}

  async execute(
    userId: string,
    sessionId: string,
  ): Promise<Result<ChatMessage[], DomainError>> {
    const session = await this.chat.findSession(sessionId, userId);
    if (!session) {
      return err(DomainError.notFound("chat session"));
    }

    const messages = await this.chat.listMessages(sessionId, userId);
    return ok(messages);
  }
}

export type StreamChatMessageInput = {
  userId: string;
  sessionId: string;
  content: string;
  subscriptionTier: import("@/domain/billing").SubscriptionTier;
  signal?: AbortSignal;
  onToken: (token: string) => void | Promise<void>;
};

export type StreamChatMessageResult = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

export class StreamChatMessageUseCase {
  constructor(
    private readonly chat: IChatRepository,
    private readonly onboarding: IOnboardingReader,
    private readonly streamer: ILLMChatStreamer,
    private readonly rateLimiter: IChatRateLimiter,
  ) {}

  async execute(
    input: StreamChatMessageInput,
  ): Promise<Result<StreamChatMessageResult, DomainError>> {
    const session = await this.chat.findSession(input.sessionId, input.userId);
    if (!session) {
      return err(DomainError.notFound("chat session"));
    }

    const sanitizedUser = sanitizeCoachMarkdown(input.content.trim());
    if (!sanitizedUser.plainText) {
      return err(DomainError.validation("Message cannot be empty"));
    }

    const rateLimit = await this.rateLimiter.checkAndIncrement(
      input.userId,
      input.subscriptionTier,
    );
    if (!rateLimit.allowed) {
      return err(
        DomainError.validation(
          `Chat rate limit reached (${String(rateLimit.limit)} messages/hour on your plan).`,
        ),
      );
    }

    const userMessage = await this.chat.appendMessage(
      input.sessionId,
      "user",
      sanitizedUser.content,
      sanitizedUser.plainText,
    );

    const history = await this.chat.listMessages(input.sessionId, input.userId);
    const profile = await this.onboarding.findByUserId(
      input.userId as import("@/domain/user").UserId,
    );
    const systemPrompt = buildCoachSystemPrompt(profile);

    let rawAssistant = "";
    try {
      rawAssistant = await this.streamer.streamReply({
        systemPrompt,
        messages: history.map((message) => ({
          role: message.role,
          content: message.contentPlain,
        })),
        signal: input.signal,
        onToken: input.onToken,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      return err(DomainError.validation("Unable to stream coach response"));
    }

    const sanitizedAssistant = sanitizeCoachMarkdown(rawAssistant || "I couldn't generate a reply.");
    const assistantMessage = await this.chat.appendMessage(
      input.sessionId,
      "assistant",
      sanitizedAssistant.content,
      sanitizedAssistant.plainText,
    );

    return ok({ userMessage, assistantMessage });
  }
}
