# Open IDRO Best Practices

This document collects practical publication guidance for national ID Registration
Organisation (IDRO) services. It consolidates what national IDRO organisations have
stated publicly about their own registers, and what this project observes while
consuming those registers.

Open IDRO Directory is an independent aggregation project. It does not issue
e-mobility identifiers, does not appoint IDROs, and holds no regulatory mandate.
This document is guidance, not a compliance requirement, not a standard, and not
legal advice. Nothing here creates an obligation for any organisation.

Recommendations use `should`. Statements about registers that already exist use the
present indicative and are verifiable from the sources this repository configures.
Each recommendation belongs to a maturity level -- `Minimum`, `Good`, `Advanced`, or
`Reference implementation` -- defined in [Maturity Levels](#maturity-levels).

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

- **Legal identity and appointment**: publish the organisation's legal name and the
  instrument that appoints it as IDRO. Ireland publishes S.I. No. 52 of 2026, which
  appoints the National Roads Authority, operating as Transport Infrastructure
  Ireland. An appointment that is stated only in correspondence cannot be verified by
  a consumer.
- **Contact details**: publish a durable role address for registration, correction,
  and dispute handling. A named personal mailbox becomes stale and turns an
  administrative contact into personal data.
- **Responsibilities and territorial scope**: state the jurisdictions covered, as
  ISO 3166-1 alpha-2 codes, and state explicitly what the IDRO does not cover.
  Charging-infrastructure publication and National Access Point operation are
  frequently a different organisation's responsibility; see "National Responsibility
  Boundaries" in [source-authority.md](source-authority.md).
- **Assignment procedure**: publish eligibility conditions, required evidence,
  expected lead time, fees if any, renewal conditions, and expiry rules. A consumer
  who understands the procedure can interpret a missing identifier correctly.
- **Supported roles and identifier formats**: publish which roles receive an
  identifier and in which syntax. This project normalizes roles to `CPO`, `CSO`,
  `EMSP`, `NSP`, `HUB`, and `OTHER`; a register that publishes a role per entry maps
  onto that vocabulary without guesswork.

Roles must be covered completely to be usable. Of the 20 configured sources, 18
declare both CPO and eMSP registers; two publish CPO identifiers only, so an eMSP
holding a national identifier has no public national record through those
publications.

## Public Registry Publication

- **Completeness**: publish every identifier the IDRO has issued, including inactive
  and withdrawn ones. Without them, a consumer resolving a historical identifier
  cannot distinguish "never issued" from "no longer listed". This project marks an
  entry that disappears from an official source as `INACTIVE` with
  `metadata.inactiveReason`, and, as stated in [source-policy.md](source-policy.md),
  does not interpret disappearance as revocation.
- **Per-entry fields**: identifier, role, organisation name, legal name, status,
  assignment date, and last change date.
- **Explicit lifecycle status**: publish a status per entry rather than implying it
  by presence in the list. Of the configured sources, only the French AFIREV register
  publishes a detailed lifecycle status; the others expose none, so connectors
  normalize current rows to `ACTIVE`. See "Status Normalization" in
  [source-limitations.md](source-limitations.md).
- **Published status vocabulary**: define each status term. This project's normalized
  set -- `ACTIVE`, `INACTIVE`, `RESERVED`, `REVOKED`, `UNKNOWN` -- is a workable
  target.
- **Publication and update dates**: date the register page, and date each entry's
  last change. A register without a date cannot be distinguished from a stale copy.
- **Authoritative-source notice**: state what the page is, which organisation
  operates it, under which appointment, and where to report an error. This is the
  cheapest capability in this document and the one most often missing.

## Machine-Readable Access

| Format                | Purpose                          | Introduced at              | Notes                                                                                |
| --------------------- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| HTML register page    | Human consultation               | `Minimum`                  | Crawlable and linkable, without a CAPTCHA or a login                                 |
| CSV export            | Tabular reuse                    | `Good`                     | UTF-8, RFC 4180, documented delimiter; Poland publishes semicolon-delimited CSV      |
| XLSX workbook         | Tabular reuse in office tooling  | `Good`                     | Should not be the only structured form; Sweden publishes two role-specific workbooks |
| JSON or NDJSON export | Programmatic reuse               | `Advanced`                 | Documented schema and stable field names                                             |
| Read-only HTTP API    | Query and integration            | `Advanced`                 | Unauthenticated, versioned, CORS-enabled                                             |
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

- **Stable URL**: the register URL should not encode the edition, the publication
  date, or an internal document identifier.
- **Published schema**: document field names, types, and value vocabularies beside
  the export, at `Advanced` and above.
- **Cache metadata**: serve `Last-Modified` and `ETag` so consumers can poll cheaply.
- **Declared encoding**: serve UTF-8 and declare it.
- **No access gate**: the public register should be reachable without a login,
  CAPTCHA, or anti-bot control. This project does not bypass such controls; see
  [source-policy.md](source-policy.md).
- **Embeddable view**: an embeddable table or iframe is a
  `Reference implementation` capability and must never be the only machine-readable
  route. This project tracks embedding work in
  [issue #27](https://github.com/juherr/open-idro-directory/issues/27),
  [issue #28](https://github.com/juherr/open-idro-directory/issues/28), and
  [issue #37](https://github.com/juherr/open-idro-directory/issues/37).

## Reuse And Legal Information

The mechanism that permits reuse should be stated explicitly. This project records it
as `licensed`, `statutory`, `permission-granted`, `restricted`, or `unspecified`; the
definitions are in [data-model.md](data-model.md).

- **Declare the mechanism** in a findable place, linked from the register page.
- **Name, version, and link an open licence** where one applies. Traficom and
  Transport Infrastructure Ireland publish CC BY 4.0 terms; Via Lietuva publishes
  CC BY 4.0 and ODC-BY terms.
- **Cite legislation by a durable identifier** where reuse rests on statute rather
  than a licence. Spain's RIPREE relies on Law 37/2007 on the reuse of public-sector
  information, cited by its ELI URL, as amended for the transposition of Directive
  (EU) 2019/1024.
- **Publish the exact attribution wording** rather than a description of it. TII
  publishes the notice to be reproduced verbatim: "Contains Irish Public Sector
  Information licensed under a Creative Commons Attribution 4.0 International
  (CC BY 4.0) licence". A consumer can comply with a published string; it cannot
  comply with an intention.
- **State the carve-outs**: TII's policy excludes personal information, third-party
  rights it is not authorized to license, and TII names, crests, logos, and official
  symbols. Carve-outs that are not published cannot be respected.
- **Publish organisations, not natural persons**: use role addresses and legal
  entities. Sole traders make this boundary genuinely difficult; see
  [Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions).
- **Separate the software licence from the data terms**: the licence of the register
  website or its source code is not the licence of the register contents.
- **Public availability is not permission.** Of the 20 configured sources, 16 publish
  no reuse terms and are recorded as `unspecified`; three publish an explicit licence
  and one relies on a statutory basis. This project displays `unspecified` explicitly
  and does not treat it as open data.

## Data Quality And Validation

- **Syntax validation at assignment**: check that the country code is ISO 3166-1
  alpha-2 and matches the issuing jurisdiction, that the party identifier respects a
  published length and character set, and that case normalization is stated. This
  project composes `eMobilityId` as `countryCode + partyId`; see
  [data-model.md](data-model.md).
- **Role validation**: publish one row per role, or an explicit multi-role field,
  rather than a combined type. AFIREV publishes a `BOTH` type, which this project
  expands into separate CPO and eMSP records -- an expansion the register could
  express directly.
- **Duplicate detection**: reject a repeated country code, party identifier, and role
  combination at assignment and at publication.
- **Mandatory-field checks**: reject an incomplete row rather than publish it with
  empty fields. An empty organisation name is indistinguishable from an unnamed
  holder.
- **Cross-register conflicts**: flag identifiers that another register also publishes.
  EV Roam cross-registers Irish identifiers issued by TII; this project keeps those
  entries separate and non-authoritative rather than merging them.
- **Correction and dispute process**: publish the route, the expected response time,
  and how the outcome is recorded. Source owners may also request corrections from
  aggregators; see [source-policy.md](source-policy.md).
- **Audit trail**: record the assignment date, every change date, the reason for a
  status change, and retain history. A row should never be deleted silently; it
  should move to a terminal status.
- **Publication safety**: do not publish a partial extract when generation fails.
  This project refuses an update whose deletion ratio, change ratio, or parse-error
  ratio exceeds a configured threshold, precisely because a truncated register is
  worse than a stale one.

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

- **Identifier schemes are distinct**: eMI3 operator and provider identifiers, OCPI
  `country_code + party_id`, and EVSE prefixes are separate schemes. Where a national
  identifier is intended to be used as an OCPI party identifier, the mapping should
  be published rather than inferred. This project does not merge them without an
  explicit equivalence source; see [data-model.md](data-model.md).
- **OCPI publication**: exposing the register through an OCPI `CredentialsRole`
  shape would let existing roaming tooling consume it directly. One configured source
  is read over OCPI today -- Via Lietuva's `ocpi/2.3.0/locations` endpoint -- but it
  yields CPO party identifiers derived from charging locations, not an eMSP register.
  That is a workaround for a missing register export, not a model publication. A
  publication profile is being drafted in
  [issue #48](https://github.com/juherr/open-idro-directory/issues/48).
- **Shared machine-readable format**: a common IDRO register format is being drafted
  in [issue #34](https://github.com/juherr/open-idro-directory/issues/34). The
  `Reference implementation` level anticipates it. No claim of standard status is
  made for either draft.
- **AFIR context**: identifier registration is published in the context of
  alternative-fuels infrastructure regulation. This document makes no claim about
  what that regulation requires; see
  [Open Legal And Regulatory Questions](#open-legal-and-regulatory-questions).
- **National access points**: link the IDRO register from the national access point
  catalogue while keeping it distinct from charging-infrastructure datasets. Finland
  is the clearest example of two organisations with two different mandates.
- **Supranational directories**: keep the entry in the EAFO Identification
  Registration Repository pointing at the current register URL. A directory entry
  that points at a dead URL is worse than no entry.

A minimally interoperable entry carries: country code, party identifier, role,
organisation name, legal name, status, assignment date, and last change date.

## Maturity Levels

The levels below are cumulative: each includes everything from the previous one. They
describe publication capability, not legal compliance. A register at `Minimum` may be
fully compliant with its national obligations, and a register at
`Reference implementation` may still be wrong about a given entry.

- **`Minimum`**: a complete, public, human-readable register carrying an
  authoritative-source notice and a publication date, at a stable URL.
- **`Good`**: adds a stable tabular export, explicit reuse terms, a lifecycle status
  per entry, and a published attribution notice.
- **`Advanced`**: adds a structured export with a documented schema, a read-only API,
  per-record change dates with retained history, published validation rules, and a
  documented correction process.
- **`Reference implementation`**: adds an interoperable publication profile, an
  incremental change feed, an embeddable public view, machine-readable provenance and
  reuse metadata inside the export, and a published mapping between identifier
  schemes.

| Capability                                       | Introduced at              | Expectation                                                       |
| ------------------------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| Complete list of issued identifiers              | `Minimum`                  | Includes inactive and withdrawn identifiers                       |
| Organisation name and legal identity per entry   | `Minimum`                  | Legal entity, not a trading name alone                            |
| Role per identifier                              | `Minimum`                  | Published per entry, not inferred from the page                   |
| Authoritative-source notice and IDRO contact     | `Minimum`                  | Names the operator, the appointment, and where to report an error |
| Register publication or last-update date         | `Minimum`                  | On the register page                                              |
| Stable register URL                              | `Minimum`                  | Does not encode the edition or the publication date               |
| Lifecycle status per identifier                  | `Good`                     | Published vocabulary with defined terms                           |
| Tabular export at a stable URL                   | `Good`                     | CSV or XLSX, UTF-8, documented delimiter                          |
| Explicit reuse terms                             | `Good`                     | A named licence or a cited statutory basis                        |
| Published attribution notice                     | `Good`                     | The exact wording to reproduce                                    |
| Structured export with a documented schema       | `Advanced`                 | JSON or NDJSON, stable field names                                |
| Read-only HTTP API                               | `Advanced`                 | Unauthenticated, versioned, CORS-enabled                          |
| Per-record change dates and retained history     | `Advanced`                 | Assignment date and last change date per entry                    |
| Published identifier syntax and validation rules | `Advanced`                 | Length, character set, case normalization                         |
| Documented correction and dispute process        | `Advanced`                 | Route, expected response time, recorded outcome                   |
| Interoperable publication profile                | `Reference implementation` | Consumable by existing roaming or registry tooling                |
| Incremental change feed                          | `Reference implementation` | Lets a consumer synchronize without refetching the register       |
| Embeddable public register view                  | `Reference implementation` | Filtered and linkable, in addition to the exports                 |
| Machine-readable provenance and reuse metadata   | `Reference implementation` | Carried inside the export, not only on the page                   |

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
