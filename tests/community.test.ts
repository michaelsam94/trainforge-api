import { describe, expect, it } from "vitest";
import {
  CreatePostUseCase,
  CreateThreadUseCase,
  GetThreadUseCase,
  ListThreadsUseCase,
} from "@/application/use-cases/CommunityUseCases";
import {
  sanitizeForumText,
  validateForumBody,
  validateThreadTitle,
  type CreatePostInput,
  type CreateThreadInput,
  type ForumPost,
  type ForumThread,
  type ForumThreadDetail,
} from "@/domain/community";
import type { ICommunityRepository } from "@/application/ports/community";
import { isOk } from "@/domain/shared/result";

class MemoryCommunityRepository implements ICommunityRepository {
  private threads = new Map<string, ForumThreadDetail>();

  async listThreads(limit: number, offset: number): Promise<ForumThread[]> {
    return [...this.threads.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(offset, offset + limit)
      .map(({ posts: _posts, ...thread }) => thread);
  }

  async findThreadById(threadId: string): Promise<ForumThreadDetail | null> {
    const thread = this.threads.get(threadId);
    return thread ? structuredClone(thread) : null;
  }

  async createThread(input: CreateThreadInput): Promise<ForumThread> {
    const now = new Date().toISOString();
    const thread: ForumThreadDetail = {
      id: crypto.randomUUID(),
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      title: input.title,
      body: input.body,
      bodyPlain: input.bodyPlain,
      moderationFlag: "none",
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
      posts: [],
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  async createPost(input: CreatePostInput): Promise<ForumPost> {
    const thread = this.threads.get(input.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const post: ForumPost = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      body: input.body,
      bodyPlain: input.bodyPlain,
      moderationFlag: "none",
      createdAt: new Date().toISOString(),
    };

    thread.posts.push(post);
    thread.replyCount += 1;
    thread.updatedAt = post.createdAt;
    return post;
  }
}

describe("forum domain", () => {
  it("validates titles and sanitizes post bodies", () => {
    expect(validateThreadTitle("ab")).toContain("at least");
    expect(validateForumBody("")).toContain("empty");
    const sanitized = sanitizeForumText("Hello **world** <script>x</script>");
    expect(sanitized.plainText).toBe("Hello world");
  });
});

describe("community use cases", () => {
  it("creates a thread and reply end to end", async () => {
    const community = new MemoryCommunityRepository();
    const createThread = new CreateThreadUseCase(community);
    const createPost = new CreatePostUseCase(community);
    const getThread = new GetThreadUseCase(community);
    const listThreads = new ListThreadsUseCase(community);

    const created = await createThread.execute({
      authorId: "user-1",
      authorDisplayName: "Alex",
      title: "Best recovery stack?",
      body: "What do you use after heavy leg days?",
    });
    expect(isOk(created)).toBe(true);
    if (!isOk(created)) return;

    const reply = await createPost.execute({
      threadId: created.value.id,
      authorId: "user-2",
      authorDisplayName: "Jordan",
      body: "Sleep and protein within an hour.",
    });
    expect(isOk(reply)).toBe(true);

    const detail = await getThread.execute(created.value.id);
    expect(isOk(detail)).toBe(true);
    if (!isOk(detail)) return;
    expect(detail.value.posts).toHaveLength(1);
    expect(detail.value.replyCount).toBe(1);

    const listed = await listThreads.execute({});
    expect(isOk(listed)).toBe(true);
    if (!isOk(listed)) return;
    expect(listed.value[0]?.title).toBe("Best recovery stack?");
  });
});
