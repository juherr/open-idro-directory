import { AfirevConnector } from "./fr-afirev/afirev.connector.js";
import { LadestellenConnector } from "./at-ladestellen/ladestellen.connector.js";
import type { RegistryConnector } from "./connector.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { createDeBdewConnector } from "./de-bdew/index.js";
import { createBeneluxIdroConnector } from "./benelux-idro/index.js";
import { createSuisseEnergieConnector } from "./ch-suisseenergie/index.js";
import { createCyEmsConnector } from "./cy-ems/index.js";
import { createFstyrConnector } from "./dk-fstyr/index.js";
import { createElectrokinisiConnector } from "./gr-electrokinisi/index.js";
import { createTraficomConnector } from "./fi-traficom/index.js";
import { createGbEvroamConnector } from "./gb-evroam/index.js";
import { createHuIdroConnector } from "./hu-idro/index.js";
import { createCroIdroConnector } from "./hr-croidro/index.js";
import { createEnergimyndighetenConnector } from "./se-energimyndigheten/index.js";
import { createTiiConnector } from "./ie-tii/index.js";
import { createLvceliConnector } from "./lv-lvceli/index.js";
import { createVialietuvaConnector } from "./lt-vialietuva/index.js";

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
    case "gr-electrokinisi":
      return createElectrokinisiConnector();
    case "fi-traficom":
      return createTraficomConnector();
    case "gb-evroam":
      return createGbEvroamConnector();
    case "hu-idro":
      return createHuIdroConnector();
    case "hr-croidro":
      return createCroIdroConnector();
    case "se-energimyndigheten":
      return createEnergimyndighetenConnector();
    case "ie-tii":
      return createTiiConnector();
    case "lv-lvceli":
      return createLvceliConnector();
    case "lt-vialietuva":
      return createVialietuvaConnector();
    default:
      throw new Error(`No connector registered for ${source.connector}`);
  }
}
