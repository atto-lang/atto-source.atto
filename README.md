# AttoLang self-hosted compiler

This repository is the dedicated home for an **AttoLang compiler written in AttoLang**.

**Current status: not self-hosted.** Stage 0 source bootstrap, real guest compilation, and Stage 1/2/3 compiler rebuilds are separate verification milestones. No runnable self-hosted compiler is claimed.

Track the specification and acceptance contract in [atto-spec#70](https://github.com/atto-lang/atto-spec/issues/70).

The existing independent `atto-source.forge` C++ engine and `atto-source.llvm` native compiler remain separate projects. This compiler will be bootstrapped with a pinned trusted compiler until it can compile itself, then must prove independent semantic conformance and deterministic rebuild behavior.

Development should use canonical `.atto` files, snake_case declarations, and exact-source evidence for compilation, guest execution, compiler artifacts, and security negative tests.
