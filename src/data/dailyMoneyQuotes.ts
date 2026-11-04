export type DailyMoneyQuote = {
  text: string;
  author: string;
  source: string;
  // Meme quotes the internet pinned on someone famous; shown with an UNCONFIRMED tag.
  unconfirmed?: boolean;
};

// Short excerpts are grouped from primary or first-party sources:
// Berkshire Hathaway shareholder letters, John C. Bogle's published speeches,
// Oaktree memos, Fidelity's Peter Lynch material, and Franklin's The Way to Wealth.
export const DAILY_MONEY_QUOTES: readonly DailyMoneyQuote[] = [
  { text: "Price is what you pay. Value is what you get.", author: "Benjamin Graham", source: "Quoted in Berkshire's 2008 letter" },
  { text: "When investing, pessimism is your friend, euphoria the enemy.", author: "Warren Buffett", source: "Berkshire 2008 shareholder letter" },
  { text: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "Time is the friend of the wonderful business, the enemy of the mediocre.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "We've never succeeded in making a good deal with a bad person.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "We've done better by avoiding dragons than by slaying them.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "You only learn who has been swimming naked when the tide goes out.", author: "Warren Buffett", source: "Berkshire 2007 shareholder letter" },
  { text: "The rear-view mirror is one thing; the windshield is another.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "We enjoy the process far more than the proceeds.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },
  { text: "In a finite world, high growth rates must self-destruct.", author: "Warren Buffett", source: "Berkshire 1989 shareholder letter" },

  { text: "If you would be wealthy, think of saving as well as of getting.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "Buy what thou hast no need of, and ere long thou shalt sell thy necessaries.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "At a great pennyworth pause a while.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "Many a little makes a mickle.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "Fools make feasts, and wise men eat them.", author: "Benjamin Franklin", source: "The Way to Wealth" },
  { text: "Great estates may venture more, but little boats should keep near shore.", author: "Benjamin Franklin", source: "Poor Richard's sayings" },
  { text: "If you would know the value of money, go and try to borrow some.", author: "Benjamin Franklin", source: "Poor Richard's sayings" },
  { text: "For age and want, save while you may. No morning sun lasts a whole day.", author: "Benjamin Franklin", source: "Poor Richard's sayings" },
  { text: "Drive thy business! Let not thy business drive thee!", author: "Benjamin Franklin", source: "Poor Richard's sayings" },

  { text: "Time is your friend. Impulse is your enemy.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "Buy right and hold tight.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "Cost matters.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "If you aren't sure, diversify.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "Invest for the long-term.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "Stay the course.", author: "John C. Bogle", source: "Reinventing Mutual Funds, 2001" },
  { text: "Never think you know more than the market. No one does.", author: "John C. Bogle", source: "Parallaxes and Taxes, 1997" },

  { text: "Invest in what you know.", author: "Peter Lynch", source: "Fidelity investing guidance" },
  { text: "Use your specialized knowledge to home in on stocks you can analyze.", author: "Peter Lynch", source: "Fidelity trading guide" },

  { text: "Cycles are inevitable.", author: "Howard Marks", source: "You Can't Predict. You Can Prepare." },
  { text: "Trees don't grow to the sky, and few things go to zero.", author: "Howard Marks", source: "You Can't Predict. You Can Prepare." },
  { text: "The key to dealing with the future lies in knowing where you are.", author: "Howard Marks", source: "You Can't Predict. You Can Prepare." },

  // Meme quotes the internet attributes to Buffett, transcribed from popular meme images.
  { text: "Freak the fuck out and panic sell everything right now. It's fucking over.", author: "Warren Buffett", source: "Reddit", unconfirmed: true },
  { text: "Buy the fkn dip.", author: "Warren Buffett", source: "Etsy mug", unconfirmed: true },
  { text: "Risk it all in one trade, go big or go home.", author: "Warren Buffett", source: "r/wallstreetbets", unconfirmed: true },
  { text: "Panic sell when others are fearful.", author: "Warren Buffett", source: "Etsy", unconfirmed: true },
  { text: "A bull market is like sex. It feels best just before it ends.", author: "Warren Buffett", source: "BuzzFeed News", unconfirmed: true },
  { text: "Would you walk by a $5 bill on the sidewalk? Of course not. And yet that's what you're doing every time you pass by a dead squirrel. The tail can be sold to make fishing lures. The skull can bring up to $2 on eBay. The meat is worth a few cents as well. So if you aren't picking up those dead squirrels, don't come crying to me that you're broke.", author: "Warren Buffett", source: "On his advice to young entrepreneurs", unconfirmed: true },
  { text: "The rich invest in Norwegian Salmon, the poor invest in money.", author: "Warren Buffett", source: "Reddit", unconfirmed: true },
  { text: "The best way to teach your kids about taxes is by eating 30% of their ice cream.", author: "Warren Buffett", source: "Instagram", unconfirmed: true },
  { text: "My first wife lost my credit card and I made no attempt to get it back, because the guy was spending less than she did.", author: "Warren Buffett", source: "Facebook", unconfirmed: true },
  { text: "Find as many coins as you can. And fast!", author: "Warren Buffett", source: "On his best financial advice", unconfirmed: true },
  { text: "The iPhone was more like Kraft Macaroni & Cheese than a computing device.", author: "Warren Buffett", source: "Imgflip", unconfirmed: true },
  { text: "If you don't find a way to make money while you sleep, you will work until you die.", author: "Warren Buffett", source: "TikTok", unconfirmed: true },
  { text: "How to stay poor: 1. Watch TV for the whole day. 2. Don't build up any hobbies. 3. Don't get any life passion. 4. Always stay in your comfort zone. 5. Make sure to wait for miracles. 6. Blame others for your problems.", author: "Warren Buffett", source: "Pinterest", unconfirmed: true },
  { text: "You will continue to suffer if you have an emotional reaction to everything that is said to you. True power is sitting back and observing things with logic. True power is restraint. If words control you that means everyone else can control you. Breathe and allow things to pass.", author: "Warren Buffett", source: "AFP Fact Check says he never said it", unconfirmed: true },
  { text: "Failure comes from ego, greed, envy, fear, imitation. I have success not because I am smart, but because I am rational.", author: "Warren Buffett", source: "QuotesGram", unconfirmed: true },
] as const;

export const getDailyMoneyQuote = (date = new Date()): DailyMoneyQuote => {
  const localDayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const index = ((localDayNumber % DAILY_MONEY_QUOTES.length) + DAILY_MONEY_QUOTES.length) % DAILY_MONEY_QUOTES.length;
  return DAILY_MONEY_QUOTES[index] ?? DAILY_MONEY_QUOTES[0];
};
