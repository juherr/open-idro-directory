import { NotImplementedError, type RegistryConnector } from "../connector.js";

export function createGbEvroamConnector(): RegistryConnector {
  throw new NotImplementedError("gb-evroam");
}
