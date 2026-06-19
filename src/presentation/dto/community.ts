import { z } from "zod";

export const createThreadBodySchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(1).max(4000),
});

export const createPostBodySchema = z.object({
  body: z.string().min(1).max(4000),
});

export const listThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function toThreadDto(thread: import("@/domain/community").ForumThread) {
  return {
    id: thread.id,
    authorId: thread.authorId,
    authorDisplayName: thread.authorDisplayName,
    title: thread.title,
    body: thread.bodyPlain,
    moderationFlag: thread.moderationFlag,
    replyCount: thread.replyCount,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export function toPostDto(post: import("@/domain/community").ForumPost) {
  return {
    id: post.id,
    threadId: post.threadId,
    authorId: post.authorId,
    authorDisplayName: post.authorDisplayName,
    body: post.bodyPlain,
    moderationFlag: post.moderationFlag,
    createdAt: post.createdAt,
  };
}

export function toThreadDetailDto(thread: import("@/domain/community").ForumThreadDetail) {
  return {
    ...toThreadDto(thread),
    posts: thread.posts.map(toPostDto),
  };
}
