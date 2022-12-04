import { MONEYLINE_BETS } from '@deploy/MoneylineBets';
import { MoneylineBets, MoneylineBets__factory } from '@typechain-types/index';
import { contracts as goerli } from '@deployments/goerli.json';
import { variables } from '@utils/variables';
import { ethers, getNamedAccounts } from 'hardhat';

export enum Result {
  NONE, WIN, DRAW, LOSE
}

export enum Status {
  NONE, OPEN, CLOSED, FINALIZED
}

interface UsingMoneylineBetsVariables {
  ADDRESS: string;
}

export const USING_MONEYLINE_BETS_VARIABLES = variables<UsingMoneylineBetsVariables>(
  {
    ADDRESS: goerli.MoneylineBets.address
  },
  {
    ADDRESS: ''
  }
);

export const MONEYLINE_BETS_CONTRACT = async () => {
  const { alice } = await getNamedAccounts();
  const owner = await ethers.getSigner(alice);
  const factory: MoneylineBets__factory = await ethers.getContractFactory(
    MONEYLINE_BETS
  );
  const contract: MoneylineBets = factory.attach(USING_MONEYLINE_BETS_VARIABLES.ADDRESS);
  console.log('Contract deployed to: ', USING_MONEYLINE_BETS_VARIABLES.ADDRESS);
  console.log('Contract deployed by (Owner): ', owner.address, '\n');
  return { contract, owner };

};
