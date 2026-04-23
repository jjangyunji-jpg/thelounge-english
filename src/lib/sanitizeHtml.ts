import DOMPurify from "dompurify";

/**
 * Sanitize untrusted HTML before rendering with dangerouslySetInnerHTML.
 *
 * Allows the rich-text formatting used by class notes / teaching materials
 * (TipTap output: tables, headings, lists, blockquotes, links, images, code,
 * highlights, callouts, embedded YouTube iframes) while stripping <script>,
 * inline event handlers, and other XSS vectors.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "target",
      "rel",
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "referrerpolicy",
      "loading",
    ],
    // Only allow iframes pointing at trusted embed providers
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
