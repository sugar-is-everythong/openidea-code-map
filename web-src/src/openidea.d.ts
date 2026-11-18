import type { OpenideaBridge } from "./bridge";

declare global {
  interface Window {
    openidea?: OpenideaBridge;
  }
}

export {};
