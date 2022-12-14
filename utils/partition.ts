export const partition = (input: any[], spacing: number) => {
  const output = [];
  for (let i = 0; i < input.length; i += spacing) {
    output[output.length] = input.slice(i, i + spacing);
  }
  return output;
};
