"""Bootstrapping Atto core sources — source-only Python oracle, not compiler tests."""
import hashlib
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PINS = {
  "math": "bc26640a826c8f397702ea2cb96f5102214d5032",
  "hash": "3dc146f2df8f0450cca8fea8f7f77ea8bd8766d3",
  "cell": "a00ed65daedb05857c9351989a6dc9a7453f60c8"
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
        for state in [0,1,17,569,p-1]:
            for byte in range(256):
                candidate = state*31+byte
                for _ in range(31):
                    if candidate >= p:
                        candidate -= p
                self.assertEqual(candidate,(state*31+byte)%p)
        self.assertEqual((17*31+42)*31+7,17646)

    def test_no_fake_cell_compiler_authority(self):
        text = (ROOT / "library" / "atto.core" / "cell.atto").read_text("utf-8")
        self.assertIn("not interior mutability",text)
        self.assertIn("can_borrow_write",text)

if __name__ == "__main__":
    unittest.main()
