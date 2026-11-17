# Scalar seed contract v0 — bounded arithmetic to Wasm instruction fragment

**Status: experimental Stage-0 component, NOT a self-hosted compiler or full Wasm emitter.**
Canonical source: `src/scalar_codegen.atto`.

## Input and result ABI

`compile_ascii_triplet(lhs_ascii: int, op_ascii: int, rhs_ascii: int) -> int`

- `int` is a signed 64-bit Atto integer.
- Inputs are exactly **three ASCII character codes**, not a source string or UTF-8 buffer.
- Both operands must be ASCII digits `0` through `9` inclusive (48–57).
- Operator is `*` (42), `+` (43), or `-` (45).
- Operations are checked signed-integer arithmetic on values 0–9.
- The computed result must fit one-byte signed LEB128 `[-64, 63]`.
- A **nonnegative** result represents three packed bytes in a signed i64:
  `0x42 | (immediate << 8) | (0x0b << 16)`, little-endian byte order.
- The bytes are `i64.const`, signed-LEB128 immediate, `end`, which is a Wasm **instruction fragment**. It is **not** a complete Wasm module.
- A **negative** result is a diagnostic code. No output fragment or artifact may be published for an error.

## Error codes and precedence

| Code | Meaning |
| --- | --- |
| -1 | Invalid left ASCII digit |
| -2 | Invalid right ASCII digit |
| -3 | Invalid operator |
| -4 | Evaluator rejected an invalid internal state |
| -5 | Value below the supported immediate range, or invalid immediate state |
| -6 | Value above the one-byte signed-LEB128 range |

Error validation order is **left digit → right digit → operator → evaluation → encoding**.

The current valid grammar can produce results only from -9 to 81; therefore
the lower immediate bound is not normally exercised through valid triplets.
The direct `evaluate_digit_binary` helper separately refuses operands outside
0–9 before evaluating arithmetic, preventing overflow on arbitrary i64 inputs.

## Representative vectors

| ASCII expression | Evaluation | Packed decimal bytes | Little-endian bytes |
| --- | ---: | ---: | --- |
| `6*7` | 42 | 731714 | `42 2a 0b` |
| `9+2` | 11 | 723778 | `42 0b 0b` |
| `3-9` | -6 | 752194 | `42 7a 0b` |
| `0+0` | 0 | 720962 | `42 00 0b` |
| `7*9` | 63 | 737090 | `42 3f 0b` |
| `0-9` | -9 | 751426 | `42 77 0b` |
| `8*8` | 64 | -6 (diagnostic) | no output |

This contract does not cover whitespace, Unicode identifiers, multiple
tokens, multi-digit operands, imports, classes, actors, allocation, or native
linking. Extending the grammar requires a versioned follow-up and new tests.

## Evidence separation

- `tests/scalar_seed_model.rs` executes an independent **Rust host model**.
- `tests/scalar_seed_wasm.test.mjs` executes **real WebAssembly modules assembled from an independent JavaScript host model**. This validates encoding/VM execution, not Atto source compilation.
- Only a real pinned Java/LLVM (or other approved Atto) compiler that compiles **this `.atto` source** and executes native guest tests on a variety of inputs may satisfy Stage-0 guest admission.
- A stage-0 test alone does not establish a Stage-1 self-hosted compiler. See `BOOTSTRAP_GATES.md`.

Never interpret a missing runner, `steps=[]`, a host-only test or a constant `main()==42` as a self-hosting proof.
