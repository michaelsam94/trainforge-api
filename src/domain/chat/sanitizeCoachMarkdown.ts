/**
 * Server-side markdown sanitization with plain-text fallback for accessibility.
 */
export function sanitizeCoachMarkdown(input: string): { content: string; plainText: string } {
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
