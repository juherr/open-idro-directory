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
  authorityDefinitionSchema,
  type AuthorityDefinition,
} from "../../../src/domain/authority-definition.js";
export {
  isAuthoritative,
  publicationDescriptorSchema,
  registryDescriptorSchema,
  resolveSourceDefinitions,
  sourceDescriptorSchema,
  sourceJurisdictions,
  type PublicationDescriptor,
  type RegistryDescriptor,
  type SourceDefinition,
  type SourceDescriptor,
} from "../../../src/domain/source-definition.js";
