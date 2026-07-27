# Source Authority

Authority levels:

- `AUTHORITATIVE`: originating IDRO or official registry source.
- `SUPRANATIONAL_DIRECTORY`: official directory of registries, not an issuing source.
- `SECONDARY`: public dataset or network-derived claim.
- `SELF_ASSERTED`: participant or self-declared registration.
- `UNVERIFIED`: unconfirmed public observation.

Observation types include official assignments, official directory entries, legacy assignments, network registrations, infrastructure observations, self declarations, and community observations.

Do not infer `AUTHORITATIVE` from public availability. Source authority and reuse conditions are exposed in API source responses so consumers can verify upstream terms.

The level lives on the authority (`config/authorities/<id>.yaml`) and the
observation type lives on the registry it operates, so a single organisation can
back several registers without repeating its metadata. See
[data-model.md](data-model.md) for the authority/registry/publication split.

Every source currently published is `AUTHORITATIVE` with an `OFFICIAL_ASSIGNMENT`
registry: the split records the distinction faithfully but does not reclassify
any existing source. Role-scoped and jurisdiction-scoped precedence, such as EV
Roam being authoritative for GB while only cross-registering IE identifiers, is
still resolved by connectors rather than by the descriptor.

## National Responsibility Boundaries

In Finland, the Finnish Transport and Communications Agency Traficom is the
appointed IDRO and issues and manages operator identifiers. The `fi-traficom`
source consumes Traficom's public ID register. Fintraffic has a separate role:
it maintains Finland's National Access Point through the Traffic Data Catalogue
and publishes charging-infrastructure data. Fintraffic is not the authority or
publication source for the identifiers represented by `fi-traficom`.

In Ireland, S.I. No. 52 of 2026 appoints the National Roads Authority, operating
as Transport Infrastructure Ireland, as the IDRO. TII publishes the authoritative
Irish IDRO register consumed by `ie-tii`. Open IDRO Directory remains an
independent aggregation and is not an official TII service.
