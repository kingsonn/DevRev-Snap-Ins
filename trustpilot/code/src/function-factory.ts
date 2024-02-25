import trustpilot_voc from './functions/trustpilot_voc';

export const functionFactory = {
  trustpilot_voc,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
