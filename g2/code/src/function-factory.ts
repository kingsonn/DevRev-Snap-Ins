import g2_voc from './functions/g2_voc';

export const functionFactory = {
  g2_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
