# atto-source.atto — AttoLang self-hosted compiler

The dedicated repository for a compiler implemented **in AttoLang itself**.

**Status: NOT SELF-HOSTED.** The initial Atto-authored scalar code-generation kernel is a Stage-0 source seed. No end-to-end Atto guest compilation, Stage-1 compiler, Stage-2 recompilation or Stage-3 fixed-point proof is currently established.

Specification and requirements: [atto-spec#70](https://github.com/atto-lang/atto-spec/issues/70).

## Distinct backend responsibilities

- **atto-source.atto (this repository):** portable compiler frontend, independent typed HIR/MIR, verifier, optimization, and code generators authored in `.atto`; eventual Stage-1/2/3 self-compilation.
- **atto-source.llvm:** native LLVM AOT compiler and possible trusted Stage-0 bootstrap tool.
- **atto-source.java:** Java/GraalVM reference language implementation and alternative Stage-0 compiler.
- **atto-source.forge:** independent native C++20 engine; not the Atto-authored self-hosted compiler.
- **atto-source.cranelift:** independent Cranelift JIT experiment.

No runtime/JIT fallback from a non-Atto compiler may be hidden in a release labeled self-hosted. Stage 0 may use an external trusted compiler; subsequent compiler stages must be compiled by the Atto-authored compiler itself.

## Current repository layout

```text
src/scalar_codegen.atto       Atto-written, bounded code emission kernel
tests/scalar_seed_model.rs    Host-only Rust reference (NOT an Atto guest test)
tests/README.md              How to run and interpret the host test
docs/BOOTSTRAP_GATES.md      Stage-0/1/2/3 milestone and evidence policy
.github/workflows/           Host-model test workflow (not a self-hosting proof)
```

## Source kernel

`compile_ascii_triplet` currently accepts three ASCII character codes for
`digit op digit`, where `op` is `+`, `-`, or `*`. It emits a packed
three-byte **Wasm instruction fragment**:
`0x42 <one-byte signed-LEB128 i64> 0x0b`.
The result must lie in [-64, 63]; malformed input is rejected with negative
error codes. These bytes are **not an executable Wasm module**.
This is not yet a general lexer, parser, compiler CLI, typechecker,
borrow checker or LLVM/Wasm binary emitter.

The `main` smoke entry evaluates `6*7` and has expected native exit
status 42 if a supported Atto frontend successfully compiles and executes
it. **No such Atto guest execution is certified by this repository yet.**

## Host-only reference checks

With the Rust toolchain installed:

```sh
rustc --edition 2021 --test tests/scalar_seed_model.rs -o /tmp/atto-seed-model
/tmp/atto-seed-model
```

These test the arithmetic and byte-encoding *model only*, not the Atto source.
Their success must never be reported as self-hosting, frontend parity, or
guest execution evidence.

## Promotion criteria

1. Demonstrate a real pinned Stage-0 Atto compiler compiling and executing this kernel against diverse positive/negative inputs, with exact-source and binary hashes.
2. Build a real Atto-authored compiler CLI that reads source files, performs lexical/semantic checks, and emits executable target artifacts.
3. Stage 1 compiles its entire own source to Stage 2; Stage 2 compiles to Stage 3, with independently checked semantics and reproducibility.
4. Record actual executed CI steps, exact source tree / toolchain / artifact identities and independent Java/LLVM differential tests.

Unsupported features must fail closed; no pass may be inferred from skipped tests or `steps=[]`.

## Provenance

The seed files were migrated by exact Git blob SHA from
[atto-source.llvm PR #26](https://github.com/atto-lang/atto-source.llvm/pull/26).
That older staging PR is superseded once this dedicated-repository proposal
is accepted. This preserves file content; it is **not a cross-repository
commit-history transfer**.

Prefer canonical `.atto` source and snake_case names. New cross-backend
semantics belong in [atto-spec](https://github.com/atto-lang/atto-spec).
