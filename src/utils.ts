export { createCandle } from "./market/engine";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getPinchAxes = (touches: { pageX: number; pageY: number }[]) => {
  if (touches.length < 2) {
    return { dx: 0, dy: 0 };
  }
  const [first, second] = touches;
  const dx = Math.abs(first.pageX - second.pageX);
  const dy = Math.abs(first.pageY - second.pageY);
  return { dx, dy };
};
