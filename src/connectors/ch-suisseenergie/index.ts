import type { RegistryConnector } from "../connector.js";
import { SuisseEnergieConnector } from "./suisseenergie.connector.js";
import type { SuisseEnergieProvider } from "./suisseenergie.types.js";

export function createSuisseEnergieConnector(): RegistryConnector<SuisseEnergieProvider> {
  return new SuisseEnergieConnector();
}
