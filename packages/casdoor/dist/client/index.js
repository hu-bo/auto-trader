import { CasdoorClient, createCasdoorClient } from "./core.js";
import { TokenStorage } from "./storage.js";
import {
  initCasdoor,
  getCasdoorClient,
  useCasdoor,
  useCasdoorCallback
} from "./vue.js";
import {
  CasdoorProvider,
  useCasdoorClient,
  useCasdoor as useCasdoor2,
  useCasdoorCallback as useCasdoorCallback2,
  useRequireAuth
} from "./react.js";
export * from "../types.js";
export {
  CasdoorClient,
  CasdoorProvider,
  TokenStorage,
  createCasdoorClient,
  getCasdoorClient,
  initCasdoor,
  useCasdoor,
  useCasdoorCallback,
  useCasdoorCallback2 as useCasdoorCallbackReact,
  useCasdoorClient,
  useCasdoor2 as useCasdoorReact,
  useRequireAuth
};
//# sourceMappingURL=index.js.map