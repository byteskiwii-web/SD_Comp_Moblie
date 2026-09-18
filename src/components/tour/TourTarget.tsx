import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type ViewProps } from 'react-native';

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
 *
 * SCROLLING IS PART OF MEASURING. measureInWindow answers for a view that is
 * scrolled off screen just as readily as for one in front of you — it returns
 * where the view WOULD be, which for a target below the fold is a rectangle
 * off the bottom of the screen, and for one scrolled past is a rectangle up
 * behind the header. Cutting a hole at either produced the bug this file
 * exists to prevent: a spotlight sitting over the greeting bar, or a sliver of
 * a card clipped by the tab bar, while the thing being described was nowhere
 * in sight. So a target remembers the scroll container it lives in (see
 * TourScrollView), and `reveal` brings it into view before reporting where it
 * is.
 */

export type Rect = { x: number; y: number; width: number; height: number };

/** The slice of the screen a spotlight may occupy: below the notch, above the tab bar. */
export type Band = { top: number; bottom: number };

type Scroller = { scrollBy: (dy: number) => void; measureViewport: () => Promise<Rect | null> };

type Entry = { node: View; scroller: Scroller | null };

/**
 * Where the target is, and the strip of screen it can legitimately be seen in.
 *
 * `viewport` is the band narrowed to the scroll container the target lives in.
 * It matters because every screen here puts a greeting bar ABOVE its scroll
 * view: a target scrolled up out of the list reports a position behind that
 * bar, and a hole cut there lands on the bar instead of on the thing. Clamping
 * to the container's own bounds makes that case measurable rather than
 * plausible-looking.
 */
export type Reveal = { rect: Rect; viewport: Band };

type Registry = {
  register: (id: string, node: View | null, scroller: Scroller | null) => void;
  /** Where the target is right now, without touching the scroll position. */
  measure: (id: string) => Promise<Rect | null>;
  /** Scrolls the target into `band` if it can, then reports where it ended up. */
  reveal: (id: string, band: Band) => Promise<Reveal | null>;
};

const TourTargetContext = createContext<Registry | null>(null);
const TourScrollContext = createContext<Scroller | null>(null);

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function measureNode(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (typeof node.measureInWindow !== 'function') return resolve(null);
    // measureInWindow simply never fires if the view is gone, so this cannot
    // be awaited without a timeout -- the tour would hang on Next.
    const timer = setTimeout(() => resolve(null), 400);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      if (!width || !height) return resolve(null);
      resolve({ x, y, width, height });
    });
  });
}

export function TourTargetProvider({ children }: { children: React.ReactNode }) {
  const nodes = useRef(new Map<string, Entry>());

  const register = useCallback((id: string, node: View | null, scroller: Scroller | null) => {
    if (node) nodes.current.set(id, { node, scroller });
    // Only drop the entry if it still belongs to the node unmounting. Two
    // screens can hold the same id across a transition, and the outgoing one
    // must not delete the incoming one's registration.
    else if (nodes.current.get(id)) nodes.current.delete(id);
  }, []);

  const measure = useCallback(async (id: string) => {
    const entry = nodes.current.get(id);
    return entry ? measureNode(entry.node) : null;
  }, []);

  const reveal = useCallback(async (id: string, band: Band): Promise<Reveal | null> => {
    const entry = nodes.current.get(id);
    if (!entry) return null;

    let rect = await measureNode(entry.node);
    if (!rect) return null;
    if (!entry.scroller) return { rect, viewport: band };

    /*
     * Two passes, because one is not enough and three is a slideshow.
     *
     * The first scroll is computed from where the target is now; the animation
     * takes a moment and can land slightly off (a list that grows a row while
     * it settles, a sticky header of a height this code deliberately does not
     * model). Re-measuring and nudging once more covers that. If it is still
     * not in the band after two, the tour shows a centred card instead of a
     * hole in the wrong place -- see AppTour.
     */
    const MARGIN = 14;
    for (let pass = 0; pass < 2; pass++) {
      const top = rect.y - MARGIN;
      const bottom = rect.y + rect.height + MARGIN;
      let dy = 0;
      if (top < band.top) dy = top - band.top;
      else if (bottom > band.bottom) {
        // Never scroll so far chasing the bottom edge that the top leaves the
        // band: a target taller than the band is aligned to its top instead.
        dy = Math.min(bottom - band.bottom, top - band.top);
      }
      if (Math.abs(dy) < 6) break;

      entry.scroller.scrollBy(dy);
      await wait(pass === 0 ? 300 : 200);
      const next = await measureNode(entry.node);
      if (!next) break;
      rect = next;
    }

    const box = await entry.scroller.measureViewport();
    const viewport = box
      ? { top: Math.max(band.top, box.y), bottom: Math.min(band.bottom, box.y + box.height) }
      : band;
    return { rect, viewport };
  }, []);

  const value = useMemo(() => ({ register, measure, reveal }), [register, measure, reveal]);
  return <TourTargetContext.Provider value={value}>{children}</TourTargetContext.Provider>;
}

export function useTourRegistry() {
  return useContext(TourTargetContext);
}

/**
 * A ScrollView whose descendants' tour targets can be scrolled into view.
 *
 * Drop-in for ScrollView: every prop passes through, and a screen with no tour
 * target in it behaves exactly as before. It exists only so that `reveal` has
 * something to ask — a plain ScrollView cannot be scrolled by a stranger,
 * because nobody outside it knows where it currently sits.
 */
export function TourScrollView({ children, onScroll, ...rest }: ScrollViewProps & { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  /* The NATIVE scroll view, which is the thing that can be measured -- the
     component instance `ref` holds owns scrollTo but not measureInWindow. */
  // Cast at the prop, not here: RN types scrollViewRef as a non-nullable
  // RefObject, which no ref created in a component can ever be.
  const nativeRef = useRef<ScrollView | null>(null);
  const offset = useRef(0);

  const scroller = useMemo<Scroller>(
    () => ({
      scrollBy: (dy: number) => {
        const next = Math.max(0, offset.current + dy);
        // Optimistic, and corrected by the next onScroll: the animation takes
        // longer than the tour waits, and a second scrollBy computed from a
        // stale offset would undo the first.
        offset.current = next;
        ref.current?.scrollTo({ y: next, animated: true });
      },
      // The list's own bounds on screen -- everything above them belongs to
      // the greeting bar, and nothing there is ever this list's target.
      measureViewport: () => {
        const node = (nativeRef.current ?? ref.current) as unknown as View | null;
        return node ? measureNode(node) : Promise.resolve(null);
      },
    }),
    []
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll]
  );

  return (
    <TourScrollContext.Provider value={scroller}>
      <ScrollView ref={ref} scrollViewRef={nativeRef as React.RefObject<ScrollView>} scrollEventThrottle={16} {...rest} onScroll={handleScroll}>
        {children}
      </ScrollView>
    </TourScrollContext.Provider>
  );
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
  // Captured from the tree, so a screen never has to say which scroll view it
  // is in -- being inside one is the whole statement.
  const scroller = useContext(TourScrollContext);
  const ref = useCallback(
    (node: View | null) => registry?.register(id, node, scroller),
    [registry, id, scroller]
  );

  return (
    <View ref={ref} style={style} collapsable={false} {...rest}>
      {children}
    </View>
  );
}
