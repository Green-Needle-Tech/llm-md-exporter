/**
 * ContextMark Popup Controller (popup/popup.js)
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const tokenCountEl = document.getElementById('token-count');
  const previewEl = document.getElementById('markdown-preview');
  const charCountEl = document.getElementById('char-count');
  const statusBarEl = document.getElementById('status-bar');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const optFrontmatter = document.getElementById('opt-frontmatter');
  const segmentBtns = document.querySelectorAll('.segment-btn');

  let currentExtraction = null;
  let currentScope = 'clean';

  function showStatus(message, isError = false, duration = 2500) {
    statusBarEl.textContent = message;
    statusBarEl.className = isError ? 'status-bar error' : 'status-bar';
    if (duration > 0) {
      setTimeout(() => {
        statusBarEl.className = 'status-bar hidden';
      }, duration);
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function ensureContentScripts(tabId) {
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
    } catch (e) {
      console.warn('Script injection notice:', e);
    }
  }

  function getMarkdownOutput() {
    if (!currentExtraction) return '';
    const includeFm = optFrontmatter.checked;
    
    if (includeFm) {
      return currentExtraction.markdown || '';
    } else {
      return currentExtraction.bodyMarkdown || '';
    }
  }

  function updateView() {
    const md = getMarkdownOutput();
    previewEl.value = md;
    charCountEl.textContent = `${md.length.toLocaleString()} chars`;

    const tokens = window.TokenEstimator ? window.TokenEstimator.estimateTokens(md) : 0;
    tokenCountEl.textContent = window.TokenEstimator ? window.TokenEstimator.formatTokenCount(tokens) : tokens;
  }

  async function runExtraction() {
    previewEl.value = 'Extracting and optimizing markdown...';
    btnCopy.disabled = true;
    btnDownload.disabled = true;

    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      previewEl.value = 'Unable to access current tab.';
      showStatus('No active web tab detected.', true);
      return;
    }

    // Ignore restricted URLs
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
      previewEl.value = 'Cannot extract from browser internal pages.';
      showStatus('Internal browser page.', true);
      return;
    }

    try {
      await ensureContentScripts(tab.id);

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'EXTRACT_MARKDOWN',
        options: { scope: currentScope }
      });

      if (response && response.success && response.data) {
        currentExtraction = response.data;
        updateView();
        btnCopy.disabled = false;
        btnDownload.disabled = false;
      } else {
        const errMsg = response && response.error ? response.error : 'Unknown extraction error';
        previewEl.value = `Error: ${errMsg}`;
        showStatus(errMsg, true);
      }
    } catch (err) {
      previewEl.value = `Error: ${err.message || String(err)}`;
      showStatus('Failed to communicate with tab.', true);
    }
  }

  // Segmented control scope switch
  segmentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const radio = btn.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      currentScope = btn.getAttribute('data-scope') || 'clean';
      runExtraction();
    });
  });

  // Front matter checkbox toggle
  optFrontmatter.addEventListener('change', () => {
    updateView();
  });

  // Copy Action
  btnCopy.addEventListener('click', async () => {
    const md = getMarkdownOutput();
    if (!md) {
      showStatus('Nothing to copy!', true);
      return;
    }

    try {
      await navigator.clipboard.writeText(md);
      showStatus('Copied to clipboard! ✓');
    } catch (e) {
      // Fallback copy using textarea selection
      previewEl.select();
      document.execCommand('copy');
      showStatus('Copied to clipboard! ✓');
    }
  });

  // Download Action
  btnDownload.addEventListener('click', () => {
    const md = getMarkdownOutput();
    if (!md) {
      showStatus('Nothing to download!', true);
      return;
    }

    const title = (currentExtraction && currentExtraction.title ? currentExtraction.title : 'page')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50) || 'document';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Download initiated! ✓');
  });

  // Initial Extraction
  await runExtraction();
});
