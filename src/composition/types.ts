import type { AppContainer } from "@/composition/container";

declare module "hono" {
  interface ContextVariableMap {
    container: AppContainer;
  }
}
