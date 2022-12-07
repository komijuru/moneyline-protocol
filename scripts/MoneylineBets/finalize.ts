import {NonceManager} from '@ethersproject/experimental';

import {MONEYLINE_BETS_CONTRACT, Status} from './index';

async function main() {
    const {contract, owner} = await MONEYLINE_BETS_CONTRACT();
    const executor = new NonceManager(owner);

    const closedBets = await contract.viewBets(0, await executor.getAddress())
    const closedBetIds = closedBets
        .filter(it => !it.id.eq(0))
        .filter(it => it.status === Status.CLOSED)
        .map(it => it.id)
    for (const id of closedBetIds) {
        console.log('Finalizing bet: #', id.toNumber());
        const tx = await contract.connect(executor)
            .finalizeBet(id, 0, 10, true);
        console.log(tx);
        console.log('========================\n');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });