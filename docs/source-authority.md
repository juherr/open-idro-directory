# Source Authority

Authority levels:

- `AUTHORITATIVE`: originating IDRO or official registry source.
- `SUPRANATIONAL_DIRECTORY`: official directory of registries, not an issuing source.
- `SECONDARY`: public dataset or network-derived claim.
- `SELF_ASSERTED`: participant or self-declared registration.
- `UNVERIFIED`: unconfirmed public observation.

Observation types include official assignments, official directory entries, legacy assignments, network registrations, infrastructure observations, self declarations, and community observations.

Do not infer `AUTHORITATIVE` from public availability. Source authority and reuse conditions are exposed in API source responses so consumers can verify upstream terms.

## National Responsibility Boundaries

In Finland, the Finnish Transport and Communications Agency Traficom is the
appointed IDRO and issues and manages operator identifiers. The `fi-traficom`
source consumes Traficom's public ID register. Fintraffic has a separate role:
it maintains Finland's National Access Point through the Traffic Data Catalogue
and publishes charging-infrastructure data. Fintraffic is not the authority or
publication source for the identifiers represented by `fi-traficom`.
