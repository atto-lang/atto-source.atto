# Self-hosted Atto compiler core math/hash/cell bootstrap candidates

This repository is a **bootstrap-only** AttoLang compiler project, not a
runnable self-hosted compiler. Three independently owned
`library/atto.core/*.atto` modules establish source API candidates only.
The Python source-free test pins their Git blob SHA-1 identities and
golden integer/byte-fold vectors. These are **not** compiler tests.

`core/math` is checked signed integer min/max/signum/closed bounds.
`core/hash` uses a bounded five-step noncryptographic polynomial fold
modulo 1,000,000,007; no host hash or unbounded loop.
`core/cell` provides pure borrow-state admission policy only, not
Cell<T> / RefCell<T> and no borrowing permission.

Promotion requires a separately pinned trusted Atto bootstrap compiler
to compile/link/execute the fixture, then real Stage 1->2->3 self-rebuild
with reproducible binary hashes, caller-independent core source authority,
and negative borrowing/overflow/import tests. The hash uses descending powers-of-two conditional subtraction to avoid loop lowering and floating division in the bounded bootstrap profile. External bootstrap guest qualification is separate from self-hosting. Guest status NOT_EXECUTED.
