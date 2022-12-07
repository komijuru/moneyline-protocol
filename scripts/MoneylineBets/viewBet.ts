import {MONEYLINE_BETS_CONTRACT} from './index';

async function main() {
    const {contract, owner} = await MONEYLINE_BETS_CONTRACT();

    const betId = await contract.latestBetId();
    const bet = await contract.viewBet(betId, await owner.getAddress());
    const betRaw = await contract.bets(betId);
    console.log("View:", bet)
    console.log("View raw:", betRaw)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });