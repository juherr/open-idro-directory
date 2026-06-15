import type { RegistryConnector } from "../connector.js";
import { EipaConnector } from "./eipa.connector.js";
import type { EipaCsvRow } from "./eipa.types.js";

export function createEipaConnector(): RegistryConnector<EipaCsvRow> {
  return new EipaConnector();
}
