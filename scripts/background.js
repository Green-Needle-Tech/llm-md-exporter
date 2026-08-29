/**
 * ContextMark Background Service Worker (scripts/background.js)
 * Manages Context Menus, Keyboard Shortcuts, and extraction execution via scripting API.
 */

'use strict';

// Setup Context Menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copy-markdown-page',
    title: 'Export Page to Markdown',
    contexts: ['page', 'link', 'image']
  });

  chrome.contextMenus.create({
    id: 'copy-markdown-selection',
    title: 'Copy Selection as LLM Markdown',
    contexts: ['selection']
  });
});

// Helper to ensure scripts are injected into tab
async function ensureScriptsInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'lib/readability.js',
        'lib/turndown.js',
        'lib/turndown-plugin-gfm.js',
        'utils/token-estimator.js',
        'utils/markdown-cleaner.js',
        'scripts/content.js'
      ]
    });
  } catch (err) {
    console.warn('[ContextMark] Script injection check:', err);
  }
}

// Extraction executor
async function triggerMarkdownCopy(tabId, scope) {
  if (!tabId) return;

  try {
    await ensureScriptsInjected(tabId);

    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'EXTRACT_MARKDOWN',
      options: { scope }
    });

    if (response && response.success && response.data && response.data.markdown) {
      const markdown = response.data.markdown;

      // Copy text to clipboard via scripting API inside the tab context
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (textToCopy) => {
          navigator.clipboard.writeText(textToCopy);
        },
        args: [markdown]
      });
    } else if (response && !response.success) {
      console.error('[ContextMark] Extraction failed:', response.error);
    }
  } catch (err) {
    console.error('[ContextMark] Failed to trigger markdown copy:', err);
  }
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const scope = info.menuItemId === 'copy-markdown-selection' ? 'selection' : 'clean';
  await triggerMarkdownCopy(tab.id, scope);
});

// Handle Keyboard Commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-copy-markdown') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await triggerMarkdownCopy(tab.id, 'clean');
    }
  }
});
