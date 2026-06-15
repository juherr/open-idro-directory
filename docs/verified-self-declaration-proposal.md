# Verified Self-Declaration Proposal

Direct organization declarations are out of scope for this milestone. A future
design can add self-asserted observations without confusing them with official
IDRO assignments.

## Candidate Verification Methods

- `/.well-known/emobility-party.json`
- DNS TXT validation
- signed GitHub pull request
- signed JSON document
- domain-email verification
- cross-reference with an official or network source

## Threat Model

Risks include domain takeover, stale declarations, impersonation, disputed
ownership, organization rename or merger, and malicious alias claims.

## Required Semantics

Verified declarations must remain:

```yaml
authorityLevel: SELF_ASSERTED
observationType: SELF_DECLARATION
```

They must include evidence URL, retrieval timestamps, revocation state,
revalidation timestamp, and an audit trail.

## Disputes And Revocation

The project should support revoking declarations without deleting historical
evidence. Disputed declarations should remain visible as conflicts until resolved
or withdrawn.
