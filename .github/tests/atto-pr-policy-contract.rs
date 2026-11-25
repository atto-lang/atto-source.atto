use std::fs;
fn block() -> String {
    let source = fs::read_to_string("AGENTS.md").expect("AGENTS.md must exist");
    let start_tag = "<!-- org-merge-review-policy:begin -->";
    let end_tag = "<!-- org-merge-review-policy:end -->";
    assert_eq!(source.matches(start_tag).count(), 1, "policy start marker must be unique");
    assert_eq!(source.matches(end_tag).count(), 1, "policy end marker must be unique");
    let start = source.find(start_tag).unwrap();
    let end = source.find(end_tag).unwrap();
    assert!(start < end, "policy marker order");
    source[start..end].to_string()
}
#[test] fn delegate_to_canonical_policy_without_stale_local_quorum() {
    let s = block();
    for required in ["sole organization-level review", "does not independently impose",
                     "either", "the1mills", "ORESoftware", "2148448", "11139560",
                     "without self-approval", "effective GitHub protections",
                     "remains a central governance decision", "not activated locally"] {
        assert!(s.contains(required), "missing delegation safeguard: {required}");
    }
    for stale in ["Ready age 0–72h", "Ready age 72–240h", "Ready age ≥240h",
                  "fresh post-boundary reviews from all four"] {
        assert!(!s.contains(stale), "local policy drift: {stale}");
    }
}
#[test] fn holds_and_real_ci() {
    let s = block();
    for required in ["keep-as-draft", "keep-draft", "not-ready",
                     "passing exact-head material CI", "verified current labels",
                     "mandatory competing/overlapping-PR audit", "CHANGES_REQUESTED"] {
        assert!(s.contains(required), "missing safety gate: {required}");
    }
}
#[test] fn canonical_source_and_private_code_safety() {
    let s = block();
    for required in ["https://github.com/atto-lang/.github/blob/main/AGENTS.md",
                     "CODEOWNERS", "GitHub protections", "Approval policy text is not merge authorization",
                     "authorized private SHA-verified Git-tree carrier", "Never forge reviews"] {
        assert!(s.contains(required), "safety policy missing: {required}");
    }
    let source = fs::read_to_string("AGENTS.md").unwrap();
    assert_eq!(source.matches("<!-- org-zero-step-ci-recovery:begin -->").count(), 1);
    assert!(source.contains("Explicit export DENIED/unapproved"));
}
#[test] fn workflow_runs_on_exact_head_without_checkout_tokens() {
    let flow = fs::read_to_string(".github/workflows/atto-pr-policy-parity.yml")
        .expect("governance workflow must exist");
    for required in [
        "pull_request:", "push:", "workflow_dispatch:",
        "EXPECTED_HEAD: ${{ github.event.pull_request.head.sha || github.sha }}",
        "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
        "persist-credentials: false",
        "test \"$(git rev-parse HEAD)\" = \"$EXPECTED_HEAD\"",
        "rustc --edition=2021 -D warnings --test",
    ] {
        assert!(flow.contains(required), "exact-head CI requirement missing: {required}");
    }
    assert!(!flow.contains("paths:"), "required policy check cannot be path-skipped");
}
