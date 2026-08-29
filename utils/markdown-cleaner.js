/**
 * Markdown Cleaner & LLM Post-Processing Utility
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownCleaner = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function sanitizeMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    return markdown
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
      .replace(/[ \t]+$/gm, '')
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

  return {
    sanitizeMarkdown: sanitizeMarkdown,
    generateFrontMatter: generateFrontMatter
  };
}));
