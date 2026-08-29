/**
 * ContextMark Content Script (scripts/content.js)
 * Coordinates page extraction, DOM cleaning, Turndown conversion, and sanitization.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__CONTEXTMARK_INJECTED__) {
    return;
  }
  window.__CONTEXTMARK_INJECTED__ = true;

  function initTurndown() {
    if (typeof TurndownService === 'undefined') {
      console.error('[ContextMark] TurndownService not found in context.');
      return null;
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    // Use GFM Plugin if available
    if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
      turndownService.use(turndownPluginGfm.gfm);
    }

    // Convert relative URLs to absolute & strip base64 data URIs
    turndownService.addRule('absolute-urls', {
      filter: ['a', 'img'],
      replacement: function (content, node) {
        if (node.tagName === 'A') {
          const href = node.getAttribute('href');
          if (!href) return content;
          try {
            const absoluteHref = new URL(href, document.baseURI).href;
            return `[${content}](${absoluteHref})`;
          } catch (e) {
            return `[${content}](${href})`;
          }
        }
        if (node.tagName === 'IMG') {
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || '';
          if (!src || src.startsWith('data:')) {
            return ''; // Strip base64 or empty sources
          }
          try {
            const absoluteSrc = new URL(src, document.baseURI).href;
            return `![${alt}](${absoluteSrc})`;
          } catch (e) {
            return `![${alt}](${src})`;
          }
        }
        return '';
      }
    });

    return turndownService;
  }

  function cleanDomNode(rootNode) {
    const nonSemanticSelectors = [
      'nav', 'header', 'footer', 'aside', 'script', 'style',
      'iframe', 'svg', 'noscript', 'canvas', 'form', 'button',
      '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
      '.ad', '.ads', '.advertisement', '.social-share', '.cookie-banner'
    ];
    
    rootNode.querySelectorAll(nonSemanticSelectors.join(', ')).forEach((el) => {
      el.remove();
    });
  }

  async function extractPageMarkdown(options = { scope: 'clean' }) {
    let contentHtml = '';
    let title = document.title || 'Untitled Page';
    const pageUrl = window.location.href;
    const turndownService = initTurndown();

    if (!turndownService) {
      throw new Error('Turndown conversion service failed to initialize.');
    }

    // 1. Selection Scope
    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : '';

    if (options.scope === 'selection') {
      if (!selectionText) {
        return {
          title,
          url: pageUrl,
          markdown: '',
          rawBody: '',
          estimatedTokens: 0,
          error: 'No text selected on the page.'
        };
      }

      // If selection exists, grab its HTML fragment if possible for formatting
      let selectionHtml = '';
      if (selection.rangeCount > 0) {
        const container = document.createElement('div');
        for (let i = 0; i < selection.rangeCount; i++) {
          container.appendChild(selection.getRangeAt(i).cloneContents());
        }
        selectionHtml = container.innerHTML;
      }

      let converted = selectionHtml ? turndownService.turndown(selectionHtml) : selectionText;
      converted = window.MarkdownCleaner ? window.MarkdownCleaner.sanitizeMarkdown(converted) : converted;

      const tokenCount = window.TokenEstimator ? window.TokenEstimator.estimateTokens(converted) : 0;
      const frontMatter = window.MarkdownCleaner
        ? window.MarkdownCleaner.generateFrontMatter({
            title,
            url: pageUrl,
            dateExtracted: new Date().toISOString(),
            estimatedTokens: tokenCount
          })
        : '';

      return {
        title,
        url: pageUrl,
        markdown: frontMatter + converted,
        bodyMarkdown: converted,
        estimatedTokens: tokenCount
      };
    }

    // 2. Full Clean Page Scope (Readability)
    if (options.scope === 'clean') {
      let readabilitySuccess = false;
      if (typeof Readability !== 'undefined') {
        try {
          const documentClone = document.cloneNode(true);
          const article = new Readability(documentClone).parse();
          if (article && article.content) {
            contentHtml = article.content;
            title = article.title || title;
            readabilitySuccess = true;
          }
        } catch (e) {
          console.warn('[ContextMark] Readability parsing fallback:', e);
        }
      }

      if (!readabilitySuccess) {
        const bodyClone = document.body.cloneNode(true);
        cleanDomNode(bodyClone);
        contentHtml = bodyClone.innerHTML;
      }
    } else {
      // 3. Full DOM Raw Scope
      const bodyClone = document.body.cloneNode(true);
      // Remove only executable scripts/styles for raw mode
      bodyClone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
      contentHtml = bodyClone.innerHTML;
    }

    // Convert HTML to Markdown
    let markdown = turndownService.turndown(contentHtml);

    // LLM Post-Processing Cleanup
    if (window.MarkdownCleaner) {
      markdown = window.MarkdownCleaner.sanitizeMarkdown(markdown);
    }

    const tokenCount = window.TokenEstimator ? window.TokenEstimator.estimateTokens(markdown) : 0;
    const frontMatter = window.MarkdownCleaner
      ? window.MarkdownCleaner.generateFrontMatter({
          title,
          url: pageUrl,
          dateExtracted: new Date().toISOString(),
          estimatedTokens: tokenCount
        })
      : '';

    return {
      title,
      url: pageUrl,
      markdown: frontMatter + markdown,
      bodyMarkdown: markdown,
      estimatedTokens: tokenCount
    };
  }

  // Message listener for background / popup queries
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_MARKDOWN') {
      extractPageMarkdown(request.options || { scope: 'clean' })
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
      return true; // Keep message channel open for async response
    }
  });
})();
