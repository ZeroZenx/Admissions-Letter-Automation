const forbiddenTags = /<\/?(script|iframe|object|embed|link|meta|style)[^>]*>/gi;
const eventAttributes = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const javascriptUrls = /\s(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi;

export function sanitizeEmailHtml(value: string) {
  return value.replace(forbiddenTags, "").replace(eventAttributes, "").replace(javascriptUrls, "");
}
