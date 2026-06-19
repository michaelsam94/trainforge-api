import type { ChatMessage, ChatSession } from "@/domain/chat";
import type { IChatRepository } from "@/application/ports/chat";

type SessionRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: ChatMessage["role"];
  content: string;
  content_plain: string;
  created_at: string;
};

function mapSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    contentPlain: row.content_plain,
    createdAt: row.created_at,
  };
}

export class D1ChatRepository implements IChatRepository {
  constructor(private readonly db: D1Database) {}

  async listSessions(userId: string): Promise<ChatSession[]> {
    const result = await this.db
      .prepare(
        `SELECT id, user_id, title, created_at, updated_at
         FROM chat_sessions WHERE user_id = ?
         ORDER BY updated_at DESC`,
      )
      .bind(userId)
      .all<SessionRow>();

    return result.results.map(mapSession);
  }

  async findSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, title, created_at, updated_at
         FROM chat_sessions WHERE id = ? AND user_id = ?`,
      )
      .bind(sessionId, userId)
      .first<SessionRow>();

    return row ? mapSession(row) : null;
  }

  async createSession(userId: string, title = "Coach chat"): Promise<ChatSession> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, title, now, now)
      .run();

    return {
      id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = await this.findSession(sessionId, userId);
    if (!session) return [];

    const result = await this.db
      .prepare(
        `SELECT id, session_id, role, content, content_plain, created_at
         FROM chat_messages WHERE session_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(sessionId)
      .all<MessageRow>();

    return result.results.map(mapMessage);
  }

  async appendMessage(
    sessionId: string,
    role: ChatMessage["role"],
    content: string,
    contentPlain: string,
  ): Promise<ChatMessage> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, content_plain, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, sessionId, role, content, contentPlain, now)
      .run();

    await this.touchSession(sessionId);

    return {
      id,
      sessionId,
      role,
      content,
      contentPlain,
      createdAt: now,
    };
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), sessionId)
      .run();
  }
}
