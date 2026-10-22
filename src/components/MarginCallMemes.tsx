import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import TwemojiDog from "../../assets/twemoji/1f436.svg";
import TwemojiFire from "../../assets/twemoji/1f525.svg";
import TwemojiCoffee from "../../assets/twemoji/2615.svg";
import TwemojiSuit from "../../assets/twemoji/1f574.svg";
import TwemojiScroll from "../../assets/twemoji/1f4dc.svg";
import TwemojiGreenHeart from "../../assets/twemoji/1f49a.svg";
import { UiButton } from "./UiButton";

// More margin-call meme screens. Each fills the overlay and ends in a single "try again" button,
// with the "what went wrong" link (when given) just above it.

export type MarginCallMemeProps = {
  bottomPad: number;
  onTryAgain: () => void;
  reviewLink: (color: string) => ReactNode;
  /** Leverage of the position that got liquidated. */
  leverage: number;
  /** Margin lost to the liquidation. */
  lossAmount: number;
};

const formatMoney = (value: number) => `$${Math.max(0, Math.round(value)).toLocaleString("en-US")}`;
const leverageText = (leverage: number) => (leverage > 1 ? `${leverage}x` : "max");

/** A red line falling off a cliff: the house style for "your account". */
const CrashLine = ({ width, height, color = "#d94b4b", strokeWidth = 4 }: { width: number; height: number; color?: string; strokeWidth?: number }) => {
  const points = [
    [0, 0.42],
    [0.12, 0.3],
    [0.22, 0.38],
    [0.34, 0.22],
    [0.46, 0.3],
    [0.56, 0.18],
    [0.64, 0.34],
    [0.72, 0.5],
    [0.8, 0.62],
    [0.88, 0.86],
    [1, 0.97],
  ]
    .map(([x, y]) => `${x * width},${y * height}`)
    .join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
};

