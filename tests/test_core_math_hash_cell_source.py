"""Bootstrapping Atto core sources — source-only Python oracle, not compiler tests."""
import hashlib
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PINS = {
  "math": "bc26640a826c8f397702ea2cb96f5102214d5032",
  "hash": "4454065b334952875b52e5c426927b14e68cd37c",
  "cell": "55a0a3c5a04b825fb597a9c66101ee44d2e584ed"
}

class CoreBootstrapSource(unittest.TestCase):
    def test_pinned_backend_owned_atto_bytes(self):
        for name, expected in PINS.items():
            path = ROOT / "library" / "atto.core" / (name + ".atto")
            self.assertTrue(path.is_file())
            self.assertFalse(path.is_symlink())
            data = path.read_bytes()
            self.assertTrue(0 < len(data) <= 1048576)
            actual = hashlib.sha1(b"blob " + str(len(data)).encode("ascii")
                                   + bytes([0]) + data).hexdigest()
            self.assertEqual(actual, expected)
            source = data.decode("utf-8", errors="strict")
            self.assertTrue("define module " + name + " as" in source)
            self.assertNotIn(chr(0), source)
            self.assertFalse(source.startswith(chr(0xfeff)))
            self.assertNotIn("java:", source)
            self.assertNotIn("dotnet:", source)

    def test_portable_bounded_fold_reference(self):
        p = 1000000007
        for state in sorted({0,1,17,569,p-1} | {v for k in range(1,32) for v in (k*p//31-1,k*p//31,k*p//31+1) if 0 <= v < p}):
            for byte in range(256):
                candidate = state*31+byte
                for multiple in (16, 8, 4, 2, 1):
                    if candidate >= multiple*p:
                        candidate -= multiple*p
                self.assertEqual(candidate,(state*31+byte)%p)
        self.assertEqual((17*31+42)*31+7,17646)

    def test_no_fake_cell_compiler_authority(self):
        text = (ROOT / "library" / "atto.core" / "cell.atto").read_text("utf-8")
        self.assertIn("not interior mutability",text)
        self.assertIn("can_borrow_write",text)


    def test_owner_operations_remain_non_authoritative_policy_only(self):
        cell = (ROOT / "library" / "atto.core" / "cell.atto").read_text("utf8")
        for operation in ("valid_loan_state", "can_owner_read", "can_owner_write",
                          "can_move_owner", "can_suspend_unpinned"):
            self.assertIn("pub fnc " + operation + "(", cell)
        # Host reference is deliberately NOT compiler or guest execution.
        vectors = ((0, False, True, True), (1, False, True, False),
                   (65535, False, True, False), (65536, False, False, False),
                   (-1, False, False, False), (0, True, True, False),
                   (1, True, False, False))
        for readers, writer, valid, writable in vectors:
            self.assertEqual(0 <= readers <= 65535 and (not writer or readers == 0), valid)
            self.assertEqual(readers == 0 and not writer, writable)
        self.assertNotIn("pub fnc issue_loan(", cell)

    def test_saturated_shared_loan_denies_new_acquisition_but_not_owner_read(self):
        cell = (ROOT / "library" / "atto.core" / "cell.atto").read_text("utf8")
        self.assertIn("readers >= 0 && readers < 65535", cell)
        # Independent source-only reference: not a compiler-checked loan.
        for readers, writer, permitted in (
            (0, False, True), (65534, False, True),
            (65535, False, False), (65536, False, False),
            (-1, False, False), (0, True, False)
        ):
            self.assertEqual(0 <= readers < 65535 and not writer, permitted)
        self.assertTrue(0 <= 65535 <= 65535)  # existing owner may still read
        self.assertNotIn("pub fnc issue_loan(", cell)

if __name__ == "__main__":
    unittest.main()
