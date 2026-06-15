# AionUi - Project Guide

All contributors (human and AI) must follow [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. ([Chinese version](CONTRIBUTING.zh.md))

## Code Conventions

### File & Directory Structure

- **Directory size limit**: A single directory must not exceed **10** direct children (files + subdirectories). Split by responsibility when approaching this limit.

See [docs/contributing/file-structure.md](docs/contributing/file-structure.md) for complete rules. Agents must also follow the `architecture` skill (`.claude/skills/architecture/SKILL.md`) when creating files or modules.

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: camelCase with `use` prefix (`useTheme.ts`)
- **Constants files**: camelCase (`constants.ts`) — values inside use UPPER_SNAKE_CASE
- **Type files**: camelCase (`types.ts`)
- **Style files**: kebab-case or `ComponentName.module.css`
- **Unused params**: prefix with `_`

### UI Library & Icons

- **Components**: `@arco-design/web-react` — no raw interactive HTML (`<button>`, `<input>`, `<select>`, etc.)
- **Icons**: `@icon-park/react`

### CSS

- Prefer **UnoCSS utility classes**; complex styles use **CSS Modules** (`ComponentName.module.css`)
- Colors must use **semantic tokens** from `uno.config.ts` or CSS variables — no hardcoded values
- Arco theme overrides go in `packages/desktop/src/renderer/styles/arco-override.css`; component-scoped Arco overrides use CSS Module with `:global()`
- Global styles only in `packages/desktop/src/renderer/styles/`

Formatting rules (Oxfmt, Prettier-compatible):

- Single-element arrays that fit on one line → inline: `[{ id: 'a', value: 'b' }]`
- Trailing commas required in multi-line arrays/objects
- Single quotes for strings

### TypeScript

- Strict mode enabled — no `any`, no implicit returns
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`
- Prefer `type` over `interface` (per Oxlint config)
- English for code comments; JSDoc for public functions

### Internationalization (i18n)

All user-facing text must use i18n keys — never hardcode strings. Languages and modules are defined in `packages/desktop/src/common/config/i18n-config.json`.

See the `i18n` skill (`.claude/skills/i18n/SKILL.md`) for complete workflow, key naming, and validation steps.

## Architecture

Two process types — never mix their APIs:

| Process  | Path                             | Restriction     |
| -------- | -------------------------------- | --------------- |
| Main     | `packages/desktop/src/process/`  | No DOM APIs     |
| Renderer | `packages/desktop/src/renderer/` | No Node.js APIs |

Cross-process communication must go through the IPC bridge (`packages/desktop/src/preload/`).
See [docs/architecture/overview.md](docs/architecture/overview.md) for details.

## Testing

**Framework**: Vitest 4 (`vitest.config.ts`). Coverage target ≥ 80%.

```bash
bun run test              # run all tests
bun run test:coverage     # with coverage report
```

See the `testing` skill (`.claude/skills/testing/SKILL.md`) for complete workflow and quality rules.

## Workflow

### During Development

Auto-fix as you edit:

```bash
/Users/richard/Coding\ Tools/bin/bun run lint:fix       # auto-fix lint issues (oxlint)
/Users/richard/Coding\ Tools/bin/bun run format         # auto-format all files (oxfmt)
/Users/richard/Coding\ Tools/bin/bunx tsc --noEmit      # verify no type errors
```

If your changes touch `packages/desktop/src/renderer/`, `locales/`, or `packages/desktop/src/common/config/i18n`, also run:

```bash
/Users/richard/Coding\ Tools/bin/bun run i18n:types
/Users/richard/Coding\ Tools/bin/node scripts/check-i18n.js
```

Machine-level app tools are expected at `/Users/richard/Coding Tools/bin`.
Use those stable paths for `node`, `npm`, `npx`, `pnpm`, `bun`, `bunx`,
`playwright`, `just`, `pwsh`, `python`, `python3`, `prek`, and macOS
packaging/signing tools before falling back to Homebrew or repo-local
executables. Do not add these tools as dependencies just to satisfy an agent
thread; if one is missing, fix or report the machine bootstrap issue.

When running `just` recipes or app-server package scripts, prepend the central
tools path so bare commands inside the recipe resolve consistently:

```bash
PATH="/Users/richard/Coding Tools/bin:$PATH" /Users/richard/Coding\ Tools/bin/just <recipe>
```

Signed/notarized app builds require more than installed programs. Before
claiming a distributable macOS build, verify the target machine has the intended
codesigning identity with `security find-identity -v -p codesigning` and that
notarization/release credentials are present. Local ad-hoc signing is only a
smoke-build step.

### Before Pushing

Always use `just push` instead of `git push`:

```bash
just push                          # lint → format-check → typecheck → test → git push
just push -u origin feat/branch    # same checks, with extra git push args
```

Any step that fails aborts the push. Fix the issue, commit, then retry.

> **Note for AI agents**: `just push` uses `--quiet` for lint — only errors cause failure. The project has many pre-existing lint _warnings_ which do NOT indicate failure. Judge success by exit code, not by output volume.

### Before PR (optional stricter check)

`prek` replicates the **exact CI pipeline** (includes end-of-file, trailing whitespace checks on all file types):

```bash
# One-time setup
npm install -g @j178/prek

# Run
prek run --from-ref origin/main --to-ref HEAD
```

> `prek` is read-only — it reports but does not fix. If it reports issues, run the auto-fix commands above, commit, then re-run.

The `oss-pr` skill runs this automatically during PR creation.

### Commit & PR Format

Commit format: `<type>(<scope>): <subject>` in English. Types: feat, fix, refactor, chore, docs, test, style, perf.

**NEVER add AI signatures** (Co-Authored-By, Generated with, etc.).

For pull request creation, see the `oss-pr` skill (`.claude/skills/oss-pr/SKILL.md`).

## Skills Index

| Skill             | Purpose                                                                               | Triggers                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **architecture**  | File & directory structure conventions for all process types                          | Creating files, adding modules, architectural decisions                                    |
| **i18n**          | Internationalization workflow and standards                                           | Adding user-facing text, modifying `locales/` or `packages/desktop/src/common/config/i18n` |
| **testing**       | Testing workflow and quality standards                                                | Writing tests, adding features, before claiming completion                                 |
| **oss-pr**        | Full commit + PR workflow: branch management, quality checks, issue linking, PR       | Creating pull requests, after committing, `/oss-pr`                                        |
| **bump-version**  | Version bump workflow: update package.json, checks, branch, PR, tag release           | Bumping version, `/bump-version`                                                           |
| **pr-review**     | Local PR code review with full project context, no truncation limits                  | Reviewing a PR, user says "review PR", `/pr-review`                                        |
| **pr-fix**        | Fix all issues from a pr-review report, create a follow-up PR, and verify each fix    | After pr-review, user says "fix all issues", `/pr-fix`                                     |
| **pr-verify**     | Verify and merge bot:ready-to-merge PRs with impact analysis and test supplementation | Verifying PRs, merging ready PRs, `/pr-verify`                                             |
| **pr-ship**       | End-to-end PR lifecycle: create, CI wait, review, fix, merge in one invocation        | `/pr-ship`, after development is done, resume shepherding a PR                             |
| **pr-automation** | PR automation orchestrator: poll PRs, review, fix, and merge via label state machine  | Invoked by daemon script (`pr-automation.sh`), `/pr-automation`                            |

> Skills are located in `.claude/skills/` and contain project conventions that apply to **all** agents and contributors.

<!-- ALFRED-CODING-TOOLS:START -->

## Canonical Coding Tools

Common agent coding tools are installed centrally on `laptop`, `server`, and `study` under:

`/Users/richard/Coding Tools`

Use `/Users/richard/Coding Tools/bin/<tool>` before repo-local installs, Homebrew paths, or ad hoc downloads. Each tool also has an owned subfolder at `/Users/richard/Coding Tools/tools/<tool>/bin/<tool>`, and the per-machine manifest is at:

`/Users/richard/Coding Tools/manifests/coding-tools-manifest.md`

Daily agent workbench paths:

| Category                | Tools                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| File create/remove/edit | `apply_patch`, `mkdir`, `rmdir`, `rm`, `cp`, `mv`, `touch`, `ln`, `chmod`, `chown`, `chgrp`, `stat`      |
| File/path inspection    | `cat`, `ls`, `pwd`, `tree`, `bat`, `find`, `fd`, `realpath`, `basename`, `dirname`, `du`, `df`, `mktemp` |
| Search/replace/text     | `rg`, `grep`, `egrep`, `fgrep`, `sed`, `sd`, `awk`, `xargs`, `sort`, `uniq`, `head`, `tail`, `wc`, `tee` |
| Diff/patch              | `diff`, `patch`, `cmp`, `comm`, `diff3`, `sdiff`                                                         |
| Git/GitHub              | `git`, `git-lfs`, `gh`, `ssh`, `gitignore`                                                               |
| Downloads/sync          | `curl`, `wget`, `rsync`                                                                                  |
| Data/config             | `jq`, `yq`, `plutil`                                                                                     |
| JavaScript/TypeScript   | `node`, `npm`, `npx`, `pnpm`, `bun`, `bunx`, `prettier`, `eslint`, `prek`                                |
| Rust                    | `rustup`, `cargo`, `rustc`, `rustfmt`, `cargo-fmt`, `cargo-clippy`, `clippy-driver`, `rust-analyzer`, `cargo-nextest`, `cargo-audit` |
| Python/tool runners     | `python`, `python3`, `uv`, `uvx`                                                                         |
| Shell/tool quality      | `shellcheck`, `shfmt`, `pwsh`, `sh`, `bash`, `zsh`                                                       |
| Archives/compression    | `tar`, `zip`, `unzip`, `gzip`, `gunzip`, `bzip2`, `bunzip2`                                              |
| Browser/app verification | `playwright`                                                                                            |
| Build/platform basics   | `make`, `xcodebuild`, `swift`, `just`, `openssl`, `perl`, `ruby`, `codesign`, `security`, `xcrun`, `productbuild`, `hdiutil`, `ditto`, `lipo`, `otool` |

Important stable executable paths:

| Tool          | Stable path                                   |
| ------------- | --------------------------------------------- |
| `apply_patch` | `/Users/richard/Coding Tools/bin/apply_patch` |
| `gitignore`   | `/Users/richard/Coding Tools/bin/gitignore`   |
| `git`         | `/Users/richard/Coding Tools/bin/git`         |
| `gh`          | `/Users/richard/Coding Tools/bin/gh`          |
| `git-lfs`     | `/Users/richard/Coding Tools/bin/git-lfs`     |
| `ssh`         | `/Users/richard/Coding Tools/bin/ssh`         |
| `rg`          | `/Users/richard/Coding Tools/bin/rg`          |
| `grep`        | `/Users/richard/Coding Tools/bin/grep`        |
| `find`        | `/Users/richard/Coding Tools/bin/find`        |
| `fd`          | `/Users/richard/Coding Tools/bin/fd`          |
| `sed`         | `/Users/richard/Coding Tools/bin/sed`         |
| `sd`          | `/Users/richard/Coding Tools/bin/sd`          |
| `awk`         | `/Users/richard/Coding Tools/bin/awk`         |
| `diff`        | `/Users/richard/Coding Tools/bin/diff`        |
| `patch`       | `/Users/richard/Coding Tools/bin/patch`       |
| `jq`          | `/Users/richard/Coding Tools/bin/jq`          |
| `yq`          | `/Users/richard/Coding Tools/bin/yq`          |
| `node`        | `/Users/richard/Coding Tools/bin/node`        |
| `npm`         | `/Users/richard/Coding Tools/bin/npm`         |
| `npx`         | `/Users/richard/Coding Tools/bin/npx`         |
| `pnpm`        | `/Users/richard/Coding Tools/bin/pnpm`        |
| `bun`         | `/Users/richard/Coding Tools/bin/bun`         |
| `bunx`        | `/Users/richard/Coding Tools/bin/bunx`        |
| `playwright`  | `/Users/richard/Coding Tools/bin/playwright`  |
| `prek`        | `/Users/richard/Coding Tools/bin/prek`        |
| `rustup`      | `/Users/richard/Coding Tools/bin/rustup`      |
| `cargo`       | `/Users/richard/Coding Tools/bin/cargo`       |
| `rustc`       | `/Users/richard/Coding Tools/bin/rustc`       |
| `rustfmt`     | `/Users/richard/Coding Tools/bin/rustfmt`     |
| `cargo-fmt`   | `/Users/richard/Coding Tools/bin/cargo-fmt`   |
| `cargo-clippy` | `/Users/richard/Coding Tools/bin/cargo-clippy` |
| `cargo-nextest` | `/Users/richard/Coding Tools/bin/cargo-nextest` |
| `cargo-audit` | `/Users/richard/Coding Tools/bin/cargo-audit` |
| `clippy-driver` | `/Users/richard/Coding Tools/bin/clippy-driver` |
| `rust-analyzer` | `/Users/richard/Coding Tools/bin/rust-analyzer` |
| `pwsh`        | `/Users/richard/Coding Tools/bin/pwsh`        |
| `python`      | `/Users/richard/Coding Tools/bin/python`      |
| `python3`     | `/Users/richard/Coding Tools/bin/python3`     |
| `codesign`    | `/Users/richard/Coding Tools/bin/codesign`    |
| `security`    | `/Users/richard/Coding Tools/bin/security`    |
| `xcrun`       | `/Users/richard/Coding Tools/bin/xcrun`       |
| `productbuild` | `/Users/richard/Coding Tools/bin/productbuild` |
| `hdiutil`     | `/Users/richard/Coding Tools/bin/hdiutil`     |
| `ditto`       | `/Users/richard/Coding Tools/bin/ditto`       |
| `lipo`        | `/Users/richard/Coding Tools/bin/lipo`        |
| `otool`       | `/Users/richard/Coding Tools/bin/otool`       |
| `prettier`    | `/Users/richard/Coding Tools/bin/prettier`    |
| `eslint`      | `/Users/richard/Coding Tools/bin/eslint`      |
| `shellcheck`  | `/Users/richard/Coding Tools/bin/shellcheck`  |
| `shfmt`       | `/Users/richard/Coding Tools/bin/shfmt`       |
| `tree`        | `/Users/richard/Coding Tools/bin/tree`        |
| `bat`         | `/Users/richard/Coding Tools/bin/bat`         |
| `curl`        | `/Users/richard/Coding Tools/bin/curl`        |
| `wget`        | `/Users/richard/Coding Tools/bin/wget`        |
| `rsync`       | `/Users/richard/Coding Tools/bin/rsync`       |

For any listed tool, the stable path is `/Users/richard/Coding Tools/bin/<tool>` and the owned subfolder path is `/Users/richard/Coding Tools/tools/<tool>/bin/<tool>`.

Specialized machine-level tool note: Ghidra is installed on `study` only. Use `/Users/richard/.local/bin/ghidra` for the GUI wrapper, `/Users/richard/.local/bin/ghidra-headless` for headless analysis, and `/Users/richard/.local/share/alfred-tools/ghidra/ghidra_12.1.2_PUBLIC` for the underlying install. Do not document or assume Ghidra on `server` or `laptop` unless it is installed there in a later maintenance slice.

<!-- ALFRED-CODING-TOOLS:END -->
