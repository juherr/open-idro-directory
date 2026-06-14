# Contributing

Use English for code, comments, documentation, commit messages, and error messages.

Run before opening a pull request:

```bash
bun install
bun run check
```

Update `CHANGELOG.md` for every notable user-facing, data-pipeline, operational, or security change. The changelog follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and keeps unreleased work under `## [Unreleased]` using these sections when relevant:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

Do not dump raw commit logs into the changelog. Summarize changes for humans and keep internal-only churn out unless it affects contributors or operators.

Enable local Git hooks once per clone:

```bash
vp config --hooks-dir .vite-hooks
```

The hooks run `vp check` before commit, validate the commit message with Commitlint, and run `bun run test` before push.

Commit messages must follow [Conventional Commits](https://conventionalcommits.org/):

```text
<type>[optional scope][!]: <description>
```

Examples:

```text
feat(registry): add AFIREV connector
fix(validation): reject suspicious deletions
docs: reference EAFO IDRR
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, and `test`.

You can validate a message locally:

```bash
echo "feat(registry): add AFIREV connector" | bun run commit:check
```

Never add downloaded credentials, cookies, or personal data to raw snapshots.
