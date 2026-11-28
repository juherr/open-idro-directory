import { describe, expectTypeOf, it } from "vitest";

// Types only: the client never imports the API at runtime.
import type {
  CountrySummary as ApiCountrySummary,
  datasetPayload,
  listPayload,
  observationPayload,
  partyPayload,
  sourcePayload,
} from "../../../apps/api/src/application/mappers.js";
import type { ObservationRow, PartyRow } from "../../../apps/api/src/infrastructure/d1/types.js";
import type { RegistryRole, RegistryStatus } from "../../registry-model/src/index.js";
import type {
  CountrySummary,
  Dataset,
  Observation,
  Page,
  Party,
  PartyRoleFilter,
  PartyStatusFilter,
  Source,
} from "../src/index.js";

type PartyPayload = ReturnType<typeof partyPayload>;
type ObservationPayload = ReturnType<typeof observationPayload>;

// Checked by `api-client:typecheck`; Vitest itself does not type-check. Each mapper's return
// type must be assignable to the client DTO: a field the DTO declares and the mapper no longer
// produces, or produces with another type, fails the type check.
describe("client DTOs against the API mappers", () => {
  it("matches datasetPayload", () => {
    expectTypeOf<ReturnType<typeof datasetPayload>>().toExtend<Dataset>();
  });

  it("matches partyPayload, issuing confirmation included", () => {
    expectTypeOf<PartyPayload>().toExtend<Party>();
  });

  it("matches sourcePayload", () => {
    expectTypeOf<ReturnType<typeof sourcePayload>>().toExtend<Source>();
  });

  it("matches countrySummaryPayload", () => {
    expectTypeOf<ApiCountrySummary>().toExtend<CountrySummary>();
  });

  it("matches observationPayload", () => {
    expectTypeOf<ObservationPayload>().toExtend<Observation>();
  });

  it("matches the listPayload page and cursor shape", () => {
    expectTypeOf<ReturnType<typeof listPayload<PartyRow, PartyPayload>>>().toExtend<Page<Party>>();
    expectTypeOf<ReturnType<typeof listPayload<ObservationRow, ObservationPayload>>>().toExtend<
      Page<Observation>
    >();
  });

  it("filters parties by the registry's roles and statuses", () => {
    expectTypeOf<PartyRoleFilter>().toEqualTypeOf<RegistryRole>();
    expectTypeOf<PartyStatusFilter>().toEqualTypeOf<RegistryStatus>();
  });
});
