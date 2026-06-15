import type { RegistryConnector } from "../connector.js";
import { MobieConnector } from "./mobie.connector.js";
import type { MobieRow } from "./mobie.types.js";

export function createMobieConnector(): RegistryConnector<MobieRow> {
  return new MobieConnector();
}