export const GroupChatMeme = ({ bottomPad, onTryAgain, reviewLink, leverage }: MarginCallMemeProps) => {
  const messages: { from: string; text: string }[] = [
    { from: "Chad (desk 3)", text: "he bought" },
    { from: "Brenda", text: "how much leverage" },
    { from: "Chad (desk 3)", text: `${leverageText(leverage)} 💀` },
    { from: "Algo #7", text: "dump it" },
    { from: "Brenda", text: "lmaooo" },
    { from: "Chad (desk 3)", text: "gg. lunch?" },
  ];
  return (
    <>
      <View style={[styles.fill, { backgroundColor: "#000000" }]}>
        <View style={styles.chatHeader}>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>MM</Text>
          </View>
          <Text style={styles.chatTitle}>Market Makers 🏦</Text>
          <Text style={styles.chatMembers}>3 people</Text>
        </View>
        <View style={styles.chatBody}>
          {messages.map((message, index) => {
            const showName = index === 0 || messages[index - 1].from !== message.from;
            return (
              <View key={index}>
                {showName && <Text style={styles.chatName}>{message.from}</Text>}
                <View style={styles.chatBubble}>
                  <Text style={styles.chatText}>{message.text}</Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.chatReaction}>Brenda liked "gg. lunch?"</Text>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#000000" }]}>
        {reviewLink("rgba(255,255,255,0.7)")}
        <UiButton title="Sell (too late)" onPress={onTryAgain} variant="borderedProminent" color="#0a84ff" controlSize="large" darkMode />
      </View>
    </>
  );
};

export const ThisIsFineMeme = ({ bottomPad, onTryAgain, reviewLink }: MarginCallMemeProps) => (
  <>
    <View style={[styles.fill, styles.center, { backgroundColor: "#f29a3a" }]}>
      <View style={styles.flames}>
        {[0, 1, 2, 3, 4].map((i) => (
          <TwemojiFire key={i} width={64} height={64} style={{ marginTop: i % 2 ? 18 : 0 }} />
        ))}
      </View>
      <View style={styles.fineChart}>
        <CrashLine width={240} height={90} />
      </View>
      <View style={styles.fineScene}>
        <View style={styles.fineBubble}>
          <Text style={styles.fineBubbleText}>This is fine.</Text>
        </View>
        <View style={styles.fineDogRow}>
          <TwemojiDog width={120} height={120} />
          <TwemojiCoffee width={52} height={52} style={{ marginLeft: -8, marginTop: 56 }} />
        </View>
      </View>
      <View style={styles.flames}>
        {[0, 1, 2, 3, 4].map((i) => (
          <TwemojiFire key={i} width={72} height={72} style={{ marginTop: i % 2 ? 0 : 14 }} />
        ))}
      </View>
    </View>
    <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#f29a3a" }]}>
      {reviewLink("#5a2a00")}
      <UiButton title="It's fine" onPress={onTryAgain} variant="borderedProminent" color="#5a2a00" controlSize="large" darkMode />
    </View>
  </>
);

export const LossPornMeme = ({ bottomPad, onTryAgain, reviewLink, leverage, lossAmount }: MarginCallMemeProps) => {
  const comments = [
    { user: "u/theta_gang", text: "Thank you for your service 🫡" },
    { user: "u/wifes_boyfriend", text: "she says hi 👋" },
    { user: "u/diamondhands420", text: "sir, this is a casino" },
    { user: "u/bagholder_supreme", text: `${leverageText(leverage)}? rookie numbers. you should've gone 100x` },
  ];
  return (
    <>
      <View style={[styles.fill, { backgroundColor: "#dae0e6", paddingHorizontal: 12, paddingTop: 64 }]}>
        <View style={styles.postCard}>
          <Text style={styles.postMeta}>r/wallstreetbets · Posted by u/you · 2m</Text>
          <View style={styles.postFlair}>
            <Text style={styles.postFlairText}>Loss</Text>
          </View>
          <Text style={styles.postTitle}>YOLO'd {formatMoney(lossAmount)} on {leverageText(leverage)} leverage. Gone in seconds. AMA</Text>
          <View style={styles.postImage}>
            <CrashLine width={260} height={110} />
            <Text style={styles.postImageText}>-100.00%</Text>
          </View>
          <View style={styles.postVotes}>
            <Text style={styles.postVoteText}>▲ 4.2k ▼</Text>
            <Text style={styles.postVoteText}>💬 612</Text>
            <Text style={styles.postVoteText}>🏅 Press F</Text>
          </View>
        </View>
        <View style={styles.postComments}>
          {comments.map((comment) => (
            <View key={comment.user} style={styles.comment}>
              <Text style={styles.commentUser}>{comment.user}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#dae0e6" }]}>
        {reviewLink("#1a1a1b")}
        <UiButton title="Post loss porn" onPress={onTryAgain} variant="borderedProminent" color="#ff4500" controlSize="large" darkMode />
      </View>
    </>
  );
};

export const FundraiserMeme = ({ bottomPad, onTryAgain, reviewLink, leverage }: MarginCallMemeProps) => (
  <>
    <View style={[styles.fill, { backgroundColor: "#ffffff", paddingHorizontal: 20, paddingTop: 64 }]}>
      <Text style={styles.fundLogo}>
        <Text style={{ color: "#02a95c" }}>go</Text>fundmeme
      </Text>
      <View style={styles.fundHero}>
        <TwemojiGreenHeart width={72} height={72} />
      </View>
      <Text style={styles.fundTitle}>Help this trader recover from {leverageText(leverage)} leverage</Text>
      <Text style={styles.fundOrganizer}>Organized by: the trader, for the trader</Text>
      <View style={styles.fundProgress}>
        <View style={styles.fundProgressFill} />
      </View>
      <Text style={styles.fundRaised}>
        <Text style={{ fontWeight: "900", color: "#111111" }}>$3 raised</Text> of $10,000 goal
      </Text>
      <View style={styles.fundDonations}>
        {[
          { name: "Mom", amount: "$3", note: "please call me" },
          { name: "Anonymous", amount: "$0", note: "lol" },
          { name: "Your broker", amount: "$0", note: "thanks for the fees ❤️" },
        ].map((donation) => (
          <View key={donation.name} style={styles.fundDonation}>
            <Text style={styles.fundDonor}>
              {donation.name} · <Text style={{ fontWeight: "900" }}>{donation.amount}</Text>
            </Text>
            <Text style={styles.fundNote}>"{donation.note}"</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#ffffff" }]}>
      {reviewLink("#555555")}
      <UiButton title="Donate to yourself" onPress={onTryAgain} variant="borderedProminent" color="#02a95c" controlSize="large" />
    </View>
  </>
);

export const NotificationsMeme = ({ bottomPad, onTryAgain, reviewLink, leverage }: MarginCallMemeProps) => {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const notifications = [
    { app: "BROKER", title: "Position liquidated", body: `Your ${leverageText(leverage)} position has been closed. We tried calling.` },
    { app: "BANK", title: "Balance update", body: "Your available balance is $0.00." },
    { app: "MUSIC", title: "Payment failed", body: "Your playlist is now silent. Fitting." },
    { app: "MESSAGES", title: "Mom", body: "are you ok?? your dad saw something on the news" },
    { app: "MESSAGES", title: "Landlord", body: "Rent is due tomorrow 🙂" },
  ];
  return (
    <>
      <View style={[styles.fill, { backgroundColor: "#1c1c3a", paddingHorizontal: 14 }]}>
        <Text style={styles.lockDate}>{date}</Text>
        <Text style={styles.lockTime}>{time}</Text>
        <View style={styles.lockStack}>
          {notifications.map((notification, index) => (
            <View key={index} style={styles.lockCard}>
              <View style={styles.lockCardHeader}>
                <Text style={styles.lockApp}>{notification.app}</Text>
                <Text style={styles.lockAgo}>{index === 0 ? "now" : `${index}m ago`}</Text>
              </View>
              <Text style={styles.lockTitle}>{notification.title}</Text>
              <Text style={styles.lockBody}>{notification.body}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#1c1c3a" }]}>
        {reviewLink("rgba(255,255,255,0.7)")}
        <UiButton title="Clear all" onPress={onTryAgain} variant="borderedProminent" color="#3a3a6a" controlSize="large" darkMode />
      </View>
    </>
  );
};

export const NotStonksMeme = ({ bottomPad, onTryAgain, reviewLink }: MarginCallMemeProps) => (
  <>
    <View style={[styles.fill, styles.center, { backgroundColor: "#0b1a4a" }]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          {Array.from({ length: 12 }, (_, i) => (
            <Line key={`h-${i}`} x1="0" x2="100%" y1={`${(i + 1) * 8}%`} y2={`${(i + 1) * 8}%`} stroke="#2a4a9a" strokeWidth={1} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <Line key={`v-${i}`} y1="0" y2="100%" x1={`${(i + 1) * 12}%`} x2={`${(i + 1) * 12}%`} stroke="#2a4a9a" strokeWidth={1} />
          ))}
        </Svg>
      </View>
      <View style={styles.stonksChart}>
        <CrashLine width={300} height={200} color="#ff3b30" strokeWidth={10} />
      </View>
      <TwemojiSuit width={200} height={200} />
      <Text style={styles.stonksText}>NOT STONKS</Text>
    </View>
    <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#0b1a4a" }]}>
      {reviewLink("rgba(255,255,255,0.7)")}
      <UiButton title="Not stonks" onPress={onTryAgain} variant="borderedProminent" color="#ff3b30" controlSize="large" darkMode />
    </View>
  </>
);

export const TaxCertificateMeme = ({ bottomPad, onTryAgain, reviewLink, lossAmount }: MarginCallMemeProps) => {
  const year = new Date().getFullYear();
  const years = Math.ceil(lossAmount / 3000);
  return (
    <>
      <View style={[styles.fill, styles.center, { backgroundColor: "#2b2b2b", paddingHorizontal: 18 }]}>
        <View style={styles.certificate}>
          <View style={styles.certificateInner}>
            <TwemojiScroll width={48} height={48} />
            <Text style={styles.certificateKicker}>OFFICIAL</Text>
            <Text style={styles.certificateTitle}>Certificate of Tax Loss</Text>
            <Text style={styles.certificateBody}>This certifies that</Text>
            <Text style={styles.certificateName}>You</Text>
            <Text style={styles.certificateBody}>
              lost <Text style={{ fontWeight: "900" }}>{formatMoney(lossAmount)}</Text> with remarkable speed and confidence.
            </Text>
            <Text style={[styles.certificateBody, { marginTop: 10 }]}>
              {years > 1
                ? `At $3,000 per year, you may write this off until ${year + years}.`
                : "The amount is so small that even the tax office feels bad for you."}
            </Text>
            <View style={styles.certificateSeal}>
              <Text style={styles.certificateSealText}>REKT</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: "#2b2b2b" }]}>
        {reviewLink("rgba(255,255,255,0.7)")}
        <UiButton title="Frame it" onPress={onTryAgain} variant="borderedProminent" color="#b8913a" controlSize="large" darkMode />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Group chat
  chatHeader: {
    alignItems: "center",
    paddingTop: 64,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2c2c2e",
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#636366",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  chatAvatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  chatTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  chatMembers: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 2,
  },
  chatBody: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 4,
  },
  chatName: {
    color: "#8e8e93",
    fontSize: 12,
    marginLeft: 12,
    marginTop: 8,
    marginBottom: 2,
  },
  chatBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#26252a",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "80%",
  },
  chatText: {
    color: "#ffffff",
    fontSize: 17,
  },
  chatReaction: {
    color: "#8e8e93",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },

  // This is fine
  flames: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  fineChart: {
    backgroundColor: "#fff3d6",
    borderRadius: 10,
    padding: 10,
    marginVertical: 18,
    borderWidth: 4,
    borderColor: "#6b3b12",
  },
  fineScene: {
    alignItems: "center",
    marginBottom: 12,
  },
  fineBubble: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: "#111111",
    marginBottom: 6,
  },
  fineBubbleText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111111",
  },
  fineDogRow: {
    flexDirection: "row",
  },

  // Loss porn post
  postCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
  },
  postMeta: {
    fontSize: 12,
    color: "#787c7e",
    marginBottom: 6,
  },
  postFlair: {
    alignSelf: "flex-start",
    backgroundColor: "#d94b4b",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  postFlairText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1b",
    marginBottom: 10,
  },
  postImage: {
    backgroundColor: "#111111",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  postImageText: {
    color: "#ff4d4d",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  postVotes: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  postVoteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#787c7e",
  },
  postComments: {
    marginTop: 10,
    gap: 8,
  },
  comment: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUser: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1b",
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: "#1a1a1b",
  },

  // Fundraiser
  fundLogo: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111111",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  fundHero: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9f8f0",
    borderRadius: 14,
    height: 130,
    marginVertical: 16,
  },
  fundTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },
  fundOrganizer: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 14,
  },
  fundProgress: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e5e5",
    overflow: "hidden",
  },
  fundProgressFill: {
    width: "1%",
    height: "100%",
    backgroundColor: "#02a95c",
  },
  fundRaised: {
    fontSize: 14,
    color: "#666666",
    marginTop: 6,
    marginBottom: 14,
  },
  fundDonations: {
    gap: 10,
  },
  fundDonation: {
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
  },
  fundDonor: {
    fontSize: 15,
    color: "#111111",
  },
  fundNote: {
    fontSize: 13,
    color: "#666666",
    fontStyle: "italic",
    marginTop: 2,
  },

  // Lock screen
  lockDate: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 70,
  },
  lockTime: {
    color: "#ffffff",
    fontSize: 84,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -2,
  },
  lockStack: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 8,
    paddingBottom: 12,
  },
  lockCard: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  lockApp: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  lockAgo: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
  },
  lockTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  lockBody: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
  },

  // Not stonks
  stonksChart: {
    position: "absolute",
    top: "16%",
    alignSelf: "center",
  },
  stonksText: {
    color: "#ffffff",
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 18,
    textShadowColor: "#000000",
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },

  // Tax certificate
  certificate: {
    width: "100%",
    backgroundColor: "#f6eed8",
    padding: 8,
    borderRadius: 4,
  },
  certificateInner: {
    borderWidth: 3,
    borderColor: "#b8913a",
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  certificateKicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#8a6a20",
    marginTop: 8,
  },
  certificateTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#3a2a10",
    textAlign: "center",
    fontFamily: "Georgia",
    marginBottom: 14,
  },
  certificateBody: {
    fontSize: 16,
    color: "#3a2a10",
    textAlign: "center",
    fontFamily: "Georgia",
    lineHeight: 22,
  },
  certificateName: {
    fontSize: 34,
    fontStyle: "italic",
    color: "#3a2a10",
    fontFamily: "Georgia",
    marginVertical: 6,
  },
  certificateSeal: {
    marginTop: 18,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-14deg" }],
    borderWidth: 3,
    borderColor: "#8e2a20",
  },
  certificateSealText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
