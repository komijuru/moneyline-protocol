import {MONEYLINE_BETS_CONTRACT} from './index';
import {parseEther} from "ethers/lib/utils";

async function main() {
    const {contract, owner} = await MONEYLINE_BETS_CONTRACT();

    const now = Math.floor(new Date().getTime() / 1e3)

    console.log("Opening")
    const tx = await contract.connect(owner).openBets([{
        code: '2022_WORLD_CUP',
        teamA: "Korea",
        teamB: "Japan",
        startsAt: now,
        endsAt: now + 180,
        pricePerTicket: parseEther("0.001"),
        commissionPerTicket: parseEther("0.0001"),
    }]);
    console.log(tx)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });