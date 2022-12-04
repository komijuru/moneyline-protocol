import { BigNumber } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';

export function parseUSDC(usdc: string): BigNumber {
  return parseUnits(usdc, 6);
}