/**
 * Markdown Cleaner & LLM Post-Processing Utility
 */

(function (global) {
  'use strict';

  function stripRemainingHtml(text) {
    if (!text || typeof text !== 'string') return '';
    // Strip HTML tags ONLY outside fenced code blocks and inline code
    const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
    for (let i = 0; i < parts.length; i++) {
      // Even indices are plain text outside code
      if (i % 2 === 0) {
        // Replace HTML tags like <div>, </p>, <span class="..."> with empty string
        parts[i] = parts[i].replace(/<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^>]*)?>/g, '');
      }
    }
    return parts.join('');
  }

  function sanitizeMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    let cleaned = markdown
      // Normalize CRLF to LF
      .replace(/\r\n/g, '\n')
      // Remove zero-width characters and unusual Unicode invisible chars
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Remove data: URLs (such as base64 images that bypassed initial filter)
      .replace(/!\[(.*?)\]\(data:image\/[a-zA-Z0-9+.\/-]+;base64,[^)]+\)/g, '')
      // Remove empty or whitespace-only links like [](url) or [   ](url)
      .replace(/\[\s*\]\([^)]+\)/g, '')
      // Remove duplicate empty headings (e.g. # \n or ## \n)
      .replace(/^#{1,6}\s*$/gm, '')
      // Trim trailing whitespace on lines
      .replace(/[ \t]+$/gm, '');

    // Convert any remaining raw HTML tags to clean markdown text outside code blocks
    cleaned = stripRemainingHtml(cleaned);

    return cleaned
      // Normalize excessive empty lines (3+ newlines down to 2)
      .replace(/\n{3,}/g, '\n\n')
      // Trim overall text
      .trim();
  }

  function generateFrontMatter(meta) {
    const title = (meta.title || '').replace(/"/g, '\\"');
    const url = meta.url || '';
    const dateExtracted = meta.dateExtracted || new Date().toISOString();
    const estimatedTokens = meta.estimatedTokens !== undefined ? meta.estimatedTokens : null;

    let fm = '---\n';
    fm += `title: "${title}"\n`;
    fm += `url: "${url}"\n`;
    fm += `date_extracted: "${dateExtracted}"\n`;
    if (estimatedTokens !== null) {
      fm += `estimated_tokens: ${estimatedTokens}\n`;
    }
    fm += '---\n\n';

    return fm;
  }

  const MarkdownCleaner = {
    sanitizeMarkdown: sanitizeMarkdown,
    generateFrontMatter: generateFrontMatter,
    stripRemainingHtml: stripRemainingHtml
  };

  global.MarkdownCleaner = MarkdownCleaner;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownCleaner;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)));
