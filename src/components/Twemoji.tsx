import { Children, Fragment, memo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import type { SvgProps } from "react-native-svg";
import Twemoji1f357 from "../../assets/twemoji/1f357.svg";
import Twemoji1f3ae from "../../assets/twemoji/1f3ae.svg";
import Twemoji1f3b0 from "../../assets/twemoji/1f3b0.svg";
import Twemoji1f3c6 from "../../assets/twemoji/1f3c6.svg";
import Twemoji1f3f7 from "../../assets/twemoji/1f3f7.svg";
import Twemoji1f40b from "../../assets/twemoji/1f40b.svg";
import Twemoji1f480 from "../../assets/twemoji/1f480.svg";
import Twemoji1f48e from "../../assets/twemoji/1f48e.svg";
import Twemoji1f4a5 from "../../assets/twemoji/1f4a5.svg";
import Twemoji1f4a8 from "../../assets/twemoji/1f4a8.svg";
import Twemoji1f4b5 from "../../assets/twemoji/1f4b5.svg";
import Twemoji1f4c8 from "../../assets/twemoji/1f4c8.svg";
import Twemoji1f4c9 from "../../assets/twemoji/1f4c9.svg";
import Twemoji1f4ca from "../../assets/twemoji/1f4ca.svg";
import Twemoji1f4da from "../../assets/twemoji/1f4da.svg";
import Twemoji1f4de from "../../assets/twemoji/1f4de.svg";
import Twemoji1f4f8 from "../../assets/twemoji/1f4f8.svg";
import Twemoji1f512 from "../../assets/twemoji/1f512.svg";
import Twemoji1f525 from "../../assets/twemoji/1f525.svg";
import Twemoji1f534 from "../../assets/twemoji/1f534.svg";
import Twemoji1f56f from "../../assets/twemoji/1f56f.svg";
import Twemoji1f5a8 from "../../assets/twemoji/1f5a8.svg";
import Twemoji1f610 from "../../assets/twemoji/1f610.svg";
import Twemoji1f64c from "../../assets/twemoji/1f64c.svg";
import Twemoji1f680 from "../../assets/twemoji/1f680.svg";
import Twemoji1f6cd from "../../assets/twemoji/1f6cd.svg";
import Twemoji1f6de from "../../assets/twemoji/1f6de.svg";
import Twemoji1f7e2 from "../../assets/twemoji/1f7e2.svg";
import Twemoji1f98d from "../../assets/twemoji/1f98d.svg";
import Twemoji1f998 from "../../assets/twemoji/1f998.svg";
import Twemoji1f9fb from "../../assets/twemoji/1f9fb.svg";
import Twemoji2728 from "../../assets/twemoji/2728.svg";
import Twemoji2796 from "../../assets/twemoji/2796.svg";

type SvgComponent = React.FC<SvgProps>;

// Metro needs static imports, so every emoji the UI shows is registered here.
// Keys are the emoji without the U+FE0F variation selector.
const TWEMOJI: Record<string, SvgComponent> = {
  "🍗": Twemoji1f357,
  "🎮": Twemoji1f3ae,
  "🎰": Twemoji1f3b0,
  "🏆": Twemoji1f3c6,
  "🏷": Twemoji1f3f7,
  "🐋": Twemoji1f40b,
  "💀": Twemoji1f480,
  "💎": Twemoji1f48e,
  "💥": Twemoji1f4a5,
  "💨": Twemoji1f4a8,
  "💵": Twemoji1f4b5,
  "📈": Twemoji1f4c8,
  "📉": Twemoji1f4c9,
  "📊": Twemoji1f4ca,
  "📚": Twemoji1f4da,
  "📞": Twemoji1f4de,
  "📸": Twemoji1f4f8,
  "🔒": Twemoji1f512,
  "🔥": Twemoji1f525,
  "🔴": Twemoji1f534,
  "🕯": Twemoji1f56f,
  "🖨": Twemoji1f5a8,
  "😐": Twemoji1f610,
  "🙌": Twemoji1f64c,
  "🚀": Twemoji1f680,
  "🛍": Twemoji1f6cd,
  "🛞": Twemoji1f6de,
  "🟢": Twemoji1f7e2,
  "🦍": Twemoji1f98d,
  "🦘": Twemoji1f998,
  "🧻": Twemoji1f9fb,
  "✨": Twemoji2728,
  "➖": Twemoji2796,
};

const EMOJI_PATTERN = new RegExp(`(${Object.keys(TWEMOJI).join("|")})\\uFE0F?`, "gu");

export const hasTwemoji = (text: string | undefined | null) => {
  if (!text) return false;
  EMOJI_PATTERN.lastIndex = 0;
  return EMOJI_PATTERN.test(text);
};

type TwemojiProps = {
  emoji: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Renders a single emoji as a bundled Twemoji graphic. Unknown emoji fall back to plain text. */
export const Twemoji = memo(({ emoji, size = 16, style }: TwemojiProps) => {
  const Svg = TWEMOJI[emoji.replace(/️/g, "")];
  if (!Svg) {
    return <Text style={{ fontSize: size }}>{emoji}</Text>;
  }
  return <Svg width={size} height={size} style={style} />;
});

Twemoji.displayName = "Twemoji";

const splitEmoji = (text: string, size: number, keyPrefix: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  EMOJI_PATTERN.lastIndex = 0;
  for (let match = EMOJI_PATTERN.exec(text); match; match = EMOJI_PATTERN.exec(text)) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <View key={`${keyPrefix}-${match.index}`} style={{ width: size, height: size, transform: [{ translateY: size * 0.15 }] }}>
        <Twemoji emoji={match[1]} size={size} />
      </View>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

export type EmojiTextProps = TextProps & {
  /** Emoji size in px. Defaults to the text's font size. */
  emojiSize?: number;
};

/** Drop-in replacement for <Text> that swaps emoji characters in string children for Twemoji graphics. */
export const EmojiText = ({ children, emojiSize, style, ...rest }: EmojiTextProps) => {
  const fontSize = (StyleSheet.flatten(style) as TextStyle | undefined)?.fontSize ?? 14;
  const size = emojiSize ?? Math.round(fontSize * 1.05);
  const content = Children.map(children, (child, index) =>
    typeof child === "string" ? <Fragment key={index}>{splitEmoji(child, size, String(index))}</Fragment> : child,
  );
  return (
    <Text style={style} {...rest}>
      {content}
    </Text>
  );
};
