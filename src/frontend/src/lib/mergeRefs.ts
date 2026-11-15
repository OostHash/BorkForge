import type { Ref, RefCallback } from "react";

/** Combines refs so a component can keep its own ref while forwarding the caller's. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) ref.current = value;
    }
  };
}
