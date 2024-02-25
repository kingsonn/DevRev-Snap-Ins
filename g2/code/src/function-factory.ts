import g_voc from './functions/g_voc';

export const functionFactory = {
  g_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
