export const handler = async (
  event: Record<string, unknown>,
): Promise<void> => {
  console.log("Build event received", JSON.stringify(event));
};
