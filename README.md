<h1 align="center">autocode</h1>
<p align="center">The open source AI coding agent — a community fork of <a href="https://opencode.ai">OpenCode</a> with an autonomous permission-review mode.</p>
<p align="center">Maintained by <a href="https://github.com/KaanAydinli">Kaan Aydınlı</a></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

---

### What autocode adds

- **Auto agent** — a third primary agent alongside Build and Plan. Instead of prompting you, permission requests are judged by an automated LLM risk reviewer that weighs the action's risk against what you actually asked for, and approves or denies on your behalf. Denials are fed back to the agent with an explanation; repeated denials trip a circuit breaker that hands control back to you.
- **`/rmodel`** — pick the model that powers the reviewer (defaults to Nemotron 3.5 Lightning Free, falls back to your chat model). The choice is remembered in your config as `reviewer_model`.
- Start it with `autocode --auto`, `autocode run --agent auto`, or cycle to the Auto agent with `Tab` in the TUI.

### Installation

autocode is installed from source:

```bash
git clone https://github.com/KaanAydinli/autocode.git
cd autocode
bun install

# build a native binary for your platform
cd packages/opencode
bun run script/build.ts --single

# install (adjust the target dir to somewhere on your PATH)
cp dist/opencode-linux-x64/bin/opencode ~/.local/bin/autocode
```

Or run straight from source during development:

```bash
bun dev            # TUI
bun dev serve      # headless server
```

> [!NOTE]
> The upstream installers (`curl opencode.ai/install`, `npm i -g opencode-ai`, brew, scoop, …) install the original OpenCode, not this fork.

### Agents

autocode includes three built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes
- **auto** - Autonomous agent for hands-off work
  - Permission requests are approved or denied by an automated risk reviewer instead of prompting you
  - You can still override any decision while it is being reviewed

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

autocode keeps full compatibility with OpenCode's configuration and features. For everything else — config, providers, keybinds, MCP servers — [**head over to the OpenCode docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing, please read the [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Credits

Built on top of [OpenCode](https://github.com/anomalyco/opencode) by Anomaly. Fork modifications by [Kaan Aydınlı](https://github.com/KaanAydinli).

---

> [!IMPORTANT]
> **This is not developed by the OpenCode team (Anomaly / anomalyco).** autocode is an independent community fork and is not affiliated with, endorsed by, or supported by the OpenCode project.
