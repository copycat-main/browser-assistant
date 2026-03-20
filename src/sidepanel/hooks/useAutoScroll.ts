import { useEffect, useRef } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      // Auto-scroll if user is near the bottom (within 400px — generous for large screenshots)
      shouldScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 400;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll on dependency changes
  useEffect(() => {
    if (ref.current && shouldScroll.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, deps);

  // Also set up a MutationObserver to catch any DOM changes (streaming text, new steps)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (shouldScroll.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return ref;
}
