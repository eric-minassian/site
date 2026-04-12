export const handler = async (
  event: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "OK", path: event["rawPath"] }),
  };
};
