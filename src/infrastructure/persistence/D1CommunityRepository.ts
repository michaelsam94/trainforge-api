import type {
  CreatePostInput,
  CreateThreadInput,
  ForumPost,
  ForumThread,
  ForumThreadDetail,
} from "@/domain/community";
import type { ICommunityRepository } from "@/application/ports/community";

type ThreadRow = {
  id: string;
  author_id: string;
  display_name: string | null;
  title: string;
  body: string;
  moderation_flag: ForumThread["moderationFlag"];
  reply_count: number;
  created_at: string;
  updated_at: string;
};

type PostRow = {
  id: string;
  thread_id: string;
  author_id: string;
  display_name: string | null;
  body: string;
  moderation_flag: ForumPost["moderationFlag"];
  created_at: string;
};

function mapThread(row: ThreadRow, bodyPlain?: string): ForumThread {
  return {
    id: row.id,
    authorId: row.author_id,
    authorDisplayName: row.display_name ?? "Member",
    title: row.title,
    body: row.body,
    bodyPlain: bodyPlain ?? row.body,
    moderationFlag: row.moderation_flag,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPost(row: PostRow, bodyPlain?: string): ForumPost {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    authorDisplayName: row.display_name ?? "Member",
    body: row.body,
    bodyPlain: bodyPlain ?? row.body,
    moderationFlag: row.moderation_flag,
    createdAt: row.created_at,
  };
}

export class D1CommunityRepository implements ICommunityRepository {
  constructor(private readonly db: D1Database) {}

  async listThreads(limit: number, offset: number): Promise<ForumThread[]> {
    const result = await this.db
      .prepare(
        `SELECT t.id, t.author_id, u.display_name, t.title, t.body, t.moderation_flag,
                t.reply_count, t.created_at, t.updated_at
         FROM forum_threads t
         INNER JOIN users u ON u.id = t.author_id
         WHERE t.moderation_flag != 'hidden'
         ORDER BY t.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all<ThreadRow>();

    return result.results.map((row) => mapThread(row));
  }

  async findThreadById(threadId: string): Promise<ForumThreadDetail | null> {
    const threadRow = await this.db
      .prepare(
        `SELECT t.id, t.author_id, u.display_name, t.title, t.body, t.moderation_flag,
                t.reply_count, t.created_at, t.updated_at
         FROM forum_threads t
         INNER JOIN users u ON u.id = t.author_id
         WHERE t.id = ?`,
      )
      .bind(threadId)
      .first<ThreadRow>();

    if (!threadRow) return null;

    const postsResult = await this.db
      .prepare(
        `SELECT p.id, p.thread_id, p.author_id, u.display_name, p.body, p.moderation_flag, p.created_at
         FROM forum_posts p
         INNER JOIN users u ON u.id = p.author_id
         WHERE p.thread_id = ? AND p.moderation_flag = 'none'
         ORDER BY p.created_at ASC`,
      )
      .bind(threadId)
      .all<PostRow>();

    return {
      ...mapThread(threadRow),
      posts: postsResult.results.map((row) => mapPost(row)),
    };
  }

  async createThread(input: CreateThreadInput): Promise<ForumThread> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO forum_threads (
           id, author_id, title, body, moderation_flag, reply_count, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'none', 0, ?, ?)`,
      )
      .bind(id, input.authorId, input.title, input.body, now, now)
      .run();

    return {
      id,
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      title: input.title,
      body: input.body,
      bodyPlain: input.bodyPlain,
      moderationFlag: "none",
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async createPost(input: CreatePostInput): Promise<ForumPost> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO forum_posts (id, thread_id, author_id, body, moderation_flag, created_at)
           VALUES (?, ?, ?, ?, 'none', ?)`,
        )
        .bind(id, input.threadId, input.authorId, input.body, now),
      this.db
        .prepare(
          `UPDATE forum_threads
           SET reply_count = reply_count + 1, updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, input.threadId),
    ]);

    return {
      id,
      threadId: input.threadId,
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      body: input.body,
      bodyPlain: input.bodyPlain,
      moderationFlag: "none",
      createdAt: now,
    };
  }
}
