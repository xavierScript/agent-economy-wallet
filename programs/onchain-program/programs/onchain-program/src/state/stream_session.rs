use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StreamSession {
    /// UUID as raw bytes — used as PDA seed
    pub session_id: [u8; 16],   // 16
    /// Buyer wallet pubkey
    pub buyer: Pubkey,          // 32
    /// Merchant wallet pubkey
    pub merchant: Pubkey,       // 32
    /// USDC base units paid per tick
    pub rate_per_tick: u64,     // 8
    /// Milliseconds between ticks
    pub interval_ms: u64,       // 8
    /// Number of ticks recorded so far
    pub tick_count: u64,        // 8
    /// Cumulative USDC base units paid
    pub total_paid: u64,        // 8
    /// Current session status
    pub status: SessionStatus,  // 1
    /// Unix timestamp when the session started
    pub started_at: i64,        // 8
    /// PDA bump seed
    pub bump: u8,               // 1
    // Total: 16 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 1 = 122
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SessionStatus {
    Active,
    Closed,
}
