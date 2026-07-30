import { describe, expect, it } from "vitest";
import type { NormalizeOutput } from "../../src/connectors/connector.js";
import { LadestellenConnector } from "../../src/connectors/at-ladestellen/ladestellen.connector.js";
import { BeneluxIdroConnector } from "../../src/connectors/benelux-idro/benelux.connector.js";
import { SuisseEnergieConnector } from "../../src/connectors/ch-suisseenergie/suisseenergie.connector.js";
import { BdewConnector } from "../../src/connectors/de-bdew/bdew.connector.js";
import { FstyrConnector } from "../../src/connectors/dk-fstyr/fstyr.connector.js";
import { RipreeConnector } from "../../src/connectors/es-ripree/ripree.connector.js";
import { TraficomConnector } from "../../src/connectors/fi-traficom/traficom.connector.js";
import { AfirevConnector } from "../../src/connectors/fr-afirev/afirev.connector.js";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import { ElectrokinisiConnector } from "../../src/connectors/gr-electrokinisi/electrokinisi.connector.js";
import { CroIdroConnector } from "../../src/connectors/hr-croidro/croidro.connector.js";
import { HuIdroConnector } from "../../src/connectors/hu-idro/hu-idro.connector.js";
import { TiiConnector } from "../../src/connectors/ie-tii/tii.connector.js";
import { VialietuvaConnector } from "../../src/connectors/lt-vialietuva/vialietuva.connector.js";
import { LvceliConnector } from "../../src/connectors/lv-lvceli/lvceli.connector.js";
import { EipaConnector } from "../../src/connectors/pl-eipa/eipa.connector.js";
import { MobieConnector } from "../../src/connectors/pt-mobie/mobie.connector.js";
import { EnergimyndighetenConnector } from "../../src/connectors/se-energimyndigheten/energimyndigheten.connector.js";
import { NapConnector } from "../../src/connectors/si-nap/nap.connector.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { toRejectedSourceRows } from "../../src/validation/identifier-validator.js";

const RETRIEVED_AT = "2026-06-15T00:00:00.000Z";

interface RejectionCase {
  sourceId: string;
  code: string;
  // What the connector must report as the value it could not read. For most
  // connectors this is the upstream field verbatim; a few compose it, and those
  // are called out below.
  rejectedIdentifier: string;
  message: string;
  normalize: (source: SourceDefinition) => Promise<NormalizeOutput>;
}

