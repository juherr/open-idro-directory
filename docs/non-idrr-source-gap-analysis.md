# Non-IDRR Source Gap Analysis

Generated as the first milestone for the complementary-source pipeline. No non-IDRR
source is enabled by this report.

## Current IDRR Coverage

The official registry pipeline currently covers these jurisdictions through source
descriptors under `config/sources`: AT, BE, CH, DE, DK, FI, FR, GR, HU, IE, LT, LU,
LV, NL, PL, PT, SE, and SI.

Current enabled registry output contains 7362 records across the active source
set. Disabled descriptors exist for jurisdictions where no stable public list has
been identified yet, such as CY, ES, and GB.

## Current Semantics

The current official data model stores `NormalizedRegistryRecord` values keyed by:

```text
registryId + ":" + countryCode + ":" + partyId + ":" + role
```

The model supports roles, statuses, organization details, raw source provenance,
and source-level `official` metadata. It does not treat organization names as
identifiers.

## Data-Model Gaps

Before this milestone the project did not represent:

- explicit identifier schemes such as eMI3, OCPI, OCN, hub IDs, national IDs, or
  EVSE prefixes;
- explicit authority levels beyond the `official` boolean;
- observation types such as network registration or infrastructure observation;
- confidence reasons per observation;
- source-assessment scores;
- alias and equivalence evidence;
- conflict reports between official and secondary data.

The new `IdentifierObservation` model fills this gap without changing
`data/registry.*`.

## Candidate Sources

| Category              | Candidate                                                | Expected value                                                         | Overlap risk                                              | Legal/licensing                                                                                                          | Recommendation                                                                         | Fragility | Maintenance |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------- | ----------- |
| EVSEID.eu             | `https://evseid.eu/public/ids`                           | Historical or parallel identifiers, mostly AT and some other countries | High for AT because Austria is already covered officially | Public page exists; robots endpoint did not return a robots policy during inspection; redistribution needs clarification | Defer connector until portal matrix, license, and personal-data filtering are complete | Medium    | Medium      |
| Public EVSE datasets  | National Access Points and charge-point registries       | EVSE prefix observations and operator aliases                          | Medium to high by country                                 | Varies by dataset                                                                                                        | Build catalog first, then implement one high-value open dataset                        | Medium    | Medium      |
| Public OCPI endpoints | Public versions/locations endpoints                      | OCPI party observations and EVSE prefix usage                          | Medium                                                    | Must verify terms and owner                                                                                              | Catalog only until endpoints are proven public and stable                              | High      | High        |
| Roaming directories   | Hubject, Gireve, e-clearing.net, ENAPI, national hubs    | Network membership observations                                        | High                                                      | Many are partner or authenticated portals                                                                                | Document partnership opportunities unless stable technical IDs are public              | High      | Medium      |
| Equivalence tables    | National or network-specific mappings                    | Alias evidence                                                         | Medium                                                    | Varies                                                                                                                   | Implement only explicit mappings, never fuzzy name matches                             | Medium    | Low         |
| OCN Registry          | Public blockchain registry, if current deployment exists | OCN party IDs                                                          | Unknown                                                   | Must verify contract, RPC, and reuse terms                                                                               | Time-boxed spike; default NO-GO                                                        | High      | High        |
| Direct declarations   | `/.well-known` or signed records                         | Self-asserted aliases                                                  | Low initially                                             | Project-defined                                                                                                          | Proposal only in this milestone                                                        | Medium    | Medium      |

## EVSEID.eu Initial Finding

On 2026-06-15, `https://evseid.eu/` returned a public HTML application operated by
Smart Mobility Power GmbH and redirected to an overview page. The navigation
exposes `/public/ids`, and that page returns a public table headed `Operator IDs
(EVSEID)` with columns `ID` and `Owner`. The visible values are not sufficient to
identify legal holders; some entries are owner classes such as `Person`, which
must not be republished as personal contact data.

Default classification remains:

```yaml
authorityLevel: SECONDARY
observationType: LEGACY_ASSIGNMENT
```

No connector should be enabled until the country portal matrix, licensing review,
personal-data handling, and overlap report are complete.

## Duplicate-Source Risks

- AT: high risk because `at-ladestellen` is already authoritative.
- DE, FR, PL, PT, SI, and other current IDRO countries: any secondary observation
  must remain separate from official assignments.
- OCPI and EVSE prefixes must not be normalized into eMI3 assignments.

## Implementation Recommendation

Keep official IDRR-derived records in `data/registry.*`. Generate complementary
observations and diagnostics under `data/reports/*` until at least one secondary
source proves legal clarity, unique value, and stable structure.

## Rejected Or Deferred Sources

- Authenticated roaming hubs are deferred until explicit access and redistribution
  rights exist.
- OCN Registry is a spike only; no production connector should be added without a
  verified current public deployment.
- EVSEID.eu is deferred pending portal-by-portal review and legal clarification.
