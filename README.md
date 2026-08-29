# ContextMark (llm-md-exporter)

> Extract clean, LLM-optimized Markdown from any web page for downstream AI prompts without token waste.

ContextMark is a Manifest V3 Chrome Extension designed for developers, researchers, and prompt engineers. It strips noisy non-semantic DOM elements (navigation, footers, sidebars, ads, scripts) and converts the core content into clean, token-efficient Markdown with YAML Front Matter metadata.

---

## Features

- **100% Local & Zero Data Egress:** All DOM parsing and Markdown conversions execute locally in-browser. No analytics, tracking, or external server calls.
- **Three Extraction Scopes:**
  - `Full Clean Page` (Default): Uses `@mozilla/readability` to isolate article content.
  - `Selected Text Only`: Extracts and formats highlighted page selections.
  - `Full DOM Raw`: Full document text conversion with basic script/style cleaning.
- **LLM Token Optimization:**
  - Automatic base64 data URI stripping to prevent prompt token bloat.
  - Resolves relative URLs to absolute URLs using `document.baseURI`.
  - Whitespace and blank line normalization.
  - Preserves fenced code blocks with language tags.
  - Formats tables with GitHub Flavored Markdown (GFM).
- **Front Matter Metadata:** Injects YAML headers with document title, source URL, ISO timestamp, and token counts.
- **Real-Time Token Counter:** Built-in heuristic BPE/word-character token estimator calibrated for modern LLMs.
- **Context Menus & Shortcut:** Right-click export and global shortcut (`Alt+Shift+C` / `Option+Shift+C`).

---

## Directory Structure

```
llm-md-exporter/
├── manifest.json              # Manifest V3 extension configuration
├── icons/                     # Extension icons (16px, 48px, 128px)
├── popup/
│   ├── popup.html             # Popup interface
│   ├── popup.css              # Dark theme styling
│   └── popup.js               # UI controller and clipboard/download logic
├── scripts/
│   ├── background.js          # Service worker (Context menus & shortcuts)
│   └── content.js             # Extractor script (Readability + Turndown)
├── lib/
│   ├── readability.js         # @mozilla/readability standalone bundle
│   ├── turndown.js            # Turndown HTML-to-Markdown converter
│   └── turndown-plugin-gfm.js # GitHub Flavored Markdown plugin
└── utils/
    ├── markdown-cleaner.js    # LLM post-processing and front matter generator
    └── token-estimator.js     # Token counting heuristic engine
```

---

## Installation & Usage

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Green-Needle-Tech/llm-md-exporter.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right.
4. Click **Load unpacked** and select the `llm-md-exporter` directory.
5. Click the ContextMark icon in your Chrome toolbar or use `Alt+Shift+C` (`Option+Shift+C` on macOS) to extract Markdown.

---

## License

MIT License.
