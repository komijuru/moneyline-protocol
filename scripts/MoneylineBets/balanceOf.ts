import {MONEYLINE_BETS_CONTRACT} from './index';
import {ethers} from "hardhat";
import {formatEther} from "ethers/lib/utils";

async function main() {
    const provider = ethers.getDefaultProvider("goerli");
    const {contract, owner: alice, bob} = await MONEYLINE_BETS_CONTRACT();
    const [contractBalance, aliceBalance, bobBalance] = [
        await provider.getBalance(contract.address),
        await provider.getBalance(await alice.getAddress()),
        await provider.getBalance(await bob.getAddress())
    ].map(it => formatEther(it))

    console.log("Contract:", contractBalance)
    console.log("Alice:", aliceBalance)
    console.log("Bob:", bobBalance)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });