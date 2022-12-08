import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {MONEYLINE_BETS, MONEYLINE_BETS_VARIABLES} from './index';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const {
        deployments: {deploy},
        getNamedAccounts
    } = hre;

    const {deployer} = await getNamedAccounts();

    await deploy(MONEYLINE_BETS, {
        contract: MONEYLINE_BETS,
        from: deployer,
        args: [MONEYLINE_BETS_VARIABLES.TREASURY_ADDRESS],
        log: true
    });
};

export default func;
func.tags = [MONEYLINE_BETS];
