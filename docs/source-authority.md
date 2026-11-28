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
any existing source. Role-scoped precedence is still resolved by connectors
rather than by the descriptor.

## Authority And Observing Register

Being authoritative is a property of the organisation; what a given record
says depends on the register it was read from. A register is the issuing
register only for the countries it covers (`registry.jurisdictions`, which may
narrow its authority's jurisdictions). For any other country, the same
register is an observing register: its record is a `CROSS_REGISTER_LISTING`,
published with `official: false`, and the country of the prefix stays the
issuing country. See [data-model.md](data-model.md#issuing-country-and-observing-register).

EV Roam is the case where the two differ. Its authority keeps `GB` and `IE`,
but `gb-evroam` declares `registry.jurisdictions: [GB]`: EV Roam assigns GB
identifiers, while TII publishes the Irish IDRO register (`ie-tii`). EV Roam's
Irish entries are therefore published as listings, never as Irish assignments.

A listing does not make the observing register responsible for the
identifier, and its absence from the issuing register is not a statement that
the identifier is invalid.

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
