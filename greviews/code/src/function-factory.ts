import greview_voc from './functions/greview_voc';

export const functionFactory = {
  greview_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
