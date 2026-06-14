# Adding A Source

1. Add `config/sources/<source-id>.yaml`.
2. Set `enabled: false` until the connector is complete and tested.
3. Inspect the public source manually and choose the least fragile mechanism: API, download, stable endpoint, then HTML.
4. Create `src/connectors/<source-id>/`.
5. Implement `fetch`, `parse`, and `normalize` behind the `RegistryConnector` contract.
6. Preserve raw source values and source-specific fields.
7. Add fixture-based parser and normalization tests.
8. Add an opt-in live integration test if useful.
9. Enable the source only after `bun run check` succeeds.
10. Document licensing and known limitations.
