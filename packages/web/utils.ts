import { createDefine } from "fresh";
import type { Subject } from "@chatgpa/core";

export interface State {
  subjects: Subject[];
}

export const define = createDefine<State>();
