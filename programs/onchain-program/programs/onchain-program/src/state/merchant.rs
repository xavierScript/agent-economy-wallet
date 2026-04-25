use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MerchantAccount {
    /// Merchant public key this account tracks
    pub merchant: Pubkey,           // 32
    /// Total number of payments received
    pub total_payments: u64,        // 8
    /// Total volume in smallest token units (lamports / base units)
    pub total_volume_lamports: u64, // 8
    /// Approximate count of unique buyers
    pub unique_buyers: u32,         // 4
    /// Unix timestamp of the last recorded payment
    pub last_payment_ts: i64,       // 8
    /// PDA bump seed
    pub bump: u8,                   // 1
}
