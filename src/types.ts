export type Candle = {
  id: string;
  open: number;
  close: number;
  high: number;
  low: number;
  index?: number;
};

export type PatternDefinition = {
  id: string;
  label: string;
  length: number;
  generate: (startPrice: number) => PatternResult;
};

export type PatternResult = {
  candles: Candle[];
  targetPrice: number;
  lines?: PatternLine[];
};

export type PatternLine = {
  id: string;
  type: 'support' | 'resistance';
  startOffset: number;
  endOffset: number;
  startPrice: number;
  endPrice: number;
};
