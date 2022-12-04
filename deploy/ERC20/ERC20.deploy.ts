import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TEST_USDC } from '@deploy/ERC20/index';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {
    deployments: { deploy },
    getNamedAccounts
  } = hre;

  const { alice } = await getNamedAccounts();

  await deploy(TEST_USDC, {
    contract: TEST_USDC,
    from: alice,
    log: true
  });
};

export default func;
func.tags = [TEST_USDC];
