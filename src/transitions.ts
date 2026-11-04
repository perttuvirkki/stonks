import { Easing, Keyframe } from "react-native-reanimated";

/** Short, firm pop for counters and badges that remount when their value changes. */
export const popIn = new Keyframe({
  0: { opacity: 0.4, transform: [{ scale: 0.88 }] },
  60: { opacity: 1, transform: [{ scale: 1.03 }], easing: Easing.out(Easing.quad) },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(220);
