import { useEffect, useRef, useCallback } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el || !shouldScroll.current) return;
    // Use requestAnimationFrame to ensure DOM has settled after layout shifts
    requestAnimationFrame(() => {
      if (ref.current && shouldScroll.current) {
        ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
      }
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      // Auto-scroll if user is near the bottom — generous threshold for step cards
      shouldScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll on dependency changes
  useEffect(() => {
    scrollToBottom();
  }, deps);

  // MutationObserver for DOM changes (new steps, streaming text)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src'], // catch image src changes
    });

    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Listen for image loads inside the container — images cause layout reflow after load
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onImageLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) {
        scrollToBottom();
      }
    };

    el.addEventListener('load', onImageLoad, { capture: true, passive: true });
    return () => el.removeEventListener('load', onImageLoad, { capture: true });
  }, [scrollToBottom]);

  return ref;
}
