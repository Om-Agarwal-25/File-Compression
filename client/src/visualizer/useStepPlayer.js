import { useEffect, useState } from "react";

export function useStepPlayer(steps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => setIndex(0), [steps]);
  useEffect(() => {
    if (!playing || !steps.length) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, steps.length]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.matches("input, textarea, select")) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if (event.key === "ArrowRight") setIndex((value) => Math.min(steps.length - 1, value + 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
      if (event.key.toLowerCase() === "r") { setIndex(0); setPlaying(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);
  return {
    index, step: steps[index], playing, speed,
    toggle: () => setPlaying((value) => !value),
    back: () => setIndex((value) => Math.max(0, value - 1)),
    next: () => setIndex((value) => Math.min(steps.length - 1, value + 1)),
    restart: () => { setIndex(0); setPlaying(false); },
    seek: setIndex, setSpeed,
  };
}
