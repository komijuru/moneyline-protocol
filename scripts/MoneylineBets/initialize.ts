import { NonceManager } from '@ethersproject/experimental';

import { MONEYLINE_BETS_CONTRACT } from './index';
import worldCup2022 from './worldCup2022.json';

async function main() {
  const { contract, owner } = await MONEYLINE_BETS_CONTRACT();
  const lee = '0x229C06d62600B038DbF8F367c8BAcD041558597C';
  const kim = '0x943e1E996bF429234FC47386DF19E82F2F83E3Fc';
  const ahn = await owner.getAddress();

  const bets = worldCup2022
  .filter(it => it.teamA && it.teamB)
  .map((it, idx) => ({ ...it, id: idx + 1 }));
  const closedBets = bets
  .filter(it => it.teamAScore !== null && it.teamBScore !== null);

  const executor = new NonceManager(owner);
  // const operatorRole = await contract.OPERATOR_ROLE();
  // const injectorRole = await contract.INJECTOR_ROLE();
  //
  // await contract.connect(executor).grantRole(operatorRole, lee);
  // await contract.connect(executor).grantRole(operatorRole, ahn);
  // await contract.connect(executor).grantRole(operatorRole, kim);
  // await contract.connect(executor).grantRole(injectorRole, lee);
  // await contract.connect(executor).grantRole(injectorRole, ahn);
  // await contract.connect(executor).grantRole(injectorRole, kim);
  //
  //
  // await contract.connect(executor)
  // .openBets(bets
  // .map(it => (
  //   {
  //     code: it.code,
  //     teamA: it.teamA!,
  //     teamB: it.teamB!,
  //     startsAt: it.date - 604800, // 7 days before
  //     endsAt: it.date,
  //     pricePerTicket: it.pricePerTicket,
  //     commissionPerTicket: it.commissionPerTicket
  //   }
  // )));
  //

  //
  // await contract.connect(executor)
  // .closeBets(closedBets.map(it => it.id), closedBets.map(it => {
  //   if (it.teamAScore === it.teamBScore) {
  //     return Result.DRAW.valueOf();
  //   } else if (it.teamAScore! > it.teamBScore!) {
  //     return Result.WIN.valueOf();
  //   }
  //   return Result.LOSE.valueOf();
  // }));

  for (const bet of closedBets) {
    console.log('Finalizing:', bet.id);
    const tx = await contract.connect(executor)
    .finalizeBet(bet.id, 0, 10);
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