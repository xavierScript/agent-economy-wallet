import { NextResponse } from "next/server";

/**
 * API endpoint for the dashboard to fetch system status.
 * In production, this would connect to the running agent-engine
 * via WebSocket or shared state. For the demo, returns mock data.
 */
export async function GET() {
  // In a full implementation, this connects to the running engine
  // For now, return mock data that demonstrates the API shape
  return NextResponse.json({
    cluster: process.env.SOLANA_CLUSTER || "devnet",
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    timestamp: new Date().toISOString(),
    wallets: [],
    agents: [],
    recentLogs: [],
  });
}
