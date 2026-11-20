/**
 * Zero-dependency isomorphic HTML sanitizer for Client, Edge runtime, and SSR.
 * Strips script tags, iframes, objects, embeds, inline event handlers, and dangerous URIs.
 */

const DANGEROUS_TAG_REGEX = /<(script|iframe|object|embed|style|template|applet|meta|link|base|form|input|button|textarea|select)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>|<(script|iframe|object|embed|style|template|applet|meta|link|base|form|input|button|textarea|select)\b[^>]*(?:\/?>|$)/gi;

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'span', 'strong', 'em', 'u', 's', 'sub', 'sup',
  'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'a', 'hr', 'del', 'ins',
  'mark', 'figure', 'figcaption', 'small'
]);

const ALLOWED_GLOBAL_ATTRS = new Set([
  'class', 'id', 'title', 'dir', 'lang', 'style'
]);

const ALLOWED_TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'download']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding']),
  th: new Set(['colspan', 'rowspan', 'scope', 'align']),
  td: new Set(['colspan', 'rowspan', 'align']),
  ol: new Set(['start', 'type', 'reversed']),
  li: new Set(['value']),
};

const SAFE_URL_PATTERN = /^(https?:|\/|#|mailto:|data:image\/(png|jpe?g|webp|gif|avif);base64,)/i;
const DANGEROUS_STYLE_PATTERN = /(expression|javascript|behavior|vbscript|url\s*\(|-moz-binding)/i;

function cleanAttributeValue(val: string): string {
  return val.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, ' ').trim();
}

function parseAndCleanAttributes(tagName: string, rawAttrs: string): string {
  const allowedForTag = ALLOWED_TAG_ATTRS[tagName] || new Set();
  const attrRegex = /([a-zA-Z0-9_\-:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const cleanedList: string[] = [];
  let isBlankTarget = false;
  let hasRel = false;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const rawName = match[1];
    const attrName = rawName.toLowerCase();
    const rawVal = match[2] ?? match[3] ?? match[4] ?? '';
    const attrVal = cleanAttributeValue(rawVal);

    // 1. Strictly block all event handlers (on* e.g. onload, onerror, onclick)
    if (attrName.startsWith('on')) {
      continue;
    }

    // 2. Check if attribute is allowed on this tag or globally
    if (!ALLOWED_GLOBAL_ATTRS.has(attrName) && !allowedForTag.has(attrName)) {
      continue;
    }

    // 3. Inspect style attributes for CSS injection / expression attacks
    if (attrName === 'style') {
      if (DANGEROUS_STYLE_PATTERN.test(attrVal)) {
        continue;
      }
      cleanedList.push(`style="${attrVal.replace(/"/g, '&quot;')}"`);
      continue;
    }

    // 4. Inspect URI attributes (href, src)
    if (attrName === 'href' || attrName === 'src') {
      // Decode potential URI escapes or HTML entities in URI scheme
      const normalizedUri = attrVal.replace(/&#[xX]?[0-9a-fA-F]+;/g, '').trim();
      if (!SAFE_URL_PATTERN.test(normalizedUri)) {
        continue;
      }
      cleanedList.push(`${attrName}="${attrVal.replace(/"/g, '&quot;')}"`);
      continue;
    }

    // 5. Track target="_blank" for a tags to add rel="noopener noreferrer"
    if (tagName === 'a' && attrName === 'target' && attrVal === '_blank') {
      isBlankTarget = true;
    }
    if (tagName === 'a' && attrName === 'rel') {
      hasRel = true;
    }

    cleanedList.push(`${attrName}="${attrVal.replace(/"/g, '&quot;')}"`);
  }

  if (tagName === 'a' && isBlankTarget && !hasRel) {
    cleanedList.push('rel="noopener noreferrer"');
  }

  return cleanedList.length > 0 ? ' ' + cleanedList.join(' ') : '';
}

/**
 * Sanitizes dirty HTML strings, stripping malicious script vectors while preserving safe markup.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  let html = dirty;

  // Multi-pass dangerous tags stripping (prevent nested <scr<script>ipt> evasion)
  for (let i = 0; i < 3; i++) {
    const prev = html;
    html = html.replace(DANGEROUS_TAG_REGEX, '');
    if (html === prev) break;
  }

  // Strip HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Tag rewriting and attribute filtering
  html = html.replace(/<(\/?)([a-zA-Z0-9_\-]+)([^>]*)>/g, (_full, isClose, rawTag, rawAttrs) => {
    const tagName = rawTag.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      return '';
    }

    if (isClose) {
      return `</${tagName}>`;
    }

    const cleanedAttrs = parseAndCleanAttributes(tagName, rawAttrs);
    const selfClosing = tagName === 'br' || tagName === 'hr' || tagName === 'img' ? ' /' : '';
    return `<${tagName}${cleanedAttrs}${selfClosing}>`;
  });

  // Strip dangling unclosed tags to prevent browser DOM auto-closing exploits
  while (/<[^>]*$/.test(html)) {
    const prev = html;
    html = html.replace(/<[^>]*$/g, '');
    if (html === prev) break;
  }

  return html;
}
