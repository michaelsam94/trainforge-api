import {
  createUserId,
  type CreateUserInput,
  type User,
  type UserId,
} from "@/domain/user";
import type { IUserRepository } from "@/application/ports";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: UserRow): User & { passwordHash: string } {
  return {
    id: createUserId(row.id),
    email: row.email,
    displayName: row.display_name ?? row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1UserRepository implements IUserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: UserId): Promise<User | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, password_hash, display_name, created_at, updated_at
         FROM users WHERE id = ?`,
      )
      .bind(id)
      .first<UserRow>();

    if (!row) return null;

    const mapped = mapRow(row);
    const { passwordHash: _hash, ...user } = mapped;
    void _hash;
    return user;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, password_hash, display_name, created_at, updated_at
         FROM users WHERE email = ?`,
      )
      .bind(email)
      .first<UserRow>();

    return row ? mapRow(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.email, input.passwordHash, input.displayName, now, now)
      .run();

    return {
      id: createUserId(id),
      email: input.email,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteById(id: UserId): Promise<void> {
    await this.db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  }
}
