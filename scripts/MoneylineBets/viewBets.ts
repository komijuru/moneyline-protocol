import { MONEYLINE_BETS_CONTRACT } from './index';

async function main() {
  const { contract, owner } = await MONEYLINE_BETS_CONTRACT();
  const bets = await contract.viewBets(1);
  console.log(bets.slice(0, 50));
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});