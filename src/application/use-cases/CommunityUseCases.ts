import {
  isThreadLocked,
  isThreadVisible,
  sanitizeForumText,
  validateForumBody,
  validateThreadTitle,
  type CreatePostInput,
  type CreateThreadInput,
  type ForumPost,
  type ForumThread,
  type ForumThreadDetail,
} from "@/domain/community";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import type { ICommunityRepository } from "@/application/ports/community";

export class ListThreadsUseCase {
  constructor(private readonly community: ICommunityRepository) {}

  async execute(input: {
    limit?: number;
    offset?: number;
  }): Promise<Result<ForumThread[], DomainError>> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const offset = Math.max(input.offset ?? 0, 0);
    const threads = await this.community.listThreads(limit, offset);
    return ok(threads.filter(isThreadVisible));
  }
}

export class GetThreadUseCase {
  constructor(private readonly community: ICommunityRepository) {}

  async execute(threadId: string): Promise<Result<ForumThreadDetail, DomainError>> {
    const thread = await this.community.findThreadById(threadId);
    if (!thread || !isThreadVisible(thread)) {
      return err(DomainError.notFound("thread"));
    }

    return ok({
      ...thread,
      posts: thread.posts.filter((post) => post.moderationFlag === "none"),
    });
  }
}

export class CreateThreadUseCase {
  constructor(private readonly community: ICommunityRepository) {}

  async execute(input: {
    authorId: string;
    authorDisplayName: string;
    title: string;
    body: string;
  }): Promise<Result<ForumThread, DomainError>> {
    const titleError = validateThreadTitle(input.title);
    if (titleError) return err(DomainError.validation(titleError));

    const sanitized = sanitizeForumText(input.body);
    const bodyError = validateForumBody(sanitized.plainText);
    if (bodyError) return err(DomainError.validation(bodyError));

    const thread = await this.community.createThread({
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      title: input.title.trim(),
      body: sanitized.content,
      bodyPlain: sanitized.plainText,
    } satisfies CreateThreadInput);

    return ok(thread);
  }
}

export class CreatePostUseCase {
  constructor(private readonly community: ICommunityRepository) {}

  async execute(input: {
    threadId: string;
    authorId: string;
    authorDisplayName: string;
    body: string;
  }): Promise<Result<ForumPost, DomainError>> {
    const thread = await this.community.findThreadById(input.threadId);
    if (!thread || !isThreadVisible(thread)) {
      return err(DomainError.notFound("thread"));
    }
    if (isThreadLocked(thread)) {
      return err(DomainError.validation("This thread is locked"));
    }

    const sanitized = sanitizeForumText(input.body);
    const bodyError = validateForumBody(sanitized.plainText);
    if (bodyError) return err(DomainError.validation(bodyError));

    const post = await this.community.createPost({
      threadId: input.threadId,
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName,
      body: sanitized.content,
      bodyPlain: sanitized.plainText,
    } satisfies CreatePostInput);

    return ok(post);
  }
}
