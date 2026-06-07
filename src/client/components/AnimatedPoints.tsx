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

    const duration = 500; // animation duration in ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progess = Math.min(elapsed / duration, 1);

      // Easing function: easeOutQuad
      const ease = progess * (2 - progess);
      const current = Math.round(start + (target - start) * ease);

      setDisplayValue(current);

      if (progess < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    onCleanup(() => {
      cancelAnimationFrame(animationFrameId);
    });
  });

  return <span class={props.class}>{displayValue()}</span>;
}
