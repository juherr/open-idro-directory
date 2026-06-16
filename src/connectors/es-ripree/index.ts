import type { RegistryConnector } from "../connector.js";
import { RipreeConnector } from "./ripree.connector.js";
import type { RipreeXmlRow } from "./ripree.types.js";

export function createRipreeConnector(): RegistryConnector<RipreeXmlRow> {
  return new RipreeConnector();
}
