import { Connection, clusterApiUrl, type Cluster } from "@solana/web3.js";

/**
 * Manages the Solana RPC connection.
 * Provides a singleton-like connection to avoid creating multiple connections.
 */
export class SolanaConnection {
  private connection: Connection;
  private cluster: Cluster;

  constructor(rpcUrl?: string, cluster: Cluster = "devnet") {
    this.cluster = cluster;
    const url = rpcUrl || clusterApiUrl(cluster);
    this.connection = new Connection(url, "confirmed");
  }

  getConnection(): Connection {
    return this.connection;
  }

  getCluster(): Cluster {
    return this.cluster;
  }

  async getLatestBlockhash(): Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    return this.connection.getLatestBlockhash();
  }

  async getBalance(publicKeyStr: string): Promise<number> {
    const { PublicKey } = await import("@solana/web3.js");
    const pk = new PublicKey(publicKeyStr);
    return this.connection.getBalance(pk);
  }

  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    return this.connection.getMinimumBalanceForRentExemption(dataLength);
  }

  async requestAirdrop(
    publicKeyStr: string,
    lamports: number,
  ): Promise<string> {
    const { PublicKey } = await import("@solana/web3.js");
    const pk = new PublicKey(publicKeyStr);
    const sig = await this.connection.requestAirdrop(pk, lamports);
    await this.connection.confirmTransaction(sig, "confirmed");
    return sig;
  }
}
