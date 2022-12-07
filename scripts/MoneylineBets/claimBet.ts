import {MONEYLINE_BETS_CONTRACT} from './index';

async function main() {
    const {contract, owner: alice, bob} = await MONEYLINE_BETS_CONTRACT();
    const betId = await contract.latestBetId();
    const bet = await contract.viewBet(betId, await alice.getAddress());
    console.log("Claim:", bet)
    const tx1 = await contract.connect(alice).claimBet(betId);
    console.log(tx1)
    const tx2 = await contract.connect(bob).claimBet(betId);
    console.log(tx2)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });