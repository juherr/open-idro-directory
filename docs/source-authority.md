# Source Authority

Authority levels:

- `AUTHORITATIVE`: originating IDRO or official registry source.
- `SUPRANATIONAL_DIRECTORY`: official directory of registries, not an issuing source.
- `SECONDARY`: public dataset or network-derived claim.
- `SELF_ASSERTED`: participant or self-declared registration.
- `UNVERIFIED`: unconfirmed public observation.

Observation types include official assignments, official directory entries, legacy assignments, network registrations, infrastructure observations, self declarations, and community observations.

Do not infer `AUTHORITATIVE` from public availability. Source authority and license caveats are exposed in API source responses so consumers can verify upstream terms.
