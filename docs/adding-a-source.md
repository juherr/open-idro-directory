# Adding A Source

1. Add or reuse `config/authorities/<authority-id>.yaml` for the appointed
   organisation. Reuse an existing entry when the organisation already operates
   another register rather than describing it twice.
2. Add `config/sources/<source-id>.yaml` with `authorityId`, a `registry` block
   (register URL, observation type, supported roles), and a `publication` block
   (connector, machine-readable URL, refresh schedule, verification date).
3. Set `publication.enabled: false` until the connector is complete and tested.
4. Inspect the public source manually and choose the least fragile mechanism: API, download, stable endpoint, then HTML.
5. Create `src/connectors/<source-id>/`.
6. Implement `fetch`, `parse`, and `normalize` behind the `RegistryConnector` contract.
7. Preserve raw source values and source-specific fields.
8. Add fixture-based parser and normalization tests.
9. Add an opt-in live integration test if useful.
10. Enable the source only after `bun run check` succeeds.
11. Document licensing and known limitations.
