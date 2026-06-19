export type ModerationFlag = "none" | "hidden" | "locked";

export type PostModerationFlag = "none" | "hidden";

export type ForumThread = {
  id: string;
  authorId: string;
  authorDisplayName: string;
  title: string;
  body: string;
  bodyPlain: string;
  moderationFlag: ModerationFlag;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ForumPost = {
  id: string;
  threadId: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  bodyPlain: string;
  moderationFlag: PostModerationFlag;
  createdAt: string;
};

export type ForumThreadDetail = ForumThread & {
  posts: ForumPost[];
};

export type CreateThreadInput = {
  authorId: string;
  authorDisplayName: string;
  title: string;
  body: string;
  bodyPlain: string;
};

export type CreatePostInput = {
  threadId: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  bodyPlain: string;
};

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 4000;

export function validateThreadTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length < 3) return "Title must be at least 3 characters";
  if (trimmed.length > MAX_TITLE_LENGTH) return `Title must be at most ${String(MAX_TITLE_LENGTH)} characters`;
  return null;
}

export function validateForumBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < 1) return "Message cannot be empty";
  if (trimmed.length > MAX_BODY_LENGTH) {
    return `Message must be at most ${String(MAX_BODY_LENGTH)} characters`;
  }
  return null;
}

export function isThreadLocked(thread: Pick<ForumThread, "moderationFlag">): boolean {
  return thread.moderationFlag === "locked";
}

export function isThreadVisible(thread: Pick<ForumThread, "moderationFlag">): boolean {
  return thread.moderationFlag !== "hidden";
}

export function isPostVisible(post: Pick<ForumPost, "moderationFlag">): boolean {
  return post.moderationFlag !== "hidden";
}

export function sanitizeForumText(input: string): { content: string; plainText: string } {
  let content = input.replace(/<script[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[\s\S]*?<\/style>/gi, "");
  content = content.replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "");
  content = content.replace(/<\/?(?:iframe|object|embed|link|meta)[^>]*>/gi, "");
  content = content.replace(/<[^>]+>/g, "");

  const plainText = content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();

  return { content: content.trim(), plainText };
}
