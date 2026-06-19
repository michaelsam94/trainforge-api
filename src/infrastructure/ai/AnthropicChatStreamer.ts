import type { ChatStreamInput, ILLMChatStreamer } from "@/application/ports/chat";
import { StubChatStreamer } from "@/infrastructure/ai/StubChatStreamer";

type AnthropicStreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string };
};

export class AnthropicChatStreamer implements ILLMChatStreamer {
  constructor(
    private readonly apiKey: string,
    private readonly fallback: ILLMChatStreamer = new StubChatStreamer(),
  ) {}

  async streamReply(input: ChatStreamInput): Promise<string> {
    if (!this.apiKey) {
      return this.fallback.streamReply(input);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1024,
          stream: true,
          system: input.systemPrompt,
          messages: input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
        signal: input.signal,
      });

      if (!response.ok || !response.body) {
        return await this.fallback.streamReply(input);
      }

      let fullText = "";
      for await (const token of parseAnthropicSse(
        response.body as ReadableStream<Uint8Array>,
        input.signal,
      )) {
        fullText += token;
        await input.onToken(token);
      }

      return fullText.trim();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      return await this.fallback.streamReply(input);
    }
  }
}

async function* parseAnthropicSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    if (signal?.aborted) {
      throw new DOMException("Stream aborted", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const event = JSON.parse(payload) as AnthropicStreamEvent;
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text ?? "";
          if (text) yield text;
        }
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }
}
