import { Easing, Keyframe, SlideInRight, SlideOutRight } from "react-native-reanimated";

// Screen transitions for the single-route app. Each screen only ever leaves in one direction
// (sub-screens always go back to the menu, the menu always goes forward), so the exit animation
// can be chosen from the screen being left without knowing where the user is headed.

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);

/** Sub-screens (settings, daily quote) slide in like a pushed page… */
export const pushEnter = SlideInRight.duration(340).easing(EASE_OUT);
/** …and slide back out the way they came. */
export const pushExit = SlideOutRight.duration(260).easing(EASE_IN);

/** The menu settles back into place when something closes over it. */
export const menuEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(320);

/** The menu recedes when a screen opens on top of it. */
export const menuExit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.95 }], easing: EASE_IN },
}).duration(220);

/** The game zooms in from slightly larger, like stepping into it. */
export const gameEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.06 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(380);

export const gameExit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 1.04 }], easing: EASE_IN },
}).duration(220);

/** Small overshoot pop for counters and badges that remount when their value changes. */
export const popIn = new Keyframe({
  0: { opacity: 0.4, transform: [{ scale: 0.6 }] },
  55: { opacity: 1, transform: [{ scale: 1.15 }], easing: EASE_OUT },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(320);
