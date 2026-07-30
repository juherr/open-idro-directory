# Open IDRO Best Practices

This document collects practical publication guidance for national ID Registration
Organisation (IDRO) services. It consolidates what national IDRO organisations have
stated publicly about their own registers, and what this project observes while
consuming those registers.

Open IDRO Directory is an independent aggregation project. It does not issue
e-mobility identifiers, does not appoint IDROs, and holds no regulatory mandate.
This document is guidance, not a compliance requirement, not a standard, and not
legal advice. Nothing here creates an obligation for any organisation.

This is a working draft. It has not been reviewed or endorsed by a representative
group of national IDROs, by a standards body, or by a European institution. It
describes practices observed across a limited set of registers, not a sector-wide
consensus. A stronger status would require a public consultation with IDRO
organisations, and the wording here is expected to change if one takes place.

Recommendations use `should`. Statements about registers that already exist use the
present indicative and are verifiable from the sources this repository configures.
Each recommendation in the capability sections carries a maturity level --
`Minimum`, `Good`, `Advanced`, or `Reference implementation` -- defined in
[Maturity Levels](#maturity-levels).

Vocabularies used by Open IDRO Directory to normalize what it consumes appear here
as mapping targets and worked examples. None of them is proposed as a standard for
national registers.

## Intended Audience

The primary audience is organisations appointed as national IDROs and the technical
teams operating their public identifier registers.

Secondary audiences are competent national authorities, National Access Point
operators, registry data consumers and aggregators, interoperability and roaming
platforms, and software providers implementing IDRO publication or administration
tooling.

## Scope And Principles

- **Authoritative national source**: the appointed IDRO's own publication is the
  reference. Aggregators, roaming platforms, and directories are derived. See
  [source-authority.md](source-authority.md) for the authority-level vocabulary this
  project uses, and its rule that `AUTHORITATIVE` is never inferred from public
  availability.
- **Independence from third-party aggregators**: the register should be readable
  without a commercial account, a roaming agreement, or an aggregator platform.
- **Three distinct identities**: the appointed organisation, the register it
  operates, and the technical resource that exposes it are three separate things.
  See [data-model.md](data-model.md) for the split this project applies.
- **Transparency and auditability**: a publication date, a change history, and a
  stated reuse basis let a consumer explain where a value came from.
- **Interoperability**: identifiers should be usable across eMI3 schemes, OCPI, and
  national access points without a private translation table.
- **Registers are not directories**: an official register asserts that an identifier
  was assigned. A directory lists registers. The European Alternative Fuels
  Observatory's Identification Registration Repository is a directory of registries,
  not an issuing source.

Out of scope for this document: personal-data handling procedures, tariffs, charging
point inventories, roaming contracts, and any assertion about AFIR, public-sector
information, or data-protection compliance. Questions of that kind are listed in
[Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions) rather
than answered here.

## Evidence Base

Guidance in this document derives from three kinds of public evidence only:

- the behaviour of national registers as observed by this project's connectors and
  recorded in [source-limitations.md](source-limitations.md);
- points raised or confirmed by IDRO representatives in public issues of this
  repository;
- published national legal instruments and published reuse policies.

Correspondence with IDRO representatives is not reproduced. Only points stated or
confirmed publicly, or verifiable from published sources, are recorded here. No
individual is named; the table below cites organisations and public issue numbers.

| Feedback received                                                                       | Public reference                                                     | Resulting practice                                                     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Finnish entries published by this project were incomplete against the official register | [issue #42](https://github.com/juherr/open-idro-directory/issues/42) | Publish every issued identifier, not a filtered subset                 |
| Traficom is the Finnish IDRO; Fintraffic separately operates the National Access Point  | [issue #47](https://github.com/juherr/open-idro-directory/issues/47) | State the IDRO role explicitly and distinguish it from NAP publication |
| TII is the Irish IDRO under S.I. No. 52 of 2026 and publishes under CC BY 4.0           | [issue #45](https://github.com/juherr/open-idro-directory/issues/45) | Publish the appointing instrument and the exact attribution wording    |
| Authority, register, and publication were conflated in source metadata                  | [issue #46](https://github.com/juherr/open-idro-directory/issues/46) | Model and publish the three identities separately                      |

Counts quoted throughout this document describe the 20 sources configured in this
repository at the time of writing. `data/sources.json` is the authoritative record of
what the project currently consumes.

## Core IDRO Information

- **Legal identity and appointment** (`Minimum`): publish the organisation's legal
  name and the instrument that appoints it as IDRO. Ireland publishes S.I. No. 52 of
  2026, which appoints the National Roads Authority, operating as Transport
  Infrastructure Ireland. An appointment that is stated only in correspondence cannot
  be verified by a consumer.
- **Contact details** (`Minimum`): publish a durable role address for registration,
  correction, and dispute handling. A named personal mailbox becomes stale and turns
  an administrative contact into personal data.
- **Responsibilities and territorial scope** (`Minimum`): state the jurisdictions
  covered, as ISO 3166-1 alpha-2 codes, and state explicitly what the IDRO does not
  cover. Charging-infrastructure publication and National Access Point operation are
  frequently a different organisation's responsibility; see "National Responsibility
  Boundaries" in [source-authority.md](source-authority.md).
- **Supported roles and identifier syntax** (`Minimum`): publish which roles receive
  an identifier and in which syntax.
- **Documented role vocabulary** (`Good`): publish the native role labels the
  register uses and what each one means, so that a consumer can map them without
  guesswork. This project maps what it consumes onto `CPO`, `CSO`, `EMSP`, `NSP`,
  `HUB`, and `OTHER`; that set is an aggregation convenience, not a vocabulary
  national registers are expected to adopt.
- **Assignment procedure** (`Good`): publish eligibility conditions, required
  evidence, expected lead time, fees if any, renewal conditions, and expiry rules. A
  consumer who understands the procedure can interpret a missing identifier
  correctly.

Roles must be covered completely to be usable. Of the 20 configured sources, 18
declare both CPO and eMSP registers; two publish CPO identifiers only, so an eMSP
holding a national identifier has no public national record through those
publications.

## Public Registry Publication

- **Completeness of the current register** (`Minimum`): publish every identifier
  currently in force, without filtering by role, size, or membership.
- **Retention of lifecycle history** (`Good`): the authoritative register should
  retain the lifecycle history of every identifier it has issued, whether or not that
  history is published.
- **Public resolvability of historical entries** (`Good`, where legally permitted):
  inactive, expired, withdrawn, and revoked identifiers should remain publicly
  resolvable with an explicit terminal status. Without them, a consumer resolving a
  historical identifier cannot distinguish "never issued" from "no longer listed".
  Historical publication should not retain contact details or other personal data
  beyond what remains necessary, and national archival, retention, and
  data-protection rules govern how long an entry stays public. Permanent public
  disclosure is not presented here as universally lawful; see
  [Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions). This
  project marks an entry that disappears from an official source as `INACTIVE` with
  `metadata.inactiveReason`, and, as stated in [source-policy.md](source-policy.md),
  does not interpret disappearance as revocation.
- **Per-entry fields** (`Minimum`): identifier, role, organisation name, legal name,
  and status; assignment date and last change date at `Advanced`.
- **Explicit lifecycle status** (`Good`): publish a status per entry rather than
  implying it by presence in the list. Of the configured sources, only the French
  AFIREV register publishes a detailed lifecycle status; the others expose none, so
  connectors normalize current rows to `ACTIVE`. See "Status Normalization" in
  [source-limitations.md](source-limitations.md).
- **Documented status semantics** (`Good`): publish the meaning of each native status
  value and, at `Advanced`, the transitions permitted between them. A documented
  native vocabulary is more useful than an imported one. This project maps source
  values onto `ACTIVE`, `INACTIVE`, `RESERVED`, `REVOKED`, and `UNKNOWN` for
  aggregation; that set is not proposed as a standard for national registers.
- **Publication and update dates** (`Minimum`): date the register page, and date each
  entry's last change. A register without a date cannot be distinguished from a stale
  copy.
- **Authoritative-source notice** (`Minimum`): state what the page is, which
  organisation operates it, under which appointment, and where to report an error.
  This is the cheapest capability in this document and the one most often missing.

## Machine-Readable Access

| Format                | Purpose                          | Introduced at              | Notes                                                                                |
| --------------------- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| HTML register page    | Human consultation               | `Minimum`                  | Crawlable and linkable, without a CAPTCHA or a login                                 |
| CSV export            | Tabular reuse                    | `Good`                     | UTF-8, RFC 4180, documented delimiter; Poland publishes semicolon-delimited CSV      |
| XLSX workbook         | Tabular reuse in office tooling  | `Good`                     | Should not be the only structured form; Sweden publishes two role-specific workbooks |
| JSON or NDJSON export | Programmatic reuse               | `Advanced`                 | Documented schema and stable field names                                             |
| Read-only HTTP API    | Query and integration            | `Advanced`                 | Publicly accessible, versioned, documented, with predictable access conditions       |
| Interoperable profile | Cross-border and roaming tooling | `Reference implementation` | See [Interoperability](#interoperability)                                            |
| PDF                   | Legal archive                    | not applicable             | Not a machine-readable format; suitable beside a data export, not instead of one     |

Of the 20 configured sources, 13 expose a stable machine-readable URL and 7 require
HTML or PDF parsing. The Irish and Portuguese registers are published only as PDF and
require Poppler `pdftotext` for extraction. The Irish register URL encodes its
publication date, so every new edition changes the URL and breaks a stored link; a
stable "latest" URL beside a dated archive avoids that.

Several endpoints this project consumes are private application interfaces rather
than documented public ones: the Austrian public application supplies an API key from
its client bundle, the Latvian access point wraps an HTML table inside a JSON
response, and the Swiss register is read from a generated site page-data path. These
can change without notice and without a redirect.

Further recommendations:

- **Stable URL** (`Minimum`): the register URL should not encode the edition, the
  publication date, or an internal document identifier.
- **Declared encoding** (`Good`): serve UTF-8 and declare it.
- **Published schema** (`Advanced`): document field names, types, and value
  vocabularies beside the export.
- **Cache metadata** (`Advanced`): serve `Last-Modified` and `ETag` so consumers can
  poll cheaply.
- **Non-discriminatory access conditions** (`Advanced`): a read-only API should be
  publicly accessible under documented, non-discriminatory conditions. Where
  authentication, quotas, or rate limits are needed for operational security or abuse
  prevention, access should not depend on a commercial relationship, a roaming
  agreement, or a paid account, and the conditions should be published. CORS should
  be enabled where browser-based reuse is an intended use case. A set of static
  versioned exports is a legitimate alternative to an API.
- **Schema versioning** (`Advanced`): structured exports and APIs should publish a
  schema version. Prefer backward-compatible additions; a breaking change should take
  a new major version and should be announced before the previous one is withdrawn.
  Documentation for superseded versions should remain available so that archived
  snapshots stay interpretable.
- **Stable publication identifiers** (`Advanced`): identify the authority, the
  register, and each published snapshot with stable identifiers, and carry a
  generation timestamp. This lets consumers compare editions, deduplicate mirrors,
  and reference a specific publication in a correction request.
- **No access gate on the public register** (`Minimum`): the human-readable register
  should be reachable without a login, CAPTCHA, or anti-bot control. This project
  does not bypass such controls; see [source-policy.md](source-policy.md).
- **Integrity and authenticity** (`Reference implementation`): publish a checksum,
  such as SHA-256, for each snapshot, and link each snapshot to the one it replaces.
  A detached signature or signed manifest additionally lets a consumer verify a copy
  that has been mirrored or redistributed.
- **Embeddable view** (`Reference implementation`): an embeddable table or iframe
  must never be the only machine-readable route. This project tracks embedding work
  in [issue #27](https://github.com/juherr/open-idro-directory/issues/27),
  [issue #28](https://github.com/juherr/open-idro-directory/issues/28), and
  [issue #37](https://github.com/juherr/open-idro-directory/issues/37).

## Illustrative Publication Shapes

The shapes below are illustrative only. They describe the information an
interoperable publication needs to carry, not a schema any register is expected to
adopt. A shared machine-readable register format is being drafted in
[issue #34](https://github.com/juherr/open-idro-directory/issues/34); until that work
concludes, field names here carry no normative weight.

A minimal register entry:

```json
{
  "countryCode": "FR",
  "partyId": "ABC",
  "role": "CPO",
  "organisationName": "Example Charging",
  "legalName": "Example Charging SAS",
  "status": "ACTIVE",
  "assignedAt": "2026-01-15",
  "updatedAt": "2026-05-02"
}
```

A publication envelope carrying the provenance and integrity metadata described
above:

```json
{
  "schemaVersion": "1.0.0",
  "authorityId": "example-national-idro",
  "registryId": "example-id-register",
  "publicationId": "2026-05-02",
  "previousPublicationId": "2026-04-01",
  "generatedAt": "2026-05-02T10:15:00Z",
  "registryUrl": "https://example.test/id-register",
  "reuse": { "status": "licensed", "licence": "CC BY 4.0" },
  "checksum": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "entries": []
}
```

A change event, where a register publishes an incremental feed:

```json
{
  "eventType": "ORGANISATION_RENAMED",
  "recordId": "FR-ABC-CPO",
  "effectiveAt": "2026-05-01",
  "recordedAt": "2026-05-02T10:15:00Z",
  "reason": "Legal entity name updated",
  "previousValue": "Example Mobility SAS",
  "newValue": "Example Charging SAS"
}
```

## Reuse And Legal Information

The mechanism that permits reuse should be stated explicitly. This project records it
as `licensed`, `statutory`, `permission-granted`, `restricted`, or `unspecified`; the
definitions are in [data-model.md](data-model.md).

- **Declare the mechanism** (`Good`) in a findable place, linked from the register
  page.
- **Name, version, and link an open licence** (`Good`) where one applies. Traficom
  and Transport Infrastructure Ireland publish CC BY 4.0 terms; Via Lietuva publishes
  CC BY 4.0 and ODC-BY terms.
- **Cite legislation by a durable identifier** (`Good`) where reuse rests on statute
  rather than a licence. Spain's RIPREE relies on Law 37/2007 on the reuse of
  public-sector information, cited by its ELI URL, as amended for the transposition
  of Directive (EU) 2019/1024.
- **Publish the exact attribution wording** (`Good`) rather than a description of it.
  TII publishes the notice to be reproduced verbatim: "Contains Irish Public Sector
  Information licensed under a Creative Commons Attribution 4.0 International
  (CC BY 4.0) licence". A consumer can comply with a published string; it cannot
  comply with an intention.
- **State the carve-outs** (`Good`): TII's policy excludes personal information,
  third-party rights it is not authorized to license, and TII names, crests, logos,
  and official symbols. Carve-outs that are not published cannot be respected.
- **Publish organisations, not natural persons** (`Minimum`): use role addresses and
  legal entities. Sole traders whose legal name identifies a natural person make this
  boundary genuinely difficult; see
  [Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions).
- **Separate the software licence from the data terms** (`Good`): the licence of the
  register website or its source code is not the licence of the register contents.
- **Carry the reuse terms inside the export** (`Reference implementation`): a
  consumer that receives only the file should still be able to read the licence or
  legal basis and the attribution notice.
- **Public availability is not permission.** Of the 20 configured sources, 16 publish
  no reuse terms and are recorded as `unspecified`; three publish an explicit licence
  and one relies on a statutory basis. This project displays `unspecified` explicitly
  and does not treat it as open data.

## Data Quality And Validation

- **Syntax validation at assignment** (`Minimum`): check that the country code is
  ISO 3166-1 alpha-2 and matches the issuing jurisdiction, that the party identifier
  respects a published length and character set, and that case normalization is
  stated. This project composes `eMobilityId` as `countryCode + partyId`; see
  [data-model.md](data-model.md).
- **Duplicate detection** (`Minimum`): reject a repeated country code, party
  identifier, and role combination at assignment and at publication.
- **Mandatory-field checks** (`Minimum`): reject an incomplete row rather than
  publish it with empty fields. An empty organisation name is indistinguishable from
  an unnamed holder.
- **Role validation** (`Good`): publish one row per role, or an explicit multi-role
  field, rather than a combined type. AFIREV publishes a `BOTH` type, which this
  project expands into separate CPO and eMSP records -- an expansion the register
  could express directly.
- **Published validation rules** (`Advanced`): publish the syntax and role rules the
  register enforces, so that an applicant can pre-validate and a consumer can detect
  an anomaly.
- **Cross-register conflicts** (`Advanced`): flag identifiers that another register
  also publishes. EV Roam cross-registers Irish identifiers issued by TII; this
  project keeps those entries separate and non-authoritative rather than merging them.
- **Correction and dispute process** (`Advanced`): publish the route, the expected
  response time, and how the outcome is recorded. Source owners may also request
  corrections from aggregators; see [source-policy.md](source-policy.md).
- **Audit trail** (`Advanced`): record the assignment date, every change date, the
  reason for a change, and retain history. A row should never be deleted silently; it
  should move to a terminal status.
- **Distinguish why a record changed** (`Advanced`): correcting an erroneous value is
  not the same event as a legal-name change, a role being added or removed, a
  suspension, a revocation, an expiry, or a transfer between legal entities, and a
  retroactive correction is different again. A consumer that cannot tell them apart
  cannot decide whether its own stored value was ever right. Publishing a reason
  alongside each change makes the distinction usable; values such as `ASSIGNED`,
  `CORRECTED`, `ORGANISATION_RENAMED`, `ROLE_ADDED`, `ROLE_REMOVED`, `SUSPENDED`,
  `REACTIVATED`, `EXPIRED`, `REVOKED`, and `TRANSFERRED` illustrate the granularity
  that is useful. They are illustrative, not normative, until a shared schema is
  agreed.
- **Publication safety** (`Good`): do not publish a partial extract when generation
  fails. This project refuses an update whose deletion ratio, change ratio, or
  parse-error ratio exceeds a configured threshold, precisely because a truncated
  register is worse than a stale one.

## Operational Workflows

This section is indicative. It describes workflows observed or expected in
registration practice; none of it is a requirement, and a register may be excellent
without any of this tooling.

- **Application and approval**: a digital application, an evidence checklist, a
  documented decision, a decision date, and the assignment event itself.
- **Organisation and contact management**: let a holder maintain its own legal name,
  website, and role contact, subject to review.
- **Status tracking**: renewals, reminders before expiry, and recorded reasons for
  suspension or revocation.
- **Document handling**: retain appointment and eligibility evidence internally. Do
  not publish attachments that contain personal data.
- **Payment and invoicing**: where a fee applies, publish the fee schedule. Payment
  handling is an internal workflow concern, not part of the public register.
- **Internal roles**: registrar, reviewer, and read-only auditor, so that changes are
  attributable.

The public register is a published artifact of these workflows. It should not be
gated behind the workflow tooling, an account, or a payment system.

## Interoperability

- **Identifier schemes are distinct** (`Good`): eMI3 operator and provider
  identifiers, OCPI `country_code + party_id`, and EVSE prefixes are separate schemes.
  Where a national identifier is intended to be used as an OCPI party identifier, the
  mapping should be published rather than inferred. This project does not merge them
  without an explicit equivalence source; see [data-model.md](data-model.md).
- **OCPI as an optional compatibility profile** (`Reference implementation`): an
  OCPI-aligned representation, such as one shaped like `CredentialsRole`, may be
  published so that existing roaming tooling can consume party identity without
  implementing a new representation. It should remain an integration profile beside
  the register, not the register itself: `CredentialsRole` is designed for a
  credentials exchange and does not carry legal appointment, registry authority,
  provenance, reuse conditions, assignment dates, lifecycle history, correction
  history, or publication versions. The authoritative registry model should stay
  independent of the OCPI credentials workflow and retain that metadata. One
  configured source is read over OCPI today -- Via Lietuva's `ocpi/2.3.0/locations`
  endpoint -- but it yields CPO party identifiers derived from charging locations,
  not an eMSP register; that is a workaround for a missing register export. A
  publication profile is being drafted in
  [issue #48](https://github.com/juherr/open-idro-directory/issues/48).
- **Shared machine-readable format** (`Reference implementation`): a common IDRO
  register format is being drafted in
  [issue #34](https://github.com/juherr/open-idro-directory/issues/34). No claim of
  standard status is made for either draft.
- **AFIR context**: identifier registration is published in the context of
  alternative-fuels infrastructure regulation. This document makes no claim about
  what that regulation requires; see
  [Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions).
- **National access points** (`Good`, where applicable): where a National Access
  Point catalogues relevant mobility reference datasets, the IDRO register should be
  linked from it while identifier registration data stays distinct from
  charging-infrastructure datasets. Not every access point has the mandate, the
  dataset category, or the organisational scope to catalogue administrative reference
  data, so this is conditional rather than universal. Finland is the clearest example
  of two organisations with two different mandates.
- **Supranational directories** (`Minimum`): keep the entry in the EAFO
  Identification Registration Repository pointing at the current register URL. A
  directory entry that points at a dead URL is worse than no entry.

A minimally interoperable entry carries: country code, party identifier, role,
organisation name, legal name, status, assignment date, and last change date. See
[Illustrative Publication Shapes](#illustrative-publication-shapes) for a worked,
non-normative example.

## Maturity Levels

The levels below are cumulative: each includes everything from the previous one. They
describe publication capability, not legal compliance. A register at `Minimum` may be
fully compliant with its national obligations, and a register at
`Reference implementation` may still be wrong about a given entry.

- **`Minimum`**: a complete, public, human-readable register of the identifiers
  currently in force, carrying an authoritative-source notice and a publication date,
  at a stable URL.
- **`Good`**: adds a stable tabular export, explicit reuse terms, a lifecycle status
  per entry with documented semantics, retained lifecycle history, and a published
  attribution notice.
- **`Advanced`**: adds a structured export with a documented and versioned schema, a
  read-only API under published access conditions, per-record change dates with
  retained history, published validation rules, and a documented correction process.
- **`Reference implementation`**: adds an interoperable publication profile, an
  incremental change feed carrying change reasons, an embeddable public view,
  machine-readable provenance and reuse metadata inside the export, snapshot
  checksums, and a published mapping between identifier schemes.

| Capability                                       | Introduced at              | Expectation                                                             |
| ------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------- |
| Complete list of identifiers in force            | `Minimum`                  | Unfiltered by role, size, or membership                                 |
| Organisation name and legal identity per entry   | `Minimum`                  | Legal entity, not a trading name alone                                  |
| Role per identifier                              | `Minimum`                  | Published per entry, not inferred from the page                         |
| Authoritative-source notice and IDRO contact     | `Minimum`                  | Names the operator, the appointment, and where to report an error       |
| Register publication or last-update date         | `Minimum`                  | On the register page                                                    |
| Stable register URL                              | `Minimum`                  | Does not encode the edition or the publication date                     |
| Lifecycle status per identifier                  | `Good`                     | Native vocabulary with each value defined                               |
| Retained lifecycle history                       | `Good`                     | Held authoritatively, published where legally permitted                 |
| Tabular export at a stable URL                   | `Good`                     | CSV or XLSX, UTF-8, documented delimiter                                |
| Explicit reuse terms                             | `Good`                     | A named licence or a cited statutory basis                              |
| Published attribution notice                     | `Good`                     | The exact wording to reproduce                                          |
| Structured export with a documented schema       | `Advanced`                 | JSON or NDJSON, stable field names                                      |
| Published schema version                         | `Advanced`                 | Backward-compatible additions; breaking changes announced in advance    |
| Read-only HTTP API                               | `Advanced`                 | Publicly accessible, versioned, documented, predictable access terms    |
| Per-record change dates and retained history     | `Advanced`                 | Assignment date and last change date per entry                          |
| Published identifier syntax and validation rules | `Advanced`                 | Length, character set, case normalization                               |
| Documented correction and dispute process        | `Advanced`                 | Route, expected response time, recorded outcome                         |
| Stable authority, registry, and snapshot ids     | `Advanced`                 | Plus a generation timestamp, so editions can be compared                |
| Interoperable publication profile                | `Reference implementation` | Consumable by existing roaming or registry tooling, beside the register |
| Incremental change feed with change reasons      | `Reference implementation` | Lets a consumer synchronize and tell a correction from a real change    |
| Embeddable public register view                  | `Reference implementation` | Filtered and linkable, in addition to the exports                       |
| Machine-readable provenance and reuse metadata   | `Reference implementation` | Carried inside the export, not only on the page                         |
| Snapshot checksum, optionally signed             | `Reference implementation` | Lets a consumer verify a redistributed or mirrored copy                 |

This project scores each source it consumes on eight axes recorded in
`src/domain/identifier-observation.ts`. Six of them describe what a publisher
controls and map onto the capabilities above. The remaining two, `uniquenessValue`
and `maintenanceCost`, measure this project's own ingestion economics and say nothing
about the quality of a register; they are deliberately excluded here.

| Assessment axis      | What the publisher controls                             | Related capability                     |
| -------------------- | ------------------------------------------------------- | -------------------------------------- |
| `authority`          | Whether the register is published by the appointed IDRO | Authoritative-source notice            |
| `freshness`          | Publication and per-record change dates                 | Update dates, change feed              |
| `machineReadability` | Structured export and documented schema                 | Tabular and structured exports         |
| `coverage`           | Whether all issued identifiers and roles appear         | Complete list, role per identifier     |
| `legalClarity`       | An explicit licence or a cited statutory basis          | Reuse terms, attribution notice        |
| `stability`          | URL and schema durability across editions               | Stable register URL, documented schema |

## Observed National Practices

The examples below describe what a register publishes. They are not an endorsement,
not a ranking, and not a comparison of national performance. They can change without
notice, and per-source detail is not repeated here.

| Practice                                     | Where observed              | What is verifiable                                                         |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| Explicit open licence on the register        | Finland, Ireland, Lithuania | Licence terms linked from the publisher's own reuse page                   |
| Required attribution wording published       | Ireland                     | The exact notice appears in the public-sector information policy           |
| Statutory reuse basis instead of a licence   | Spain                       | Law 37/2007, cited by its ELI identifier                                   |
| Appointing instrument published              | Ireland                     | S.I. No. 52 of 2026 in the Irish Statute Book                              |
| Detailed lifecycle status in the export      | France                      | `ACTIVE`, `INACTIVE`, and `SUSPENDED` values in the public JSON            |
| Structured export of the identifier register | Benelux, Croatia, Poland    | Public CSV export endpoints                                                |
| Role-specific structured workbooks           | Sweden                      | Separate CPO and eMSP XLSX registers                                       |
| Standards-based endpoint                     | Lithuania                   | OCPI 2.3.0 locations endpoint, CPO identifiers only                        |
| Register published as PDF                    | Ireland, Portugal           | Text extraction required; the Irish file name encodes its publication date |
| No public identifier list identified         | Cyprus                      | The source is configured but disabled                                      |

Two clarifications. The Croatian entry cites the structure of the export, not its
contents; it currently yields no records in the generated dataset. And a register can
be legally impeccable while sitting low on the maturity ladder -- the two axes are
independent.

Per-source formats, coverage, and limitations are recorded in
[source-limitations.md](source-limitations.md), and the current state of every
configured source is in `data/sources.json`.

## Open Legal And Regulatory Questions

The questions below cannot be resolved by this project. Each requires validation by
the competent national authority or by legal counsel. They are stated as questions,
not as positions, and this document takes no view on any of them.

- **Does public availability of a national register imply a right to redistribute
  it?** Sixteen of the 20 configured sources publish no reuse terms. This project
  records them as `unspecified` and does not treat them as open data.
- **Which open-data or public-sector-information regime applies to an IDRO
  register?** Directive (EU) 2019/1024 and its national transpositions may or may not
  classify such a register as a public-sector dataset, or as a high-value dataset.
- **Does alternative-fuels infrastructure regulation create a publication obligation
  for the IDRO register itself, or only for charging-infrastructure data?**
- **Are registrant contact details personal data?** Sole traders and named contacts
  may bring an otherwise administrative register within data-protection scope.
- **For how long may a withdrawn entry stay publicly resolvable?** Retention in the
  authoritative history and continued public disclosure are separate decisions, and
  national archival rules, retention limits, and data-minimization requirements may
  answer them differently. This document recommends historical resolvability only
  where it is legally permitted.
- **May a register be redistributed under terms other than the ones it carries?**
  Attribution notices constrain the form of downstream publication.
- **Which register is authoritative when two publish the same identifier?** Irish
  identifiers appear both in TII's register and in EV Roam's cross-register listing.
  This project keeps both and does not arbitrate.
- **What is the legal status of an identifier that disappears from a register?** This
  project does not treat disappearance as revocation.
- **May an aggregator publish a corrected value when a register contains an evident
  error?** This project preserves upstream values and records the discrepancy
  instead.

An answer received from a competent authority should be recorded in a public issue
and reflected both in this document and in the affected source descriptor, so that
the reasoning stays auditable.

## Deriving An Administration Console

The guidance above can be restated as the capabilities a lightweight IDRO
administration and publication console would need. This is a requirements source, not
a design.

| Console capability            | Derived from                | Data it must hold                                                                        |
| ----------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Registry record editing       | Public Registry Publication | Identifier, role, status, organisation, legal name, website, assignment and change dates |
| Assignment workflow           | Operational Workflows       | Application, evidence, decision, decision date, decision maker                           |
| Validation on save            | Data Quality And Validation | Country code, party-identifier syntax, role, duplicate check, mandatory fields           |
| Status transitions            | Public Registry Publication | Status vocabulary, reason, effective date                                                |
| Export generation             | Machine-Readable Access     | CSV, XLSX, JSON, and NDJSON at stable URLs                                               |
| Read-only API                 | Machine-Readable Access     | Versioned endpoints, documented schema, cache headers                                    |
| Embeddable public view        | Machine-Readable Access     | Filtered, linkable table                                                                 |
| Reuse metadata                | Reuse And Legal Information | Reuse status, licence or legal basis, attribution notice, redistribution flag            |
| Provenance and timestamps     | Scope And Principles        | Register URL, publication date, per-record last change, generation timestamp             |
| Audit history                 | Data Quality And Validation | Actor, change, timestamp, reason; retained after a status change                         |
| Correction and dispute intake | Data Quality And Validation | Reporter, claim, evidence, outcome, public reference                                     |
| Interoperable profile output  | Interoperability            | Shared register schema and an OCPI-aligned representation                                |

Console delivery is tracked separately. It is distinct from
[issue #56](https://github.com/juherr/open-idro-directory/issues/56), which covers a
collaboration surface operated by Open IDRO Directory for verified IDRO
representatives; the console described here would be operated by an IDRO for its own
register.

## Related Documentation

- [source-authority.md](source-authority.md) -- authority levels, observation types,
  and national responsibility boundaries.
- [source-policy.md](source-policy.md) -- source acquisition, provenance, and
  correction rules.
- [data-model.md](data-model.md) -- record key, the authority, registry, and
  publication split, and the reuse vocabulary.
- [source-limitations.md](source-limitations.md) -- per-source formats, coverage, and
  limitations.
- [adding-a-source.md](adding-a-source.md) -- how a register is onboarded into this
  project.
