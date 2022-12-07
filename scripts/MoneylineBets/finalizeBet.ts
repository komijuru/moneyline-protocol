import {MONEYLINE_BETS_CONTRACT} from './index';

async function main() {
    const {contract, owner} = await MONEYLINE_BETS_CONTRACT();
    const betId = await contract.latestBetId();
    const bet = await contract.viewBet(betId, await owner.getAddress());
    console.log("Finalizing:", bet)
    const tx = await contract.connect(owner).finalizeBet(betId, 0, 100, true);
    console.log(tx)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });