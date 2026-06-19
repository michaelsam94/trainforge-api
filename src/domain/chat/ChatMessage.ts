export type ChatRole = "user" | "assistant";

export type ChatSession = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  contentPlain: string;
  createdAt: string;
};

export type AppendChatMessageInput = {
  sessionId: string;
  role: ChatRole;
  content: string;
  contentPlain: string;
};
