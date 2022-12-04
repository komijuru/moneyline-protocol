import { variables } from '@utils/variables';
import { contracts as goerli } from '@deployments/goerli.json';

export const MONEYLINE_BETS = 'MoneylineBets';

interface MoneylineBetsVariables {
  TREASURY_ADDRESS: string;
  USDC_ADDRESS: string;
}

export const MONEYLINE_BETS_VARIABLES = variables<MoneylineBetsVariables>({
  TREASURY_ADDRESS: '0x48277469a140826B50E9B35983e7d6D70076D729',
  USDC_ADDRESS: goerli.TestUSDC.address
}, {
  TREASURY_ADDRESS: '0x48277469a140826B50E9B35983e7d6D70076D729',
  USDC_ADDRESS: ''
});