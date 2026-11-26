# Aggregate constructor v2 — bootstrap target (NOT_EXECUTED)

Source authority: atto-spec draft #246, commit `7d008233a9cfadd5d543735676cb15f01b00a7a2`, file `conformance/aggregate-constructor-v2.json`, Git blob `7545f81bbf63dc4ff57fb761109431426e2a6b86`. The local copy has 53 target fragments (23 accept, 30 reject). These fragments require proper guest wrappers and dependency providers before executable testing.

The current Atto-authored seed is an ASCII digit/op/digit code-emission kernel, not a compiler frontend. No general source parser, type checker, nominal layout, ownership checker, or import linker exists in this seed. Do not implement these rules as host JS rewrites or claim that LLVM Stage-0 acceptance establishes self-hosted compiler parity.

Stage-1 work:
1. Atto-authored lexer and delimiter stack, separate grouped expressions, tuple arities, static record fields, and import selectors.
2. Resolved builtin identity with shadowing and generic type formation. Pair<V> has a string first component; Pair<string,V> is the same nominal identity. Entry<K,V> accepts arbitrary typed keys.
3. Typed Record shape and constant decoded identifier provenance; reject Entry. Map Pair/Entry ingestion with stable Hash/Eq and uniform key/value types.
4. Ordered evaluation and ownership-aware HIR/MIR with no artifact on static failure.
5. Compile wrapped corpus through actual Atto-authored Stage-1 executable; run positives, reject negatives without output; then repeat Stage-2/Stage-3 self-compilation. Capture exact source/tree, toolchain, emitted binary and runner steps.

Host-only fixture integrity: `node --test tests/aggregate_constructor_bootstrap_contract.test.mjs`. This is not a compiler test.
