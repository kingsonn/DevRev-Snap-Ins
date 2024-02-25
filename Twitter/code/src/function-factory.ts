import twitter_voc from './functions/twitter_voc';

export const functionFactory = {
  twitter_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
