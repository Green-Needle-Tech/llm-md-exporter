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

  function initTurndown(baseUri) {
    if (typeof TurndownService === 'undefined') {
      console.error('[ContextMark] TurndownService not found in context.');
      return null;
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    // Use GFM Plugin if available for tables, strikethroughs, and tasklists
    if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
      turndownService.use(turndownPluginGfm.gfm);
    }

    // Custom Rule: Absolute URLs and strip base64 image bloat
    turndownService.addRule('absolute-urls', {
      filter: ['a', 'img'],
      replacement: function (content, node) {
        const uri = baseUri || document.baseURI || window.location.href;
        const tag = (node.nodeName || node.tagName || '').toUpperCase();

        if (tag === 'A') {
          const href = node.getAttribute('href');
          if (!href || href.startsWith('javascript:')) return content;
          try {
            const absoluteHref = new URL(href, uri).href;
            return `[${content}](${absoluteHref})`;
          } catch (e) {
            return `[${content}](${href})`;
          }
        }

        if (tag === 'IMG') {
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || '';
          if (!src || src.startsWith('data:')) {
            return ''; // Strip base64 data URIs to conserve LLM tokens
          }
          try {
            const absoluteSrc = new URL(src, uri).href;
            return `![${alt}](${absoluteSrc})`;
          } catch (e) {
            return `![${alt}](${src})`;
          }
        }

        return '';
      }
    });

    // Custom Rule: Preserve code block syntax highlighting language on <pre> or <code>
    turndownService.addRule('fencedCodeBlockWithLang', {
      filter: function (node, options) {
        return (
          options.codeBlockStyle === 'fenced' &&
          (node.nodeName === 'PRE' || node.tagName === 'PRE') &&
          node.firstChild &&
          (node.firstChild.nodeName === 'CODE' || node.firstChild.nodeName === '#text')
        );
      },
      replacement: function (content, node, options) {
        const codeNode = node.querySelector ? node.querySelector('code') || node : node;
        const className = (node.getAttribute('class') || '') + ' ' + (codeNode.getAttribute('class') || '');
        const match = className.match(/(?:lang|language)-([a-zA-Z0-9_+-]+)/i);
        const language = match ? match[1] : '';
        const code = codeNode.textContent || node.textContent || '';
        return '\n\n```' + language + '\n' + code.replace(/\n+$/, '') + '\n```\n\n';
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
    const baseUri = document.baseURI || pageUrl;
    const turndownService = initTurndown(baseUri);

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
          bodyMarkdown: '',
          estimatedTokens: 0,
          error: 'No text selected on the page.'
        };
      }

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
      const ReadabilityClass = (typeof Readability !== 'undefined' && Readability.Readability)
        ? Readability.Readability
        : (typeof Readability === 'function' ? Readability : null);

      if (ReadabilityClass) {
        try {
          const documentClone = document.cloneNode(true);
          const article = new ReadabilityClass(documentClone).parse();
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
