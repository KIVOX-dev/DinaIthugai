/* eslint-disable @typescript-eslint/no-explicit-any */
/** Loose filter type: mongoose's FilterQuery over our deeply nested schemas makes tsc exhaust memory. All inputs are zod-validated first. */
export type Filter = Record<string, any>;
