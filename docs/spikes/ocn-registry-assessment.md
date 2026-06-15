# OCN Registry Assessment

Status: NO-GO until proven otherwise.

## Questions To Answer

- Is there a verified public production smart-contract deployment?
- Is there a public RPC endpoint that can read it reproducibly?
- Do list-party calls still work?
- How many parties exist?
- Are records production data rather than test or demo data?
- Do records include country code, party ID, role, node, or service metadata?
- When was the latest meaningful update?
- Is redistribution legally and technically reasonable?

## Stop Conditions

Do not implement a production connector if any condition applies:

- no production contract address can be verified;
- no public RPC is available;
- the contract cannot be read reproducibly;
- entries are empty, stale, or mostly test data;
- organization attribution is impossible;
- source status cannot be verified.

## Current Decision

NO-GO. The repository has not yet verified a current public production OCN
registry with useful, redistributable records.
