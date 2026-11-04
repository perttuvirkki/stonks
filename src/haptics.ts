import * as Haptics from "expo-haptics";

// Fire-and-forget wrappers: haptics are cosmetic, so a rejected promise (simulator, low power mode) is ignored.
const ignore = () => {};

export const tapHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
export const selectHaptic = () => Haptics.selectionAsync().catch(ignore);
export const thudHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
export const heavyHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
export const successHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
export const warningHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
export const errorHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);

/** A short drum-roll of taps, used when a big number lands. */
export const celebrateHaptic = () => {
  successHaptic();
  [120, 220, 300].forEach((delay, index) => {
    setTimeout(index === 2 ? heavyHaptic : tapHaptic, delay);
  });
};
