# Data Model

The normalized record key is:

```text
registryId + ":" + countryCode + ":" + partyId + ":" + role
```

`countryCode` is uppercase ISO 3166-1 alpha-2. `partyId` is uppercased for AFIREV because its public prefixes are alphanumeric uppercase IDs. `eMobilityId` is `countryCode + partyId` without separators.

Organizations are not used as identifiers. Similar names are not merged. Source-specific fields are preserved in `metadata`.

## Complementary Observations

Non-IDRR sources use a separate `IdentifierObservation` model. Observations do
not overwrite official `NormalizedRegistryRecord` entries and are not emitted in
`data/registry.*`.

Observation records explicitly store:

- `scheme`: eMI3 operator/provider ID, OCPI party ID, OCN party ID, hub party ID,
  national internal ID, EVSE prefix, or unknown;
- `authorityLevel`: authoritative, supranational directory, secondary,
  self-asserted, or unverified;
- `observationType`: official assignment, directory entry, legacy assignment,
  network registration, infrastructure observation, self-declaration, or
  community observation;
- confidence score and reasons.

OCPI `country_code + party_id`, eMI3 IDs, and EVSE prefixes are separate schemes.
They must not be merged unless an explicit equivalence source provides evidence.
