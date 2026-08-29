/**
 * Token Estimator Utility
 * Heuristic token counting based on byte-pair / word-character heuristics
 * calibrated against common LLM tokenizers (tiktoken / cl100k_base / Llama 3).
 */

(function (global) {
  'use strict';

  function estimateTokens(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Heuristic analysis:
    // 1. English text typically averages ~4 characters per token (or ~0.75 words per token).
    // 2. Code, markdown formatting, symbols, and whitespace lead to higher token densities (~3.2 chars/token).
    // 3. CJK characters typically consume 1-2 tokens per character.

    const cjkRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g;
    const cjkMatches = text.match(cjkRegex) || [];
    const cjkCount = cjkMatches.length;

    // Non-CJK text
    const nonCjkText = text.replace(cjkRegex, ' ');
    const words = nonCjkText.trim().split(/\s+/).filter(Boolean);
    const nonCjkChars = nonCjkText.length;

    // Estimate based on blended word and character counts
    const wordBasedEstimate = words.length * 1.33;
    const charBasedEstimate = nonCjkChars / 3.8;
    const nonCjkTokens = Math.max(wordBasedEstimate, charBasedEstimate);

    // CJK characters average ~1.3 tokens per char in modern tokenizers
    const cjkTokens = cjkCount * 1.3;

    return Math.round(nonCjkTokens + cjkTokens);
  }

  function formatTokenCount(count) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
  }

  const TokenEstimator = {
    estimateTokens: estimateTokens,
    formatTokenCount: formatTokenCount
  };

  global.TokenEstimator = TokenEstimator;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenEstimator;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)));
