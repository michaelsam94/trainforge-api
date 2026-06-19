import type { ChatStreamInput, ILLMChatStreamer } from "@/application/ports/chat";

export class StubChatStreamer implements ILLMChatStreamer {
  async streamReply(input: ChatStreamInput): Promise<string> {
    const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
    const reply =
      "I'm your TrainForge coach. Based on your training context, focus on **quality movement** and adjust intensity when recovery is low. This is coaching guidance only — not medical advice.";

    for (const token of reply.split(" ")) {
      if (input.signal?.aborted) {
        throw new DOMException("Stream aborted", "AbortError");
      }
      await input.onToken(`${token} `);
    }

    if (lastUser?.content.toLowerCase().includes("sleep")) {
      const extra =
        " With poor sleep, consider reducing volume by 10–20% and prioritizing mobility work.";
      for (const token of extra.split(" ")) {
        if (input.signal?.aborted) {
          throw new DOMException("Stream aborted", "AbortError");
        }
        await input.onToken(`${token} `);
      }
      return `${reply}${extra}`;
    }

    return reply;
  }
}
