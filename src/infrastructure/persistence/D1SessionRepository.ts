import { createUserId, type UserId } from "@/domain/user";
import type { ISessionRepository } from "@/application/ports";

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

export class D1SessionRepository implements ISessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(userId: UserId, expiresAt: Date): Promise<string> {
    const id = crypto.randomUUID();
    await this.db
      .prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(id, userId, expiresAt.toISOString())
      .run();
    return id;
  }

  async findById(sessionId: string): Promise<{ userId: UserId; expiresAt: Date } | null> {
    const row = await this.db
      .prepare(`SELECT id, user_id, expires_at FROM sessions WHERE id = ?`)
      .bind(sessionId)
      .first<SessionRow>();

    if (!row) return null;

    return {
      userId: createUserId(row.user_id),
      expiresAt: new Date(row.expires_at),
    };
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }

  async deleteByUserId(userId: UserId): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  }
}
