import type {
  CreatePostInput,
  CreateThreadInput,
  ForumPost,
  ForumThread,
  ForumThreadDetail,
} from "@/domain/community";

export interface ICommunityRepository {
  listThreads(limit: number, offset: number): Promise<ForumThread[]>;
  findThreadById(threadId: string): Promise<ForumThreadDetail | null>;
  createThread(input: CreateThreadInput): Promise<ForumThread>;
  createPost(input: CreatePostInput): Promise<ForumPost>;
}
