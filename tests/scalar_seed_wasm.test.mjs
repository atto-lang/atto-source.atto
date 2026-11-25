// Host-only differential test: this runs generated Wasm, NOT the .atto compiler.
// No dependencies; run with node --test tests/scalar_seed_wasm.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';

const OPCODE_I64_CONST = 0x42;
const OPCODE_END = 0x0b;

// Independent JavaScript implementation of the .atto three-ASCII-byte contract.
function asciiDigit(value) {
  return Number.isSafeInteger(value) && value >= 48 && value <= 57
    ? value - 48
    : null;
}
function compileTriplet(leftAscii, operatorAscii, rightAscii) {
  const left = asciiDigit(leftAscii);
  if (left === null) return { error: -1 };
  const right = asciiDigit(rightAscii);
  if (right === null) return { error: -2 };
  let result;
  switch (operatorAscii) {
    case 43: result = left + right; break;
    case 45: result = left - right; break;
    case 42: result = left * right; break;
    default: return { error: -3 };
  }
  if (result < -64) return { error: -5 };
  if (result > 63) return { error: -6 };
  const imm = result < 0 ? 128 + result : result;
  const packed = OPCODE_I64_CONST + imm * 256 + OPCODE_END * 65536;
  return { packed };
}

// Minimal no-import wasm32 module that exports main(): i64.
// Its function body is exactly: zero local decls, then the 3-byte fragment.
function wrapInWasmModule(packed) {
  assert.ok(Number.isInteger(packed) && packed >= 0 && packed <= 0xffffff);
  const opcode = packed & 0xff;
  const immediate = (packed >>> 8) & 0xff;
  const end = (packed >>> 16) & 0xff;
  return Uint8Array.from([
    0, 97, 115, 109, 1, 0, 0, 0,       // magic/version
    1, 5, 1, 0x60, 0, 1, 0x7e,          // type: () -> i64
    3, 2, 1, 0,                         // function type index 0
    7, 8, 1, 4, 109, 97, 105, 110, 0, 0, // export main
    10, 6, 1, 4, 0, opcode, immediate, end, // one body
  ]);
}
function runFragment(packed) {
  const bytes = wrapInWasmModule(packed);
  assert.equal(WebAssembly.validate(bytes), true);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, {});
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.deepEqual(WebAssembly.Module.exports(module), [{ name: 'main', kind: 'function' }]);
  return instance.exports.main();
}

// Independent arithmetic oracle: it does not inspect encoded bytes.
function expectedValue(left, op, right) {
  if (op === 42) return left * right;
  if (op === 43) return left + right;
  if (op === 45) return left - right;
  throw new Error('bad operator in oracle');
}

test('known fragment vectors and real WebAssembly execution', () => {
  const vectors = [
    [54, 42, 55, 731714, 42n],
    [57, 43, 50, 723778, 11n],
    [51, 45, 57, 752194, -6n],
    [48, 43, 48, 720962, 0n],
    [55, 42, 57, 737090, 63n],
    [48, 45, 57, 751426, -9n],
  ];
  for (const [lhs, op, rhs, expectedPacked, result] of vectors) {
    const actual = compileTriplet(lhs, op, rhs);
    assert.deepEqual(actual, { packed: expectedPacked });
    assert.equal(runFragment(actual.packed), result);
  }
});

test('all 300 accepted-shape digit/operator combinations run in a Wasm VM or reject', () => {
  let accepted = 0;
  let rejected = 0;
  for (const op of [42, 43, 45]) {
    for (let left = 0; left <= 9; left++) {
      for (let right = 0; right <= 9; right++) {
        const result = expectedValue(left, op, right);
        const compiled = compileTriplet(left + 48, op, right + 48);
        if (result > 63 || result < -64) {
          assert.deepEqual(compiled, { error: result > 63 ? -6 : -5 });
          rejected++;
        } else {
          assert.ok(compiled.packed >= 0);
          assert.equal(runFragment(compiled.packed), BigInt(result));
          accepted++;
        }
      }
    }
  }
  assert.equal(accepted + rejected, 300);
  assert.ok(accepted > 0 && rejected > 0);
});

test('malformed ASCII and extreme host integers fail closed with stable error precedence', () => {
  const invalid = [-Number.MAX_SAFE_INTEGER, -1, 0, 10, 47, 58, 127, 128, Number.MAX_SAFE_INTEGER];
  for (const code of invalid) {
    assert.deepEqual(compileTriplet(code, 43, 50), { error: -1 });
    assert.deepEqual(compileTriplet(49, 43, code), { error: -2 });
  }
  for (const op of [0, 32, 37, 47, 58, 127]) {
    assert.deepEqual(compileTriplet(49, op, 50), { error: -3 });
  }
  assert.deepEqual(compileTriplet(0, 47, 0), { error: -1 });
  assert.deepEqual(compileTriplet(49, 47, 0), { error: -2 });
  assert.deepEqual(compileTriplet(56, 42, 56), { error: -6 });
});

test('malformed wasm fragment cannot masquerade as a valid complete program', () => {
  const valid = compileTriplet(54, 42, 55).packed;
  assert.equal(runFragment(valid), 42n);
  const invalidEnd = wrapInWasmModule(valid);
  invalidEnd[invalidEnd.length - 1] = 0;
  assert.equal(WebAssembly.validate(invalidEnd), false);
  const invalidLeb = wrapInWasmModule(valid);
  invalidLeb[invalidLeb.length - 2] = 0x80; // unterminated signed LEB
  assert.equal(WebAssembly.validate(invalidLeb), false);
});
