import {MONEYLINE_BETS_CONTRACT, Result} from './index';
import {parseEther} from "ethers/lib/utils";

async function main() {
    const {contract, owner: alice, bob} = await MONEYLINE_BETS_CONTRACT();
    const betId = await contract.latestBetId();
    const bet = await contract.viewBet(betId, await alice.getAddress());
    console.log("Making:", bet)
    const tx1 = await contract.connect(alice).makeBet(betId, Result.WIN, 1, {value: parseEther("0.001")});
    console.log(tx1)
    const tx2 = await contract.connect(bob).makeBet(betId, Result.LOSE, 2, {value: parseEther("0.002")});
    console.log(tx2)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });