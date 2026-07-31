# Current Landscape

This document summarizes the current state of the national IDRO registers this
project consumes. Unlike
[open-idro-recommended-practices.md](open-idro-recommended-practices.md), it
intentionally reflects the implementation landscape at a point in time and is
expected to change as national registers evolve.

It describes publication mechanics -- formats, endpoints, stated reuse terms -- and
nothing else. It is not a ranking, not an assessment of any organisation, and not a
measure of how well an IDRO performs its mandate. A register can be legally
impeccable, correctly maintained, and entirely fit for its national purpose while
publishing in a format that is inconvenient to consume. Where a figure records an
absence, it records what this project could not find, which is not the same as what
does not exist.

## Snapshot Basis

Every figure below describes the 20 sources configured in this repository, as of the
`data/sources.json` generated on 2026-07-27. The figures are not updated as the
repository changes.

`data/sources.json` is the authoritative record of what the project currently
consumes; `data/stats.json` carries the aggregate counts. Generating this document
from those files instead of hand-writing it is tracked in
[issue #74](https://github.com/juherr/open-idro-directory/issues/74).

## Machine-Readable Publication

Thirteen of the 20 configured sources expose a stable machine-readable URL. The
remaining seven require HTML or PDF parsing.

Upstream formats in use: public JSON endpoints, CSV exports, XLSX workbooks, an XML
export, an OCPI locations endpoint, a Drupal JSON page wrapping an HTML table, a
site page-data JSON path, server-rendered HTML tables and lists, and PDF registers.

Two registers are published only as PDF. Extraction requires Poppler `pdftotext`,
and one of the two encodes its publication date in the file name, so each new
edition changes the URL and breaks a stored link.

Several endpoints are private application interfaces rather than documented public
ones: one public application supplies an API key from its client bundle, one access
point wraps an HTML table inside a JSON response, and one register is read from a
generated site page-data path. These can change without notice and without a
redirect.

## Reuse Terms

| Recorded reuse status | Sources |
| --------------------- | ------- |
| `licensed`            | 3       |
| `statutory`           | 1       |
| `unspecified`         | 16      |

The three licensed sources publish CC BY 4.0 terms, one of them alongside ODC-BY.
The statutory source relies on national public-sector information legislation cited
by its ELI identifier rather than on an open-data licence.

`unspecified` means no explicit reuse terms have been identified, not that reuse is
forbidden and not that it is permitted. This project displays it explicitly and does
not treat it as open data. See "Source Provenance And Reuse" in
[data-model.md](data-model.md).

## Role Coverage

Eighteen of the 20 configured sources declare registers for both CPO and eMSP
identifiers. Two publish CPO identifiers only, so an eMSP holding a national
identifier in those jurisdictions has no public national record through the
publication this project consumes.

One source is configured but disabled because no public machine-readable identifier
register has been identified for it.

## Lifecycle Status

One configured register publishes a detailed lifecycle status with distinct active,
inactive, and suspended values. The others expose no per-entry status, so connectors
normalize the rows a source currently publishes to `ACTIVE`. See "Status
Normalization" in [source-limitations.md](source-limitations.md).

One register publishes a combined role type covering both CPO and eMSP, which this
project expands into two records carrying the same party identifier.

## Observed Publication Practices

Each row records a practice this project has verified in a public source. Countries
are named where the practice is theirs to claim; rows recording a constraint name
the mechanism rather than attributing a shortcoming.

| Practice                                     | Where observed              | What is verifiable                                               |
| -------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| Explicit open licence on the register        | Finland, Ireland, Lithuania | Licence terms linked from the publisher's own reuse page         |
| Required attribution wording published       | Ireland                     | The exact notice appears in the public-sector information policy |
| Statutory reuse basis instead of a licence   | Spain                       | Law 37/2007, cited by its ELI identifier                         |
| Appointing instrument published              | Ireland                     | S.I. No. 52 of 2026 in the Irish Statute Book                    |
| Detailed lifecycle status in the export      | France                      | Distinct active, inactive, and suspended values in a public JSON |
| Structured export of the identifier register | Benelux, Croatia, Poland    | Public CSV export endpoints                                      |
| Role-specific structured workbooks           | Sweden                      | Separate CPO and eMSP XLSX registers                             |
| Standards-based endpoint                     | Lithuania                   | OCPI 2.3.0 locations endpoint, CPO identifiers only              |

The Croatian entry cites the structure of the export, not its contents: it currently
yields no records in the generated dataset.

## Related Documentation

- [open-idro-recommended-practices.md](open-idro-recommended-practices.md) -- the
  publication guidance these observations support.
- [source-limitations.md](source-limitations.md) -- per-source formats, coverage,
  and limitations, including the full source matrix.
- [source-authority.md](source-authority.md) -- authority levels, observation types,
  and national responsibility boundaries.
- [data-model.md](data-model.md) -- record key, the authority, registry, and
  publication split, and the reuse vocabulary.
