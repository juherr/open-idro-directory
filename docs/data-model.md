# Data Model

The normalized record key is:

```text
registryId + ":" + countryCode + ":" + partyId + ":" + role
```

`countryCode` is uppercase ISO 3166-1 alpha-2. `partyId` is uppercased for AFIREV because its public prefixes are alphanumeric uppercase IDs. `eMobilityId` is `countryCode + partyId` without separators.

Organizations are not used as identifiers. Similar names are not merged. Source-specific fields are preserved in `metadata`.
