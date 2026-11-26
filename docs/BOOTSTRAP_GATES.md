# Self-hosting acceptance gates

Canonical repository: `atto-lang/atto-source.atto` (established 2026-11-17)
Tracking RFC: https://github.com/atto-lang/atto-spec/issues/70

## Definitions

- **Stage 0:** trusted existing compiler (Java/GraalVM or LLVM) capable of
  compiling the required Atto-authored compiler source.
- **Stage 1:** executable Atto-authored compiler built by stage 0.
- **Stage 2:** compiler built by compiling all stage-1 source with stage 1.
- **Stage 3:** compiler built by compiling all stage-1 source with stage 2.

**As of this seed in the dedicated repository: no stage-1, stage-2, or stage-3 executable exists.**
The three-byte source fragment kernel is a small component, not a self-hosted
compiler. Neither Rust host-model tests nor Node-generated WebAssembly execution are
Atto-compiled guest-language evidence. Their status must be recorded separately.

## Mandatory bootstrap progression

| Gate | Required real execution and evidence | Current |
| --- | --- | --- |
| G0 source | Atto-written kernel parses/lowers multiple real inputs under selected native stage-0 compiler | **VERIFIED for restricted scalar seed, pinned LLVM snapshot** — [executed evidence](STAGE0_NATIVE_EVIDENCE.md) |
| G1 compiler | Stage-1 executable reads external Atto files, lexes/parses/types them and emits runnable LLVM IR or native object artifacts | NOT IMPLEMENTED |
| G2 rebuild | Stage-1 compiles **its entire own source module graph** to a working Stage-2 executable | NOT IMPLEMENTED |
| G3 fixed point | Stage-2 repeats the build to Stage 3; compare canonical artifacts and runtime behavior | NOT IMPLEMENTED |
| G4 independent | Java and LLVM independently compile shared accepted/negative fixtures with equivalent observable semantics | NOT EXECUTED |
| G5 release | Exact source/toolchain/artifact SHA, real job steps, negative gates, compiler provenance and pinned dependencies | NOT EXECUTED |

A successful CMake, Maven, host-only Rust test, docs-only update or
syntactically parsed `.atto` file cannot satisfy G1 or G2.

## Work order

1. Stable byte-view/string and bounded source input APIs; NFC/UTF-8 and
   source-size/recursion limits. No ambient filesystem capability.
2. Lexer with source spans and explicit error codes (not host exceptions).
3. Parser to typed AST/HIR; functions, blocks, expressions and imports.
4. Nominal type/effect checker and cross-module symbol resolver.
5. Ownership/borrow checker with region/lifetime and suspension validation.
6. MIR lowering with verifier, checked arithmetic and drop/liveness passes.
7. LLVM IR emission, target ABI, reproducible linking, and controlled I/O.
8. Compiler CLI in AttoLang, complete Atto-authored source dependency graph.
9. Native/CI bootstrap Stage 1 → Stage 2 → Stage 3, independent oracles.

## Host-only verification floor

- Execute `rustc --edition 2021 --test tests/scalar_seed_model.rs` to check
  overflow-safe digit admission, 300 exhaustive expression combinations and
  stable negative diagnostic codes.
- Execute `node --test tests/scalar_seed_wasm.test.mjs` to run the 300-case
  host-generated Wasm matrix in a real WebAssembly engine.
- Validate committed source blob SHA against any private carrier copy.
- Neither test executes the `.atto` compiler; both are explicitly insufficient
  for G0 guest admission, and much less G1–G3 self-hosting.

## Non-negotiable testing

- A real compiler must compile *distinct externally supplied inputs* to
  distinct correct executables. Never accept a hardcoded `42` smoke alone.
- Invalid UTF-8, malformed tokens, unsupported syntax, bad import roots,
  integer overflow, and type/borrow violations must reject without output
  artifact publication.
- Actual build invocation, stdout/stderr, exit codes, source tree SHA,
  compiler executable SHA-256, target versions, guest artifact hashes and
  nonempty CI step logs must be preserved.
- Test matrix: Linux x86-64, Windows x64, macOS/ARM64 where supported;
  sanitizer-backed native host tests; portable `.atto` source fixtures.
- Preserve the Java reference's observable semantics across native LLVM and
  other backends; intentionally restricted bootstrap grammar must fail closed.
- Avoid a cyclic trust claim: stage-2/stage-3 equivalence alone doesn't
  establish correctness without independent differential execution.

## Isolation and JIT

The bootstrap compiler itself is trusted build software. Its generated
native code and build-time execution are not a sandbox. Do not expose
untrusted compilation/guest execution without a separately verified
capability boundary. No implicit runtime JIT is required for a full-AOT
self-hosted compiler.

## Naming

New .atto source and snake_case identifiers are canonical. Forge remains
a separate C++20 compiler/runtime and Cranelift remains an independent
native JIT backend. The Atto-authored compiler must not silently delegate
semantic checks to Java/C++/Rust implementations in a release labeled
self-hosted.

## Checked unwrap compiler-proof seed (2026-11-26)

The Atto-authored scalar kernel contains a pure normalized-fact decision
function for the closed checked-unwrap optimization: select the payload on
success, select a fallback only when the error is statically unobservable,
or reject the optimization. Unknown family, tag, observation or closure
facts must reject. A rejected optimization retains the original IR; it does
not mean a guest semantic rejection. This is not an actual Option/Result
compiler frontend, runtime Error ABI or self-hosting proof.

The existing pinned Stage-0 native gate now includes 32 additional
assertions for this compiler component. Require the new seed and gate Git
blobs and the reviewed compiler artifact SHA-256 before running. Existing
November 17 native receipts apply only to their original exact source.
New native compiler execution is NOT_EXECUTED; no Stage-1 executable exists.
