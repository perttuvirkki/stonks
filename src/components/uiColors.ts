export const getContrastingTextColor = (background: string, fallback: string) => {
  if (background === "transparent") {
    return fallback;
  }
  if (background === "#1a9f7a" || background === "#d94b4b" || background === "#f5a524") {
    return "#ffffff";
  }
  return fallback;
};

// Black or white text for a solid hex background, by relative luminance.
export const getReadableTextOn = (background: string) => {
  const hex = background.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return "#ffffff";
  }
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.22 ? "#000000" : "#ffffff";
};
