export const getContrastingTextColor = (background: string, fallback: string) => {
  if (background === "transparent") {
    return fallback;
  }
  if (background === "#1a9f7a" || background === "#d94b4b" || background === "#f5a524") {
    return "#ffffff";
  }
  return fallback;
};
