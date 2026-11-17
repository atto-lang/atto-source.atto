# Stage-0 Atto native guest acceptance — evidence (2026-11-17)

**Scope: PASS for the bounded scalar compiler seed against one pinned native LLVM snapshot. This is not Stage 1/2/3 self-hosting, cross-backend parity, or a production/compiler release qualification.**

## Executed evidence

- Actual run: [private AttoPL CI job 44174328233](https://github.com/atto-co/atto-ci/actions/runs/44174328233).
- Status: **SUCCESS**, with nonempty checkout, source-integrity, toolchain, compilation, fail-closed safety-test, and native guest execution steps.
- Private carrier: `atto-co/atto-ci`; no cross-org GITHUB_TOKEN checkout and no public source mirror.
- Compiler: production C++ `oreslang-llvmc`, rebuilt with CMake/Ninja against LLVM 15.0.7 and linked to native guest programs using Clang 15.0.7. This was **not** a stub compiler or host-side arithmetic interpreter.
- Pinned carrier LLVM source snapshot commit: `430335dba9a0a956fcfbe4a9f2994e6922bc9acd`.
- Verified compiler `src` Git subtree: `7946876fbcaa33f0cc061aae29042ba01417b6c3`.
- Verified CMakeLists.txt Git blob: `b1ade35c5a54e8505a5a483a19cd66148da62a92`.
- **Pre-pinned** compiled compiler SHA-256 (required before executing any guest):
  `d68b4529893474559271abb27b9776bddaa8b5f6eb2ffc6a6bdf4e96850c672f`.
- Unmodified Atto guest source `src/scalar_codegen.atto`, Git blob:
  `b6f5fe8cddc6728a7c89cd4f6d48682aacafa991`.
- Atto guest source SHA-256:
  `7e6f7c9562971c08515f3ab1f837288c3e6837c28a4b692c937831577a874a04`.
- Atto native gate `scripts/stage0_native_gate.mjs`, source Git blob:
  `738cf0a517d25eff66d7e78e7dd66ca84f710b79`.
- Atto source PR head for this run: `c5a0529c38359f6a40c031c07443ed40a2312126` (root tree `b12e49c681f44c145438cefc7d6a1e078acde1be`); these values identify the Atto PR source and gate, not the mixed carrier Git tree.
- Outcome: original Atto kernel compiled to LLVM IR, linked to native code, and executed with exit code **42**. Eight additional generated Atto program fixtures compiled and executed with exit code **0**. **324** individual checked guest expressions covered all 300 digit/operator combinations plus 24 invalid, boundary and extreme-input cases.
- Malformed Atto source was rejected **without successful compilation or emitted LLVM IR**.
- The output receipt contains `schema: atto-stage0-native-guest-v1`, `result: passed`, `cases: 324`, `invalid_source_rejected: true`, `native_guest_executed: true`, `self_hosted: false`.
- The carrier separately executed the native gate's 4 fail-closed runner tests before native compilation.

## Executed native binaries (recorded SHA-256)

| Compiled Atto fixture | Guest exit | Binary SHA-256 |
| --- | ---: | --- |
| `unaltered` | 42 | `77764064c1c3eafc82f22e056d62d3afb688d4977c119fbecaa5549e4d0a9b31` |
| `matrix_0` | 0 | `08a729be6e83cde2473f75e28353ef99e98605080ae978f8495fcec10d67e099` |
| `matrix_45` | 0 | `43c86bdad257aead3e68528469ce7a3bc80fbe0751b8ed513d726ee9f1279584` |
| `matrix_90` | 0 | `94d885502339ddae1754f72c075e0037f1e5d68b6f116ffaeccf654482214dd9` |
| `matrix_135` | 0 | `ae9dbed4071b0ed25dd617848bf620ccbbdc55b3177aec6d6cf1a24c6c798d24` |
| `matrix_180` | 0 | `b3a996a19e5d03e812a5dbb69624da008593875b39103676669f6b20ec60231e` |
| `matrix_225` | 0 | `85291d20911331448005412da82e09c622900a6304744d1b131820292522eef7` |
| `matrix_270` | 0 | `06b585a40d7e325d099dc54a947f60cbb07e095bed4d5f23822cbdc753eda315` |
| `matrix_315` | 0 | `b88425190d2833dbdee47a8db7e34758ed68e05ac8af8c129d1fca0c917530ef` |

## Reproduction design

1. Use the exact private C++ LLVM source snapshot above (carrier commit), not an unreviewed "latest" checkout. Its source subtree and CMake file must match the indicated Git object identities.
2. `cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF`; `cmake --build build --target oreslang-llvmc --parallel 3`.
3. Require `sha256sum build/oreslang-llvmc` equal to the **pre-pinned** compiler SHA-256 above. A computed hash used as its own reference is not independent pinning.
4. Copy the exact Atto seed and native-gate source blobs (the private CI carrier used the connected GitHub App with independent Git blob checks; no token-driven cross-organization clone).
5. Run `node scripts/stage0_native_gate.mjs --compiler=/absolute/path/to/oreslang-llvmc --compiler-sha256=PINNED_VALUE --source=src/scalar_codegen.atto --source-blob=b6f5fe8cddc6728a7c89cd4f6d48682aacafa991 --compiler-source-commit=430335dba9a0a956fcfbe4a9f2994e6922bc9acd --clang=clang-15`, adjusting the source path for the carrier checkout.
6. Demand `result: passed`, real native-guest receipts and all nine binary exit codes. A missing compiler, mismatched blob or binary, failed compile/link/guest, or compiler diagnostics must fail closed.

## Known boundaries

- The carrier LLVM snapshot is **not byte-identical to the latest upstream** `ores-truffle-oreslang/oreslang-source.llvm/main`. Repeat with an audited latest-upstream tree before claiming current-head parity.
- This validates a narrow scalar Atto kernel, not a compiler that can read files, parse arbitrary Atto syntax, type-check arbitrary programs or compile itself.
- The existing scalar guest ABI is not yet a complete public compiler ABI. Do not treat the 324 assertions as 324 independent isolated processes; they executed in eight batched generated fixtures plus the unmodified seed.
- Target toolchain was an Ubuntu 22.04 x86-64 GitHub runner with LLVM/Clang 15; independent machine-triple capture and Windows/macOS/ARM64 replay remain follow-ups.
- No LLVM-vs-Java **guest** differential run was executed as part of this native gate; prior Rust/Node host reference checks are separate evidence.
- Stage 1, Stage 2, Stage 3, complete language parity, actor isolation and self-hosting are **NOT IMPLEMENTED**.

## Historical failures that were resolved

1. Original compiler rejected `define pub fnc` as a native public module wrapper. The actual seed uses admitted `pub fnc` spelling.
2. Clang 14 rejected LLVM 15 opaque `ptr` IR. The native guest gate now uses Clang 15.
3. Generated test programs still used the former `define pub fnc main` spelling. Corrected generator to `pub fnc main`.
4. Shallow checkout lacked the source-parent commit object; the provenance gate now checks the full compiler source subtree and CMake blob SHAs directly.

The native compiler passed after these corrections; none of them justify declaring a full self-hosted compiler.
