import {MONEYLINE_BETS_CONTRACT, Result} from './index';

async function main() {
    const {contract, owner} = await MONEYLINE_BETS_CONTRACT();

    const betId = 19
    const bet = await contract.viewBet(betId, await owner.getAddress());
    console.log("Closing:", bet)
    const tx = await contract.connect(owner).closeBets([betId], [Result.WIN]);
    console.log(tx)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });