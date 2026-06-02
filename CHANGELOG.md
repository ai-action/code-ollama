# Changelog

## [0.23.0](https://github.com/ai-action/code-ollama/compare/v0.22.0...v0.23.0) (2026-06-02)


### Features

* **plan:** improve plan mode with collaborative review ([e45c8f1](https://github.com/ai-action/code-ollama/commit/e45c8f157172658977fa2e2895a325889bc6d268))


### Bug Fixes

* **Chat:** fix plan mode write-attempt handling ([16c38a0](https://github.com/ai-action/code-ollama/commit/16c38a0399d66486589eb418848fcc479ea65023))
* **Chat:** make spinner in plan mode stable to prevent flicker ([9f98944](https://github.com/ai-action/code-ollama/commit/9f98944aba9a379fdbbd38a5deed1d40ff7df863))
* **plan:** fix plan approval ([4799c79](https://github.com/ai-action/code-ollama/commit/4799c797a1ba9ab90dcf1d019dd6cc8018db19ce))
* **PlanReview:** render plan content in markdown ([4a377af](https://github.com/ai-action/code-ollama/commit/4a377af655d3aca873ca401ed3d030640d68a610))
* **prompt:** make plan mode more active rather than passive ([5bf840a](https://github.com/ai-action/code-ollama/commit/5bf840ac9d4ee05be29108e8c695c00b3e667320))

## [0.22.0](https://github.com/ai-action/code-ollama/compare/v0.21.1...v0.22.0) (2026-06-02)


### Features

* **chat:** add tool diff rendering ([01cfdc1](https://github.com/ai-action/code-ollama/commit/01cfdc14989d6b925bc4e14c54b413585f134086))


### Bug Fixes

* **CodeBlock:** style the diff with colors ([aaea113](https://github.com/ai-action/code-ollama/commit/aaea113d459b28cc1965fc6d0c83fd17ae38c6cc))
* **prompt:** tighten system prompt with tool-use and path rules ([fded577](https://github.com/ai-action/code-ollama/commit/fded5776ee65f8c0e6fbc1b6d19005cd14a63b22))
* **tools:** add compact tool-argument headers ([5c04d85](https://github.com/ai-action/code-ollama/commit/5c04d85a6a92b5dc8d3b08dd2e51c045e6c2cc8c))
* **tools:** update `grep_search` to try common phrases for multi-word queries ([85f3f05](https://github.com/ai-action/code-ollama/commit/85f3f054cafa1ea6cdb3fcc1accf7f51a302e03a))
* **utils:** add guarded continuation nudge for no tool call ([6a3b6da](https://github.com/ai-action/code-ollama/commit/6a3b6dac0616491b273815394e4f6808a43e6409))
* **utils:** sanitize assistant message ([ecbbad1](https://github.com/ai-action/code-ollama/commit/ecbbad159ee21300f3a9ff0a349bdcb6684f6540))

## [0.21.1](https://github.com/ai-action/code-ollama/compare/v0.21.0...v0.21.1) (2026-06-01)


### Bug Fixes

* **tools:** improve tool-call reliability ([5d577fc](https://github.com/ai-action/code-ollama/commit/5d577fc6732979fda1e05ffdb4fbeeba7b98a12f))

## [0.21.0](https://github.com/ai-action/code-ollama/compare/v0.20.0...v0.21.0) (2026-05-23)


### Features

* **update:** add update available check ([29e819c](https://github.com/ai-action/code-ollama/commit/29e819c3b7327bf7dbafb613891d8248cc8f2f0c))


### Bug Fixes

* **App:** render messages after UpdateBanner is loaded ([76429d7](https://github.com/ai-action/code-ollama/commit/76429d7ffe0f73630898f91e8c314a3ee52c9a78))

## [0.20.0](https://github.com/ai-action/code-ollama/compare/v0.19.1...v0.20.0) (2026-05-22)


### Features

* **session:** block resume and error when session directory mismatches cwd ([38fe3ee](https://github.com/ai-action/code-ollama/commit/38fe3eea70e3436fda3913c17e26881f978226bf))
* **session:** scope sessions to the working directory ([0b04c3d](https://github.com/ai-action/code-ollama/commit/0b04c3dc80c7ab636bf9b042698b1b51a8c6f087))
* **session:** skip directory check for legacy sessions without directory field ([5a0d2ac](https://github.com/ai-action/code-ollama/commit/5a0d2ac02e275000ade423a3bdb91364fa300bd8))

## [0.19.1](https://github.com/ai-action/code-ollama/compare/v0.19.0...v0.19.1) (2026-05-22)


### Bug Fixes

* **tools:** validate required string args before dispatch ([8ec0751](https://github.com/ai-action/code-ollama/commit/8ec0751436acb5dcbf99851a2248260c75ce3c84))

## [0.19.0](https://github.com/ai-action/code-ollama/compare/v0.18.2...v0.19.0) (2026-05-20)


### Features

* **images:** add image attachment support to TUI chat ([25244d1](https://github.com/ai-action/code-ollama/commit/25244d1e20e02bb276a0de077d3a3bb5460b9f27))


### Bug Fixes

* **ChatInput:** don't render placeholder if an image is attached ([374077e](https://github.com/ai-action/code-ollama/commit/374077e41708ba40266f366649b017dde9493072))
* **ChatInput:** render error above the prompt ([5435e72](https://github.com/ai-action/code-ollama/commit/5435e7216d450de2a5e1791a2706bb4130c92b55))
* **clipboard:** show short friendly message for clipboard failure ([fcf3af7](https://github.com/ai-action/code-ollama/commit/fcf3af75c157cfaa426994db4276783bf6c24bf4))
* **SelectPrompt:** fix fresh-start fast selection error ([e5c2def](https://github.com/ai-action/code-ollama/commit/e5c2defe364856b15f526fa242c31e49207f737c))

## [0.18.2](https://github.com/ai-action/code-ollama/compare/v0.18.1...v0.18.2) (2026-05-19)


### Bug Fixes

* **ModelManager:** handle Esc/Ctrl+C for error state ([a83a4e1](https://github.com/ai-action/code-ollama/commit/a83a4e159cb26eea2ced134e6839d245e472d9c8))
* **ollama:** add ollama health check to app readiness ([0a628c4](https://github.com/ai-action/code-ollama/commit/0a628c4258b7f59f62393925bbbf15de045f6c82))

## [0.18.1](https://github.com/ai-action/code-ollama/compare/v0.18.0...v0.18.1) (2026-05-18)


### Bug Fixes

* **app:** check model is configured before loading chat ([affe03b](https://github.com/ai-action/code-ollama/commit/affe03b33c651eab5503d1aa0ce48d3cbde28499))

## [0.18.0](https://github.com/ai-action/code-ollama/compare/v0.17.0...v0.18.0) (2026-05-17)


### Features

* **models:** add `/model` manager ([c020a3e](https://github.com/ai-action/code-ollama/commit/c020a3e84c0f3754b67a26136174b76593df7200))


### Bug Fixes

* **ModelManager:** filter out installed models in ModelDownloadView ([8002341](https://github.com/ai-action/code-ollama/commit/800234107870944d91d4c18bc22ccd039a354ac7))
* **ModelManager:** remove current model from delete options ([c28d5e1](https://github.com/ai-action/code-ollama/commit/c28d5e1841abd2cc6e24d97384cca80d599d3ea6))

## [0.17.0](https://github.com/ai-action/code-ollama/compare/v0.16.0...v0.17.0) (2026-05-16)


### Features

* **theme:** add `/theme` command ([83f2ea8](https://github.com/ai-action/code-ollama/commit/83f2ea87132850f492682babab70497bf5b8571c))


### Bug Fixes

* **Markdown:** move the color policy to the caller ([3d44b1b](https://github.com/ai-action/code-ollama/commit/3d44b1ba023f7d0efb077e4bb9a2ee7cdb64771d))
* **Markdown:** stop applying color and let marked-terminal own coloring ([5eb8518](https://github.com/ai-action/code-ollama/commit/5eb851836a3c1328d1f239bd3cdf52056b453404))
* **Messages:** format markdown during assistant streaming ([d09f5ca](https://github.com/ai-action/code-ollama/commit/d09f5ca638904a178005416aca79131eaa48c9df))
* **Messages:** make streaming assistant text go through markdown rendering ([293bde9](https://github.com/ai-action/code-ollama/commit/293bde959743aa69135868ede29de06beaf4fc29))
* **Messages:** stop reflowing already-stable content ([476b9b3](https://github.com/ai-action/code-ollama/commit/476b9b36037037437a00e4a9465d5432f548abca))

## [0.16.0](https://github.com/ai-action/code-ollama/compare/v0.15.1...v0.16.0) (2026-05-16)


### Features

* **Chat:** add blank-input prompt history navigation ([42d4d0a](https://github.com/ai-action/code-ollama/commit/42d4d0a3d4113d8f20649bb4d49c9757c141f8a6))

## [0.15.1](https://github.com/ai-action/code-ollama/compare/v0.15.0...v0.15.1) (2026-05-15)


### Bug Fixes

* **Markdown:** implement sticky-height streaming to fix layout jump ([bb13281](https://github.com/ai-action/code-ollama/commit/bb1328143dee8f045a5960f728c0077568f34009))

## [0.15.0](https://github.com/ai-action/code-ollama/compare/v0.14.2...v0.15.0) (2026-05-15)


### Features

* **SessionManager:** add open session submenu ([47e42b0](https://github.com/ai-action/code-ollama/commit/47e42b078542d20b41f081112f170fefeba87994))


### Bug Fixes

* **SessionManager:** remove active session from "Open session" ([7bcf706](https://github.com/ai-action/code-ollama/commit/7bcf7065d0ed24920bade84c5160054f2236aea5))
* **SessionManager:** truncate session option labels when they get long ([158e3a5](https://github.com/ai-action/code-ollama/commit/158e3a58d4fe027a0d49662fac95a971ad0b7ea2))

## [0.14.2](https://github.com/ai-action/code-ollama/compare/v0.14.1...v0.14.2) (2026-05-15)


### Bug Fixes

* **CodeBlock:** fix fenced-block regex ([754d1f6](https://github.com/ai-action/code-ollama/commit/754d1f63cf91a6eed0e59d4e991ce8cf221ec522))
* **CodeBlock:** render nested ambiguous markdown fence as raw ([69cffe7](https://github.com/ai-action/code-ollama/commit/69cffe7387a5ae10e6ae4a6595323275d56a39da))
* **Markdown:** fix markdown rendering issue ([ee03053](https://github.com/ai-action/code-ollama/commit/ee03053be5bac338bc46dd5a75b6a7970981e5d6))
* **Messages:** stabilize streaming inline markdown ([495f07e](https://github.com/ai-action/code-ollama/commit/495f07ef3fc8c930caf916f64bbb27ea88dfa9e7))

## [0.14.1](https://github.com/ai-action/code-ollama/compare/v0.14.0...v0.14.1) (2026-05-14)


### Bug Fixes

* **TextInput:** dim the placeholder line correctly ([fecafa0](https://github.com/ai-action/code-ollama/commit/fecafa020f005391f6c5ad94f7572eae760ad266))
* **TextInput:** fix `TextInput` overflow and wrapped cursor rendering ([34f2f3a](https://github.com/ai-action/code-ollama/commit/34f2f3acc6ba36d1dace827c129b870bfcea6106))
* **TextInput:** move cursor to start and end with Ctrl+A and Ctrl+E ([9ac2926](https://github.com/ai-action/code-ollama/commit/9ac2926b42e2d1b34748a5075ddab7793ec75f6f))

## [0.14.0](https://github.com/ai-action/code-ollama/compare/v0.13.1...v0.14.0) (2026-05-13)


### Features

* **screen:** print resume session hint on app exit ([b65fc08](https://github.com/ai-action/code-ollama/commit/b65fc08a2d7858f8a9ccb4d25671ff0bc179d87f))
* **session:** add persistent session storage ([a649cc9](https://github.com/ai-action/code-ollama/commit/a649cc9c972c9979db5153b5624697c47aa7510c))


### Bug Fixes

* **App:** call `deleteSessionIfEmpty` when switching to new session ([74f1b2f](https://github.com/ai-action/code-ollama/commit/74f1b2f189fd427998aabd185e6670f410e6d8a5))
* **App:** clear screen for new or resume session ([14e7fb9](https://github.com/ai-action/code-ollama/commit/14e7fb986d8e8fa3524bf916c9436741ec9f7b9c))
* **App:** don't throw error when continuing existing session ([fedde1f](https://github.com/ai-action/code-ollama/commit/fedde1f4ffdd4dc8139301b92f770b564f9a9df4))
* **SessionManager:** don't change layout after session is deleted ([a1b4eb6](https://github.com/ai-action/code-ollama/commit/a1b4eb6dc2d9d028b8008f8be4ac8121e3d79c47))
* **SessionManager:** fix session delete error ([af09764](https://github.com/ai-action/code-ollama/commit/af09764942c949988b45d548d7d20438161a9089))
* **SessionManager:** refresh options after session delete ([c7b9038](https://github.com/ai-action/code-ollama/commit/c7b9038190d379ca4071baa891d4dfe6571af0f2))
* **session:** prune empty sessions on app exit ([566776d](https://github.com/ai-action/code-ollama/commit/566776d2812e18a150155563427c5a450ca02df0))

## [0.13.1](https://github.com/ai-action/code-ollama/compare/v0.13.0...v0.13.1) (2026-05-11)


### Bug Fixes

* **Markdown:** add LaTeX math support ([d88374c](https://github.com/ai-action/code-ollama/commit/d88374c8cf7c376365b26e8776763be78f0275ec))
* **Markdown:** handle frac, subscript, superscript, and spacing in LaTeX ([c978ef6](https://github.com/ai-action/code-ollama/commit/c978ef6956a3f21a9ec7cd1c115b041889f90204))

## [0.13.0](https://github.com/ai-action/code-ollama/compare/v0.12.0...v0.13.0) (2026-05-11)


### Features

* **tools:** add `web_fetch` tool via Jina Reader ([ee47649](https://github.com/ai-action/code-ollama/commit/ee4764992b419e71d435ba8dedd7cef9442f93f9))

## [0.12.0](https://github.com/ai-action/code-ollama/compare/v0.11.0...v0.12.0) (2026-05-10)

### Features

- **tools:** add `web_search` with SearXNG and `/search` command ([a14dcfb](https://github.com/ai-action/code-ollama/commit/a14dcfbd5c1d25e71136d26b61712352e568ac6b))

### Bug Fixes

- **tools:** escape backslashes in grepSearch shell args ([b8144cc](https://github.com/ai-action/code-ollama/commit/b8144ccad8e947812af134c1bbcbdb605ebf76cf))
- **utils:** prevent double-unescaping in decodeHtml by moving `&amp;` replacement last ([d805db9](https://github.com/ai-action/code-ollama/commit/d805db9c520d99b43c500625a5e6325c192ffeb3))

## [0.11.0](https://github.com/ai-action/code-ollama/compare/v0.10.0...v0.11.0) (2026-05-10)

### Features

- **FileSuggestions:** sort files with dot files at the bottom ([3d19aa9](https://github.com/ai-action/code-ollama/commit/3d19aa9b1ce9abaf897b152a05f19d4e5ee38196))

### Bug Fixes

- **ModelPicker:** prevent useInput during model loading to avoid yoga-layout WASM error ([40c0338](https://github.com/ai-action/code-ollama/commit/40c0338ce89da29d9b0b1c3418e5ff760a1f5643))

## [0.10.0](https://github.com/ai-action/code-ollama/compare/v0.9.1...v0.10.0) (2026-05-10)

### Features

- **Footer:** display active model ([f6b0ae4](https://github.com/ai-action/code-ollama/commit/f6b0ae494c0726f08eacc87eb527cf278de049c4))
- **SelectPrompt:** cancel on Ctrl+C ([6a34ef6](https://github.com/ai-action/code-ollama/commit/6a34ef66bd0ae28812068e32eac4ef3a1498d00d))

## [0.9.1](https://github.com/ai-action/code-ollama/compare/v0.9.0...v0.9.1) (2026-05-09)

### Bug Fixes

- **App:** implement native-scrollback low-flicker tui ([9a0506c](https://github.com/ai-action/code-ollama/commit/9a0506c42a92f1191216925f6118af1469d0a9ff))
- **Chat:** persist syntax highlighting in CodeBlock and Markdown after streaming ([cc1e3f9](https://github.com/ai-action/code-ollama/commit/cc1e3f976eec4b69529fd99ac1c959a04957d841))
- **CodeBlock:** fix regex to anchor closing fence at line start ([d2286f0](https://github.com/ai-action/code-ollama/commit/d2286f045abfa39323e405816b3ba16d0f959650))
- **CodeBlock:** support fenced blocks with 3+ backticks ([b4900d8](https://github.com/ai-action/code-ollama/commit/b4900d82f331c7ef36d824781880c9695e66b54d))
- **Header:** render Header with Static ([ff29431](https://github.com/ai-action/code-ollama/commit/ff29431d45793ae2c572ae7672b443a0ece07c6f))
- **Input:** show `FileSuggestions` with `@` before input text ([31aa4d3](https://github.com/ai-action/code-ollama/commit/31aa4d3689960f3e4999ed016256bc840e0e0a63))
- **Markdown:** fix hr overflow and add margin-top to chat input ([8e690fb](https://github.com/ai-action/code-ollama/commit/8e690fb6c550fcc30b1e1a027cd0b6fbea06da37))
- **screen:** fix screen reset and double cursor from command `/clear` ([71cf7f8](https://github.com/ai-action/code-ollama/commit/71cf7f806eaf5e0aa3a1696ea833903994c80528))
- **TextInput:** prevent cursor jump when typing after moving left ([ce8887d](https://github.com/ai-action/code-ollama/commit/ce8887dacee3dea99671a5e28ee21b25b8ee48c0))
- **tui:** disable `incrementalRendering` to fix repaint bug ([a0efdce](https://github.com/ai-action/code-ollama/commit/a0efdce70732dfeee23a418dc8d8d1950edadc28))

### Performance Improvements

- **tui:** add back `incrementalRendering` ([eac595b](https://github.com/ai-action/code-ollama/commit/eac595bb324686bbe81b8a2e2e027e9f642213a4))

## [0.9.0](https://github.com/ai-action/code-ollama/compare/v0.8.0...v0.9.0) (2026-05-09)

### Features

- **CodeBlock:** add syntax highlighting for code blocks ([c3fc04d](https://github.com/ai-action/code-ollama/commit/c3fc04d4404034908e59ff63256db0de9bd825e0))
- **Messages:** render Markdown ([fe6594e](https://github.com/ai-action/code-ollama/commit/fe6594e7f4bc9f39716e7e066877cd0fc45842d5))

### Bug Fixes

- **CodeBlock:** change syntax highlighting theme to `github-light` ([86058d1](https://github.com/ai-action/code-ollama/commit/86058d1389300417cfecae8340e79c74b07486e1))
- **Markdown:** remove trailing whitespace from `marked-terminal` output ([06427f4](https://github.com/ai-action/code-ollama/commit/06427f4c5c64eabf0fa763436a1a182ae2cf2683))
- **Messages:** add left and right margin for agent response ([cc2000a](https://github.com/ai-action/code-ollama/commit/cc2000a3f5288c56482f8fba77e4c8f2e5a63eb8))
- **Messages:** render markdown only for assistant messages ([8d4e468](https://github.com/ai-action/code-ollama/commit/8d4e4681c89926caac53fdefbe20a2295c5075a6))
- **Messages:** render system messages raw without parsing ([710f653](https://github.com/ai-action/code-ollama/commit/710f6535e9a537fff5c98bc815f056d6c42e7d4f))
- **TextInput:** fix cursor position ([2e58d29](https://github.com/ai-action/code-ollama/commit/2e58d2941c964ab83ea3d3910cca81c091d80187))
- **TextInput:** reset cursor back to position 0 when value is empty ([39f70b2](https://github.com/ai-action/code-ollama/commit/39f70b2b5a0a493318c7db9358262392b0706b52))

### Performance Improvements

- **components:** replace with controlled TextInput to stop screen flicker ([c3fa259](https://github.com/ai-action/code-ollama/commit/c3fa259600f1bfed23cc3f8e69d967c7f982b932))
- **TextInput:** consolidate 3 fragments into 1 element ([27c3b1b](https://github.com/ai-action/code-ollama/commit/27c3b1b5f74e45e49d2e28c8ea66562b170b044e))

## [0.8.0](https://github.com/ai-action/code-ollama/compare/v0.7.0...v0.8.0) (2026-05-09)

### Features

- **Chat:** interrupt agent execution with Ctrl+C or Esc key ([60f56ae](https://github.com/ai-action/code-ollama/commit/60f56ae54bcabbb7174d94eb6cf09ca838fc4246))

### Bug Fixes

- **Chat:** don't ask for tool call after rejection ([0aea77c](https://github.com/ai-action/code-ollama/commit/0aea77cf66870ea68a4752ebd8c591db93984fb1))
- **Chat:** don't show turn aborted message ([a007bd5](https://github.com/ai-action/code-ollama/commit/a007bd5853fbd81572b4d35171a22a9ef4aa42a2))

## [0.7.0](https://github.com/ai-action/code-ollama/compare/v0.6.1...v0.7.0) (2026-05-08)

### Features

- **command:** add `/exit` that exits the tui ([6a74a12](https://github.com/ai-action/code-ollama/commit/6a74a12c834a28dc921fbeb66fbe58836bdf2a53))

## [0.6.1](https://github.com/ai-action/code-ollama/compare/v0.6.0...v0.6.1) (2026-05-08)

### Bug Fixes

- **Chat:** make Enter key behave the same as Tab key for FileSuggestions ([8f07da8](https://github.com/ai-action/code-ollama/commit/8f07da885f3fb9416cd441ea2fff78a3794f031c))

## [0.6.0](https://github.com/ai-action/code-ollama/compare/v0.5.0...v0.6.0) (2026-05-08)

### Features

- **Chat:** add FileSuggestions to Input with `@` mention ([ae35cec](https://github.com/ai-action/code-ollama/commit/ae35cec79b239737dd453cd8b68a310776cdcde8))
- **Chat:** add Input placeholder ([981711b](https://github.com/ai-action/code-ollama/commit/981711b252bbf54624dd2bb4428abec8ceb80160))
- **Chat:** use Ctrl+C to clear dirty Input ([692042a](https://github.com/ai-action/code-ollama/commit/692042a472a4189ca8e2434b6d23f5c8b817f07c))

## [0.5.0](https://github.com/ai-action/code-ollama/compare/v0.4.0...v0.5.0) (2026-05-07)

### Features

- **Chat:** show CommandMenu below Input when slash command is typed ([f76c6d8](https://github.com/ai-action/code-ollama/commit/f76c6d819b4eb4596fcce3c9d5e25e11038254d6))

## [0.4.0](https://github.com/ai-action/code-ollama/compare/v0.3.1...v0.4.0) (2026-05-07)

### Features

- **command:** add `/clear` that resets chat session and tui ([8a6147c](https://github.com/ai-action/code-ollama/commit/8a6147c23957de88e91628c577ce854f55011051))

### Bug Fixes

- **agents:** reset system message after `/clear` command ([5635427](https://github.com/ai-action/code-ollama/commit/5635427b00d979c145eb80293def7a663a2ff6e8))
- **tui:** keep header and footer after clear ([2aca452](https://github.com/ai-action/code-ollama/commit/2aca452f8c0f06a931005603aa141a6002a82ecd))
- **tui:** raise ink maxFps to 60 to stop flickering ([0da7a75](https://github.com/ai-action/code-ollama/commit/0da7a752cc19669a48c3a5b39ef7cb403c36e1e9))
- **tui:** remove `alternateScreen` to bring back terminal scrollback ([e73c35f](https://github.com/ai-action/code-ollama/commit/e73c35fe46b4a86cd176b5de625c240553254b3c))
- **tui:** remove duplicate cursor from `/clear` command ([66a323c](https://github.com/ai-action/code-ollama/commit/66a323c8788e16c6e06cc52fc9975d7618250787))
- **tui:** use ink's screen clear and render in alternate screen ([cbffb2c](https://github.com/ai-action/code-ollama/commit/cbffb2c4290e4136f1837b1750e55a6bbae92bf3))

### Performance Improvements

- **Chat:** reduce render churn via cache and memo ([0a719e2](https://github.com/ai-action/code-ollama/commit/0a719e23e78f20bd6d5afba59730782fff7f07f1))
- **tui:** enable `incrementalRendering` to prevent flicker ([8127347](https://github.com/ai-action/code-ollama/commit/812734739247b72a6828d14b0268ec59da2eea24))

## [0.3.1](https://github.com/ai-action/code-ollama/compare/v0.3.0...v0.3.1) (2026-05-07)

### Bug Fixes

- **ModelPicker:** close select prompt if current model is chosen ([92d6f47](https://github.com/ai-action/code-ollama/commit/92d6f47fd17907c8b3c22cd4afc2357e8d3087a7))
- **ModelPicker:** show current model at the top of the select options ([eb75012](https://github.com/ai-action/code-ollama/commit/eb75012463d8eec0580d0669a1426c0024a6d028))

## [0.3.0](https://github.com/ai-action/code-ollama/compare/v0.2.1...v0.3.0) (2026-05-06)

### Features

- **tui:** add plan mode ([e04eef2](https://github.com/ai-action/code-ollama/commit/e04eef28b55ba1a68efdf0a54c27b82e5846547a))

### Bug Fixes

- **Chat:** check if plan is executable before showing PlanApproval ([8d4ecfe](https://github.com/ai-action/code-ollama/commit/8d4ecfe8627c330f43953adacd12d10877f155ec))
- **Chat:** prevent destructive tools in plan mode ([f4c57f8](https://github.com/ai-action/code-ollama/commit/f4c57f81f213121bc330c15cde6f3af2132ce4c5))
- **Chat:** remind the agent to display a checklist plan when blocked ([6838916](https://github.com/ai-action/code-ollama/commit/6838916053f5d684cddf7aa28a4897e88de387e4))
- **Chat:** stop representing a blocked call as an ordinary tool result ([dd6400f](https://github.com/ai-action/code-ollama/commit/dd6400fbdf55c498bcd713f50fcce4b27db0847d))

## [0.2.1](https://github.com/ai-action/code-ollama/compare/v0.2.0...v0.2.1) (2026-05-06)

### Bug Fixes

- **tui:** stabilize chat input rendering ([f7bdabd](https://github.com/ai-action/code-ollama/commit/f7bdabd96893537dea768e4f56a1a1621c769dba))

### Performance Improvements

- **tui:** don't regenerate command suggestions in chat input ([26c28ec](https://github.com/ai-action/code-ollama/commit/26c28ec8cecd68d7dd4dfdb4af514698e2cdd8fb))

## [0.2.0](https://github.com/ai-action/code-ollama/compare/v0.1.1...v0.2.0) (2026-05-05)

### Features

- **tools:** add edit_file tool ([9823cae](https://github.com/ai-action/code-ollama/commit/9823caebc61ebc523ffe1c1cc17dadb24695b623))

## [0.1.1](https://github.com/ai-action/code-ollama/compare/v0.1.0...v0.1.1) (2026-05-05)

### Bug Fixes

- **vite:** bundle cli for npx runtime ([ced56f8](https://github.com/ai-action/code-ollama/commit/ced56f8d9d4c3fccc4393a80cce53e2f4ad2a264))

## 0.1.0 (2026-05-04)

### Features

- **cli:** add command to run a one-off prompt ([7003b62](https://github.com/ai-action/code-ollama/commit/7003b62df3b5e9e8c520e90e486be0c501757748))
- **components:** add ModelPicker ([6113b00](https://github.com/ai-action/code-ollama/commit/6113b00cc0b2c4391b9875cf2c17b39fc65f4c4f))
- **components:** add slash command Autocomplete ([9238893](https://github.com/ai-action/code-ollama/commit/92388938aca15a254bc91c9420db2c03fb24a60d))
- **components:** render cursor block in Autocomplete ([e840f1b](https://github.com/ai-action/code-ollama/commit/e840f1bd174c841d3388ddabe6deddfb4e644b42))
- **components:** style Header ([a62f317](https://github.com/ai-action/code-ollama/commit/a62f31715c41735921ecc5219c8096df16e978ed))
- **utils:** add tool call support ([271aaf7](https://github.com/ai-action/code-ollama/commit/271aaf78521ef7cb5d35ec6bf731f88bd1636715))
- **utils:** implement static and dynamic system prompt ([6d14a32](https://github.com/ai-action/code-ollama/commit/6d14a322fdc25350d0f63d814a111ad0ee1a89dc))
- **utils:** integrate ollama to Chat ([0458526](https://github.com/ai-action/code-ollama/commit/045852647e0646c7714ef2ab908b8ab36787d451))
- **utils:** save and load config ([09188ff](https://github.com/ai-action/code-ollama/commit/09188ff04fe425ce6bf9e3eb868e6d8104472653))

### Bug Fixes

- **cli:** fix entrypoint guard so binary executes ([227f4af](https://github.com/ai-action/code-ollama/commit/227f4af421051f5753355dc7939d85c806eec359))
- **cli:** lazy-load TUI for packaged commands ([36ae24d](https://github.com/ai-action/code-ollama/commit/36ae24dca0faaf26e0039cfd911c34de5fa32f1b))
- **components:** display mode at bottom of Chat ([5586635](https://github.com/ai-action/code-ollama/commit/558663519f799bf9dcdce21cfc6b41006a112962))
- **components:** don't render system message in Chat ([8dd75cf](https://github.com/ai-action/code-ollama/commit/8dd75cfe949ad87df933aebcd501aa048c54d302))

### Performance Improvements

- **utils:** update grepSearch in tools to try ripgrep ([0542d3d](https://github.com/ai-action/code-ollama/commit/0542d3d4d525c03dfa5fedba3a272fbe55446ac2))
