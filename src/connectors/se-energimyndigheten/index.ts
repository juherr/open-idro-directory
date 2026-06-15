import type { RegistryConnector } from "../connector.js";
import { EnergimyndighetenConnector } from "./energimyndigheten.connector.js";
import type { EnergimyndighetenRow } from "./energimyndigheten.types.js";

export function createEnergimyndighetenConnector(): RegistryConnector<EnergimyndighetenRow> {
  return new EnergimyndighetenConnector();
}
