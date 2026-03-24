export async function withSuppressedTransportNoise<T>(task: () => Promise<T>): Promise<T> {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("Stitch Transport Error:")) return;
    originalError(...args);
  };
  try {
    return await task();
  } finally {
    console.error = originalError;
  }
}
