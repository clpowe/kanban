import { createSignal, createEffect, untrack } from "solid-js";
interface AnimatedPointsProps {
  value: number;
  class?: string;
}

export default function AnimatedPoints(props: AnimatedPointsProps) {
  // Mirror of the signal so the apply phase never reads a reactive value.
  let current = untrack(() => props.value);
  const [displayValue, setDisplayValue] = createSignal(current);

  const commit = (value: number) => {
    current = value;
    setDisplayValue(value);
  };

  createEffect(
    () => props.value,
    (target) => {
      const start = current;
      if (start === target) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        commit(target);
        return;
      }

      const duration = 400;
      const startTime = performance.now();
      let animationFrameId = 0;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const ease = progress * (2 - progress);
        commit(Math.round(start + (target - start) * ease));

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => cancelAnimationFrame(animationFrameId);
    },
  );

  return (
    <span class={props.class} aria-live="polite">
      {new Intl.NumberFormat().format(displayValue())}
    </span>
  );
}
