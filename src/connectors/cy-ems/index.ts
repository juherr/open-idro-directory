import { NotImplementedError, type RegistryConnector } from "../connector.js";

export function createCyEmsConnector(): RegistryConnector {
  throw new NotImplementedError("cy-ems");
}
