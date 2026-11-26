import { useEffect, useState } from "react";

/** Vero mentre un drag HTML5 è in corso nella finestra: serve per liberare le celle sotto gli eventi. */
export function useDragInProgress(): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      if (pending !== undefined) {
        clearTimeout(pending);
        pending = undefined;
      }
      setDragging(false);
    };

    const onDragStart = () => {
      // Cambiare la sorgente durante dragstart annulla il drag in Chrome: si accende un tick dopo.
      pending = setTimeout(() => {
        pending = undefined;
        setDragging(true);
      }, 0);
    };

    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", clear);
    // Una sorgente rimossa dal DOM non emette dragend: il drop deve bastare.
    window.addEventListener("drop", clear, true);

    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear, true);
      if (pending !== undefined) {
        clearTimeout(pending);
      }
    };
  }, []);

  return dragging;
}
