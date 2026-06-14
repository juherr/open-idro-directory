import { AfirevConnector } from "./fr-afirev/afirev.connector.js";
import { LadestellenConnector } from "./at-ladestellen/ladestellen.connector.js";
import type { RegistryConnector } from "./connector.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { createDeBdewConnector } from "./de-bdew/index.js";
import { createBeneluxIdroConnector } from "./benelux-idro/index.js";
import { createSuisseEnergieConnector } from "./ch-suisseenergie/index.js";
import { createCyEmsConnector } from "./cy-ems/index.js";
import { createFstyrConnector } from "./dk-fstyr/index.js";
import { createTraficomConnector } from "./fi-traficom/index.js";
import { createGbEvroamConnector } from "./gb-evroam/index.js";
import { createCroIdroConnector } from "./hr-croidro/index.js";

export function createConnector(source: SourceDefinition): RegistryConnector {
  switch (source.connector) {
    case "at-ladestellen":
      return new LadestellenConnector();
    case "fr-afirev":
      return new AfirevConnector();
    case "de-bdew":
      return createDeBdewConnector();
    case "benelux-idro":
      return createBeneluxIdroConnector();
    case "ch-suisseenergie":
      return createSuisseEnergieConnector();
    case "cy-ems":
      return createCyEmsConnector();
    case "dk-fstyr":
      return createFstyrConnector();
    case "fi-traficom":
      return createTraficomConnector();
    case "gb-evroam":
      return createGbEvroamConnector();
    case "hr-croidro":
      return createCroIdroConnector();
    default:
      throw new Error(`No connector registered for ${source.connector}`);
  }
}
