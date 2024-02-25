import gplay_voc from './functions/gplay_voc';

export const functionFactory = {
  gplay_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
