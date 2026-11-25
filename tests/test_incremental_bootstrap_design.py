"""Host-only acceptance scenario for the pinned shared planner; NOT compiler evidence."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
shared = Path(sys.argv.pop(1)).resolve()
sys.path.insert(0, str(shared))
from experiments.namespace_incremental_v1 import InvalidSnapshot, plan_incremental

def h(char):
    return char * 64

def snapshot():
    pkg = "bootstrap@pinned"
    ns = ["lexer", "typing", "emitter"]
    files = [{"package": pkg, "namespace": ns[i % 3],
              "path": f"src/part{i}.atto", "source_sha": h("a")} for i in range(10)]
    files.extend({"package": pkg, "namespace": None, "path": f"src/{name}.atto",
                  "source_sha": h("a"), "interface_sha": h("b"), "imports": [],
                  "inlines": []} for name in ("one", "two"))
    namespaces = [{"package": pkg, "name": name, "interface_sha": h("b"),
                   "imports": [], "inlines": []} for name in ns]
    return {"semantic_profile": h("1"), "codegen_profile": h("2"),
            "packages": [{"id": pkg, "manifest_sha": h("3")}],
            "files": files, "namespaces": namespaces}

class BootstrapDesign(unittest.TestCase):
    def test_no_compiler_or_cache_authority_claim(self):
        ledger = json.loads((ROOT / "contracts/incremental-compilation-rollout-v1.json").read_text())
        self.assertEqual(ledger["status"], "BOOTSTRAP_DESIGN_ONLY")
        self.assertIs(ledger["implementation_complete"], False)
        self.assertIs(ledger["executed_compiler_guest_evidence"], False)
        self.assertEqual(ledger["reference_planner_commit"], "8b0b5bc2371fd73e71b6967d64b13abc8f98b7fc")

    def test_cold_noop_and_isolated_file_edit(self):
        old = snapshot()
        self.assertEqual(len(plan_incremental(None, old).codegen), 5)
        self.assertEqual(plan_incremental(old, copy.deepcopy(old)).codegen, ())
        new = copy.deepcopy(old)
        new["files"][-2]["source_sha"] = h("c")
        self.assertEqual(plan_incremental(old, new).codegen,
                         ("bootstrap@pinned::@file:src/one.atto",))

    def test_namespace_member_edit_and_abi_importer(self):
        old = snapshot()
        old["namespaces"][1]["imports"] = ["bootstrap@pinned::lexer"]
        new = copy.deepcopy(old)
        new["files"][0]["source_sha"] = h("c")
        self.assertEqual(plan_incremental(old, new).codegen, ("bootstrap@pinned::lexer",))
        new["namespaces"][0]["interface_sha"] = h("d")
        self.assertEqual(set(plan_incremental(old, new).recheck),
                         {"bootstrap@pinned::lexer", "bootstrap@pinned::typing"})

    def test_missing_interface_and_import_fail_closed(self):
        old = snapshot()
        new = copy.deepcopy(old)
        del new["files"][-1]["interface_sha"]
        with self.assertRaises(InvalidSnapshot):
            plan_incremental(old, new)
        new = copy.deepcopy(old)
        new["files"][-1]["imports"] = ["bootstrap@pinned::missing"]
        with self.assertRaises(InvalidSnapshot):
            plan_incremental(old, new)

if __name__ == "__main__":
    unittest.main()
