export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bd } = await import("@/nucleo/bd");
    bd();
  }
}
