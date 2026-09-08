import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * The things the tour points at.
 *
 * A screen wraps whatever the tour should highlight in `<TourTarget id="...">`
 * and forgets about it. The tour asks this registry for the id it wants, gets
 * back the rectangle that view currently occupies on screen, and cuts a hole
 * in its own dimming layer there.
 *
 * Measured on demand rather than on layout, because by the time the tour asks,
 * it has just switched tabs and the target may have moved, re-rendered, or not
 * mounted yet. Asking at the moment of use is the only reading that is true.
 *
 * A missing or unmeasurable id is not an error — the tour falls back to a
 * plain centred card. A screen that has not been written yet, or a target
 * scrolled out of the tree, should not be able to break the tour.
 */

export type Rect = { x: number; y: number; width: number; height: number };

type Registry = {
  register: (id: string, node: View | null) => void;
  measure: (id: string) => Promise<Rect | null>;
};

const TourTargetContext = createContext<Registry | null>(null);

export function TourTargetProvider({ children }: { children: React.ReactNode }) {
  const nodes = useRef(new Map<string, View>());

  const register = useCallback((id: string, node: View | null) => {
    if (node) nodes.current.set(id, node);
    // Only drop the entry if it still belongs to the node unmounting. Two
    // screens can hold the same id across a transition, and the outgoing one
    // must not delete the incoming one's registration.
    else if (nodes.current.get(id)) nodes.current.delete(id);
  }, []);

  const measure = useCallback((id: string) => {
    return new Promise<Rect | null>((resolve) => {
      const node = nodes.current.get(id);
      if (!node || typeof node.measureInWindow !== 'function') return resolve(null);

      // measureInWindow simply never fires if the view is gone, so this cannot
      // be awaited without a timeout -- the tour would hang on Next.
      const timer = setTimeout(() => resolve(null), 400);
      node.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        if (!width || !height) return resolve(null);
        resolve({ x, y, width, height });
      });
    });
  }, []);

  const value = useMemo(() => ({ register, measure }), [register, measure]);
  return <TourTargetContext.Provider value={value}>{children}</TourTargetContext.Provider>;
}

export function useTourRegistry() {
  return useContext(TourTargetContext);
}

/**
 * Wrap anything the tour should highlight.
 *
 * Renders a plain View, so it can be dropped around existing markup without
 * changing the layout — it takes whatever `style` the thing it replaced had.
 */
export function TourTarget({
  id,
  children,
  style,
  ...rest
}: ViewProps & { id: string; children: React.ReactNode }) {
  const registry = useTourRegistry();
  const ref = useCallback(
    (node: View | null) => registry?.register(id, node),
    [registry, id]
  );

  return (
    <View ref={ref} style={style} collapsable={false} {...rest}>
      {children}
    </View>
  );
}
