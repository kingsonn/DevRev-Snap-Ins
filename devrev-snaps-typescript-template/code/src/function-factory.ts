import summarize from './functions/summarize';
export const functionFactory = {
  // Add your functions here
  summarize,

} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
