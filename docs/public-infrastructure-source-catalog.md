# Public Infrastructure Source Catalog

This catalog tracks public datasets that may provide EVSE prefixes, operator
names, OCPI party fields, or charging-location identifiers. Catalog inclusion is
not approval to publish data.

| Source ID       | Region                    | Owner                  | Public URL                   | Access format | License                        | EVSE IDs | Operator names | OCPI fields  | Machine-readable | Recommendation                 |
| --------------- | ------------------------- | ---------------------- | ---------------------------- | ------------- | ------------------------------ | -------- | -------------- | ------------ | ---------------- | ------------------------------ |
| TBD             | EU national access points | National NAP operators | Varies                       | Varies        | Varies                         | Likely   | Likely         | Rare         | Varies           | Investigate country by country |
| open-charge-map | Global                    | Open Charge Map        | `https://openchargemap.org/` | API           | Open data terms require review | Often    | Often          | Inconsistent | Yes              | Low-confidence discovery only  |

Extraction rules:

- complete EVSE IDs may produce `EVSE_PREFIX` observations only;
- observed prefixes use `authorityLevel: UNVERIFIED`;
- observed prefixes use `observationType: INFRASTRUCTURE_OBSERVATION`;
- private or residential location details must not be published solely for
  identifier discovery.
