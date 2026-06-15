export {
  identifierObservationSchema,
  identifierSchemeSchema,
  authorityLevelSchema,
  observationTypeSchema,
  sourceAssessmentSchema,
  makeObservationKey,
  type IdentifierObservation,
  type IdentifierScheme,
  type AuthorityLevel,
  type ObservationType,
  type SourceAssessment,
} from "../../../src/domain/identifier-observation.js";
export {
  normalizedRegistryRecordSchema,
  registryRoleSchema,
  registryStatusSchema,
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type RegistryRole,
  type RegistryStatus,
} from "../../../src/domain/registry-record.js";
export {
  sourceDefinitionSchema,
  type SourceDefinition,
} from "../../../src/domain/source-definition.js";
