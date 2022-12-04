export function variables<Type>(
  testnetVariables: Type,
  mainnetVariables: Type
): Type {
  switch (process.env.ETH_NETWORK) {
    case 'MAINNET':
      return {
        ...mainnetVariables
      };
    default:
      return {
        ...testnetVariables
      };
  }
}
