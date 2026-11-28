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
  observationKindSchema,
  registryObservationSchema,
  registryRoleSchema,
  registryStatusSchema,
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type ObservationKind,
  type RegistryObservation,
  type RegistryRole,
  type RegistryStatus,
} from "../../../src/domain/registry-record.js";
export {
  knownObservationOf,
  observationOf,
  observationScope,
} from "../../../src/domain/registry-observation.js";
export {
  classifyIdentifierProvenance,
  identifierRoleKey,
  issuingConfirmationSchema,
  issuingProvenanceSchema,
  withIssuingProvenance,
  type IssuingConfirmation,
  type IssuingProvenance,
  type SourceHealthState,
} from "../../../src/domain/identifier-provenance.js";
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
