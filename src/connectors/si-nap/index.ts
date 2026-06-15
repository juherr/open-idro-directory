import type { RegistryConnector } from "../connector.js";
import { NapConnector } from "./nap.connector.js";
import type { NapRow } from "./nap.types.js";

export function createNapConnector(): RegistryConnector<NapRow> {
  return new NapConnector();
}
