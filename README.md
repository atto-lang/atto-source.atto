> **AI agent instructions (organization-wide):** Before working on code, issues, or pull requests, read and follow the [organization `AGENTS.md`](https://github.com/atto-lang/.github/blob/main/AGENTS.md), including its **merge-first stealth-development policy**. Honor any repository-local `AGENTS.md`, explicit holds, and GitHub-enforced rules.

# AttoLang self-hosted compiler

This repository is the dedicated home for an **AttoLang compiler written in AttoLang**.

**Current status: not self-hosted.** Stage 0 source bootstrap, real guest compilation, and Stage 1/2/3 compiler rebuilds are separate verification milestones. No runnable self-hosted compiler is claimed.

Track the specification and acceptance contract in [atto-spec#70](https://github.com/atto-lang/atto-spec/issues/70).

The existing independent `atto-source.forge` C++ engine and `atto-source.llvm` native compiler remain separate projects. This compiler will be bootstrapped with a pinned trusted compiler until it can compile itself, then must prove independent semantic conformance and deterministic rebuild behavior.

Development should use canonical `.atto` files, snake_case declarations, and exact-source evidence for compilation, guest execution, compiler artifacts, and security negative tests.


## Canonical AttoLang naming and specification

This is the canonical [atto-source.atto](https://github.com/atto-lang/atto-source.atto) home. Use `.atto` source, `atto-*` names, and `https://github.com/atto-lang/atto-source.atto.git` for Git remotes. Historical naming is not part of current usage documentation.

- **Normative contract:** [atto-spec](https://github.com/atto-lang/atto-spec), including the versioned ownership, borrowing, equality, lifetime, effects and module-constant contracts. New implementation work must use these specs, not old backend examples.
- **Guest parity:** [atto-platform-conformance](https://github.com/atto-lang/atto-platform-conformance) and [atto-compilers-parity-testing](https://github.com/atto-lang/atto-compilers-parity-testing). Pin the exact source/tree and toolchain; distinguish passed, failed, unsupported and not-executed outcomes.
- **Shared and target requirements:** [atto-common-source](https://github.com/atto-lang/atto-common-source) and [atto-target-profiles](https://github.com/atto-lang/atto-target-profiles). Parser-only acceptance and host-only tests do not prove guest execution.

