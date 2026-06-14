import type { RegistryConnector } from "../connector.js";
import { TraficomConnector } from "./traficom.connector.js";
import type { TraficomHtmlRow } from "./traficom.types.js";

export function createTraficomConnector(): RegistryConnector<TraficomHtmlRow> {
  return new TraficomConnector();
}