const CASES: RejectionCase[] = [
  {
    sourceId: "at-ladestellen",
    code: "LADESTELLEN_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " ABCD ",
    message: "Unexpected Ladestellen.at operator ID syntax:  ABCD ",
    normalize: (source) =>
      new LadestellenConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ operatorId: " ABCD ", type: "CPO" }],
      }),
  },
  {
    sourceId: "benelux-idro",
    code: "BENELUX_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " NL*ABCD ",
    message: "Unexpected Benelux IDRO identifier syntax:  NL*ABCD ",
    normalize: (source) =>
      new BeneluxIdroConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ companyName: "Acme BV", cpoIds: [" NL*ABCD "], emspIds: [], website: null }],
      }),
  },
  {
    sourceId: "ch-suisseenergie",
    code: "SUISSEENERGIE_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " CH*ABCD ",
    message: "Unexpected SuisseEnergie identifier syntax:  CH*ABCD ",
    normalize: (source) =>
      new SuisseEnergieConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            node_locale: "fr",
            digitId: " CH*ABCD ",
            CPO: true,
            EMP: false,
            organization: { companyName: "Acme SA", website: null },
          },
        ],
      }),
  },
  {
    sourceId: "de-bdew",
    code: "BDEW_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " DE*ABCD ",
    message: "Unexpected BDEW identifier syntax:  DE*ABCD ",
    // The BDEW record is a whole snapshot, and the warning comes from a helper
    // rather than the normalize loop itself.
    normalize: (source) =>
      new BdewConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ cpo: [{ Id: 1, Code: " DE*ABCD ", Company: "Acme GmbH" }], emsp: [] }],
      }),
  },
  {
    sourceId: "dk-fstyr",
    code: "FSTYR_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " DK*ABCD ",
    message: "Unexpected Danish IDRO identifier syntax:  DK*ABCD ",
    normalize: (source) =>
      new FstyrConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ cvr: null, companyName: "Acme A/S", cpoIds: [" DK*ABCD "], emspIds: [] }],
      }),
  },
  {
    sourceId: "es-ripree",
    code: "RIPREE_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " ES*ABCD ",
    message: "Unexpected Spanish RIPREE identifier syntax:  ES*ABCD ",
    normalize: (source) =>
      new RipreeConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            document: null,
            sourceValue: " ES*ABCD ",
            companyType: "CPO",
            organizationName: "Acme SA",
            address: null,
            country: null,
            autonomousCommunity: null,
            province: null,
            municipality: null,
            postalCode: null,
            website: null,
          },
        ],
      }),
  },
  {
    sourceId: "fi-traficom",
    code: "TRAFICOM_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " FI*ABCD ",
    message: "Unexpected Traficom identifier syntax:  FI*ABCD ",
    normalize: (source) =>
      new TraficomConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ companyName: "Acme Oy", cpoIds: [" FI*ABCD "], emspIds: [], businessId: null }],
      }),
  },
  {
    sourceId: "fr-afirev",
    code: "AFIREV_MALFORMED_IDENTIFIER",
    // AFIREV matches against a trimmed prefix but must still report the raw
    // published value, so the two deliberately differ here.
    rejectedIdentifier: " FRABCD ",
    message: "Unexpected AFIREV prefix syntax: FRABCD",
    normalize: (source) =>
      new AfirevConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ prefixId: " FRABCD ", type: "CHARGE", status: "ACTIVE" }],
      }),
  },
  {
    sourceId: "gb-evroam",
    code: "EVROAM_MALFORMED_IDENTIFIER",
    // EV Roam cleans each candidate field before parsing, so the reported value
    // is the cleaned one.
    rejectedIdentifier: "GB-ABCD",
    message: "Unexpected EV Roam operatorId syntax: GB-ABCD",
    normalize: (source) =>
      new EvroamConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ title: "Acme Ltd", operatorId: " GB-ABCD " }],
      }),
  },
  {
    sourceId: "gr-electrokinisi",
    code: "ELECTROKINISI_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " GR*ABCD ",
    message: "Unexpected Greek IDRO identifier syntax:  GR*ABCD ",
    normalize: (source) =>
      new ElectrokinisiConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            organizationName: "Acme AE",
            sourceValue: " GR*ABCD ",
            sourceRole: "CPO",
            role: "CPO",
            website: null,
            email: null,
          },
        ],
      }),
  },
  {
    sourceId: "hr-croidro",
    code: "CROIDRO_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " HR*ABCD ",
    message: "Unexpected Croatian IDRO identifier syntax:  HR*ABCD ",
    normalize: (source) =>
      new CroIdroConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ companyName: "Acme d.o.o.", cpoIds: [" HR*ABCD "], emspIds: [] }],
      }),
  },
  {
    sourceId: "hu-idro",
    code: "HU_IDRO_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " HU*ABCD ",
    message: "Unexpected Hungarian IDRO identifier syntax:  HU*ABCD ",
    normalize: (source) =>
      new HuIdroConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            organizationName: "Acme Kft",
            taxNumber: null,
            sourceValue: " HU*ABCD ",
            role: "CPO",
          },
        ],
      }),
  },
  {
    sourceId: "ie-tii",
    code: "TII_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " IEABCD ",
    message: "Unexpected Irish IDRO identifier syntax:  IEABCD ",
    normalize: (source) =>
      new TiiConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            legalEntityName: "Acme Ltd",
            tradingName: null,
            idroIssuedPartyId: " IEABCD ",
            ocpiPartyIds: [],
            isCpo: true,
            isEmsp: false,
          },
        ],
      }),
  },
  {
    sourceId: "lt-vialietuva",
    code: "VIALIETUVA_MALFORMED_IDENTIFIER",
    // Via Lietuva publishes the country and party separately, so the reported
    // value is the pair the connector could not accept.
    rejectedIdentifier: "LT- ABCD ",
    message: "Unexpected Via Lietuva identifier syntax: LT- ABCD ",
    normalize: (source) =>
      new VialietuvaConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [{ country_code: "LT", party_id: " ABCD " }],
      }),
  },
  {
    sourceId: "lv-lvceli",
    code: "LVCELI_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " LV*ABCD ",
    message: "Unexpected Latvian IDRO identifier syntax:  LV*ABCD ",
    normalize: (source) =>
      new LvceliConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            legalEntityName: "Acme SIA",
            cpoIds: [" LV*ABCD "],
            emspIds: [],
            email: null,
            website: null,
          },
        ],
      }),
  },
  {
    sourceId: "pl-eipa",
    code: "EIPA_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " PL*ABCD ",
    message: "Unexpected EIPA identifier syntax:  PL*ABCD ",
    normalize: (source) =>
      new EipaConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            organizationName: "Acme Sp. z o.o.",
            cpoId: " PL*ABCD ",
            emspId: null,
            city: null,
            country: null,
            website: null,
            registeredAt: null,
          },
        ],
      }),
  },
  {
    sourceId: "pt-mobie",
    code: "MOBIE_MALFORMED_IDENTIFIER",
    // MOBI.E publishes a bare party ID, so the connector prefixes the country
    // before parsing and reports that composed value.
    rejectedIdentifier: "PTABCD",
    message: "Unexpected MOBI.E identifier syntax: PTABCD",
    normalize: (source) =>
      new MobieConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            code: "MOBIE-1",
            partyId: "ABCD",
            organizationName: "Acme SA",
            isCpo: true,
            isEmsp: false,
          },
        ],
      }),
  },
  {
    sourceId: "se-energimyndigheten",
    code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " SE*ABCD ",
    message: "Unexpected Swedish Energy Agency identifier syntax:  SE*ABCD ",
    normalize: (source) =>
      new EnergimyndighetenConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            sourceValue: " SE*ABCD ",
            organizationName: "Acme AB",
            role: "CPO",
            sourceUrl: "https://www.energimyndigheten.se/",
          },
        ],
      }),
  },
  {
    sourceId: "si-nap",
    code: "NAP_MALFORMED_IDENTIFIER",
    rejectedIdentifier: " SI*ABCD ",
    message: "Unexpected Slovenian NAP identifier syntax:  SI*ABCD ",
    normalize: (source) =>
      new NapConnector().normalize({
        source,
        retrievedAt: RETRIEVED_AT,
        records: [
          {
            organizationName: "Acme d.o.o.",
            emspId: null,
            cpoId: " SI*ABCD ",
            address: null,
            city: null,
            country: null,
            website: null,
          },
        ],
      }),
  },
];

describe("connector identifier rejections", () => {
  it.each(CASES)(
    "$sourceId reports the exact value it could not read",
    async (testCase: RejectionCase) => {
      const source = await loadSourceDefinition(testCase.sourceId);
      const result = await testCase.normalize(source);

      expect(result.records).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        severity: "warning",
        code: testCase.code,
        message: testCase.message,
        rejectedIdentifier: testCase.rejectedIdentifier,
      });
    },
  );

  it.each(CASES)("$sourceId rejection becomes a counted row", async (testCase: RejectionCase) => {
    const source = await loadSourceDefinition(testCase.sourceId);
    const result = await testCase.normalize(source);

    expect(toRejectedSourceRows(testCase.sourceId, result.warnings)).toEqual([
      {
        registryId: testCase.sourceId,
        code: testCase.code,
        sourceValue: testCase.rejectedIdentifier,
        message: testCase.message,
      },
    ]);
  });
});
