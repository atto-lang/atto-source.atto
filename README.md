# atto-source.atto — AttoLang self-hosted compiler

The dedicated repository for a compiler implemented **in AttoLang itself**.

**Status: Stage-0 bounded scalar native guest execution VERIFIED; NOT SELF-HOSTED.** A pinned LLVM compiler snapshot compiled and executed the actual Atto-authored seed and 324 scalar guest checks on a private GitHub runner. No general Atto-written compiler CLI, Stage-1 compiler, Stage-2 recompilation or Stage-3 fixed-point proof exists. See [executed native evidence](docs/STAGE0_NATIVE_EVIDENCE.md).

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
tests/scalar_seed_wasm.test.mjs  Real Wasm VM execution from JS HOST model

tests/README.md              How to run and interpret the host test
docs/BOOTSTRAP_GATES.md      Stage-0/1/2/3 milestone and evidence policy
docs/SCALAR_SEED_CONTRACT.md  Exact scalar fragment ABI and diagnostics
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

The `main` smoke entry evaluates `6*7` and returns native exit status 42.
This was **actually compiled and executed** with the pinned LLVM Stage-0
compiler (with real Clang 15 linking); the test then executed 324 scalar
checks in eight generated Atto guest programs. This proves only the bounded
seed profile, not arbitrary program compilation or compiler self-hosting.
See [run 44174328233](https://github.com/atto-co/atto-ci/actions/runs/44174328233).

## Host-only reference checks

With the Rust toolchain installed:

```sh
rustc --edition 2021 --test tests/scalar_seed_model.rs -o /tmp/atto-seed-model
/tmp/atto-seed-model
```

These test the arithmetic and byte-encoding *model only*, not the Atto source.
Run `node --test tests/scalar_seed_wasm.test.mjs` to validate all 300 digit/operator pairs using independently generated and actually executed WebAssembly modules. These are still host-generated Wasm guests, **not Atto-compiled guests**.

Neither test may be reported as self-hosting, Atto frontend parity, or actual `.atto` guest execution evidence.

## Promotion criteria

1. **Stage-0 scalar proof completed (pinned snapshot only):** a real native LLVM compiler compiled and executed this kernel with 324 positive/negative and extreme-input tests; see [evidence](docs/STAGE0_NATIVE_EVIDENCE.md). Repeat against current LLVM head separately.
2. Build a real Atto-authored compiler CLI that reads source files, performs lexical/semantic checks, and emits executable target artifacts.
3. Stage 1 compiles its entire own source to Stage 2; Stage 2 compiles to Stage 3, with independently checked semantics and reproducibility.
4. Record actual executed CI steps, exact source tree / toolchain / artifact identities and independent Java/LLVM differential tests.

Unsupported features must fail closed; no pass may be inferred from skipped tests or `steps=[]`.

## Provenance

The seed files were migrated by exact Git blob SHA from
[atto-source.llvm PR #26](https://github.com/atto-lang/atto-source.llvm/pull/26).
That older staging PR was closed without merging once the dedicated repository was established. This preserves file content; it is **not a cross-repository
commit-history transfer**.

Prefer canonical `.atto` source and snake_case names. New cross-backend
semantics belong in [atto-spec](https://github.com/atto-lang/atto-spec).
