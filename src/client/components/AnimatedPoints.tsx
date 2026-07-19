import { createSignal, createEffect, onCleanup } from "solid-js";
interface AnimatedPointsProps {
  value: number;
  class?: string;
}

export default function AnimatedPoints(props: AnimatedPointsProps) {
  const [displayValue, setDisplayValue] = createSignal(props.value);
  let animationFrameId: number;

  createEffect(() => {
    const target = props.value;
    const start = displayValue();
    if (start === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(target);
      return;
    }

    const duration = 400;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress * (2 - progress);
      const current = Math.round(start + (target - start) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    onCleanup(() => {
      cancelAnimationFrame(animationFrameId);
    });
  });

  return (
    <span class={props.class} aria-live="polite">
      {new Intl.NumberFormat().format(displayValue())}
    </span>
  );
}
