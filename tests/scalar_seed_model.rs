//! Independent *host-only* reference for the Atto-authored three-byte
//! source-to-Wasm instruction-fragment kernel.
//! This DOES NOT compile or execute src/scalar_codegen.atto.

fn ascii_digit_value(ascii: i64) -> Option<i64> {
    // Do not use `then_some(ascii - 48)` here: `then_some` eagerly
    // evaluates its argument, overflowing on i64::MIN in debug builds.
    if (48..=57).contains(&ascii) {
        Some(ascii - 48)
    } else {
        None
    }
}

// Negative numbers are the exact fail-closed codes used by the Atto seed.
fn compile_triplet(lhs: i64, op: i64, rhs: i64) -> Result<i64, i64> {
    let left = ascii_digit_value(lhs).ok_or(-1_i64)?;
    let right = ascii_digit_value(rhs).ok_or(-2_i64)?;
    let value = match op {
        43 => left.checked_add(right),
        45 => left.checked_sub(right),
        42 => left.checked_mul(right),
        _ => return Err(-3),
    }
    .ok_or(-4_i64)?;
    if value < -64 {
        return Err(-5);
    }
    if value > 63 {
        return Err(-6);
    }
    let immediate = if value < 0 { value + 128 } else { value };
    Ok(0x42 + (immediate << 8) + (0x0b << 16))
}

fn decode_fragment(fragment: i64) -> i64 {
    assert!((0..=0xffffff).contains(&fragment));
    assert_eq!(fragment & 0xff, 0x42, "i64.const");
    assert_eq!((fragment >> 16) & 0xff, 0x0b, "end");
    let immediate = (fragment >> 8) & 0xff;
    assert_eq!(immediate & 0x80, 0, "one-byte signed LEB128");
    if immediate & 0x40 != 0 {
        immediate - 128
    } else {
        immediate
    }
}

#[test]
fn known_binary_encoding_vectors() {
    let vectors = [
        (b'6', b'*', b'7', 731714, 42),
        (b'9', b'+', b'2', 723778, 11),
        (b'3', b'-', b'9', 752194, -6),
        (b'0', b'+', b'0', 720962, 0),
        (b'7', b'*', b'9', 737090, 63),
        (b'0', b'-', b'9', 751426, -9),
    ];
    for (lhs, op, rhs, expected_bytes, expected_result) in vectors {
        let actual = compile_triplet(lhs.into(), op.into(), rhs.into()).unwrap();
        assert_eq!(actual, expected_bytes);
        assert_eq!(decode_fragment(actual), expected_result);
    }
}

#[test]
fn exhaustive_300_digit_operator_combinations() {
    let mut accepted = 0;
    let mut rejected = 0;
    for op in [42_i64, 43, 45] {
        for left in 0_i64..=9 {
            for right in 0_i64..=9 {
                let expected = match op {
                    42 => left * right,
                    43 => left + right,
                    45 => left - right,
                    _ => unreachable!(),
                };
                match compile_triplet(left + 48, op, right + 48) {
                    Ok(packed) => {
                        assert!((-64..=63).contains(&expected));
                        assert_eq!(decode_fragment(packed), expected);
                        accepted += 1;
                    }
                    Err(code) => {
                        assert_eq!(code, if expected > 63 { -6 } else { -5 });
                        assert!(expected > 63 || expected < -64);
                        rejected += 1;
                    }
                }
            }
        }
    }
    assert_eq!(accepted + rejected, 300);
    assert!(accepted > 0 && rejected > 0);
}

#[test]
fn extreme_invalid_ascii_rejects_without_overflow() {
    for invalid in [i64::MIN, i64::MIN + 47, -1, 0, 47, 58, 127, i64::MAX] {
        assert_eq!(compile_triplet(invalid, 43, 50), Err(-1));
        assert_eq!(compile_triplet(49, 43, invalid), Err(-2));
    }
    for invalid_op in [i64::MIN, 0, 32, 37, 47, 58, i64::MAX] {
        assert_eq!(compile_triplet(49, invalid_op, 50), Err(-3));
    }
    // Rejection precedence is lhs, rhs, operator.
    assert_eq!(compile_triplet(0, 47, 0), Err(-1));
    assert_eq!(compile_triplet(49, 47, 0), Err(-2));
}

#[test]
fn output_boundary_and_no_spurious_artifact() {
    assert_eq!(compile_triplet(55, 42, 57), Ok(737090)); // 7*9=63
    assert_eq!(compile_triplet(56, 42, 56), Err(-6)); // 8*8=64
    assert_eq!(compile_triplet(57, 42, 57), Err(-6)); // 9*9=81
    assert_eq!(compile_triplet(54, 42, 55).unwrap() - 731672, 42);
}
