<p align="center">
  <picture>
    <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="assets/logo-dark.svg" alt="autocode" width="480">
  </picture>
</p>
<p align="center">The open source AI coding agent with an autonomous permission-review mode.</p>
<p align="center">Maintained by <a href="https://github.com/KaanAydinli">Kaan Aydınlı</a></p>

---

### Features

- **Terminal-first coding agent** — a fast TUI you drive with plain language: edit code, run commands, explore codebases, ship features.
- **Auto agent** — hands-off mode. Permission requests are approved or denied by an automated LLM risk reviewer that weighs each action's risk against what you actually asked for, instead of interrupting you. Denials are explained back to the agent; repeated denials trip a circuit breaker that hands control back to you, and you can override any decision while it is being reviewed.
- **`/rmodel`** — choose the model powering the reviewer (defaults to Nemotron 3.5 Lightning Free, falls back to your chat model). Remembered in your config as `reviewer_model`.
- **Provider-agnostic** — bring your own models: Anthropic, OpenAI, Google, local, and 75+ providers.
- **Client/server architecture** — run the agent headless (`autocode serve`) and drive it from anywhere.

### Installation

Install from source:

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

### Usage

```bash
autocode                       # interactive TUI
autocode --auto                # start in the auto agent (reviewer-approved permissions)
autocode run "fix the tests"   # non-interactive, single prompt
autocode run --agent auto "…"  # non-interactive with the auto agent
```

### Agents

autocode includes three built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Ideal for exploring unfamiliar codebases or planning changes
- **auto** - Autonomous agent for hands-off work
  - Permission requests are settled by the automated risk reviewer instead of prompting you
  - Set the reviewer's model with `/rmodel`

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

### Configuration

Configuration lives in `opencode.json` (project) and `~/.config/opencode/opencode.json` (global). Notable keys:

- `model` — your chat model, as `provider/model`
- `reviewer_model` — the auto agent's reviewer model
- `permission` — per-tool `allow` / `ask` / `deny` rules, which the auto agent's reviewer settles for you

### Contributing

If you're interested in contributing, please read the [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

---

Built on top of [OpenCode](https://github.com/anomalyco/opencode) by Anomaly.
