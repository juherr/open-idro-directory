import type { RegistryConnector } from "../connector.js";
import { BdewConnector } from "./bdew.connector.js";
import type { BdewSnapshot } from "./bdew.types.js";

export function createDeBdewConnector(): RegistryConnector<BdewSnapshot> {
  return new BdewConnector();
}
