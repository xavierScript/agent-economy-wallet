use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::reputation::*;
use instructions::streaming::*;

declare_id!("A1N2w7TTbQXRcmV3xqq5dqsG6cja1mNmjkKKnKAXxDLz");

/// Agent Economy On-Chain Program
///
/// A unified Solana program for the Agent Economy ecosystem:
///
/// 1. **Reputation** — tracks payment volume, transaction count, and
///    unique buyers for each merchant agent.
///
/// 2. **Streaming Payments** — per-compute streaming payment sessions
///    via MagicBlock Ephemeral Rollups. Sessions are created on L1,
///    delegated to the ER for real-time tick updates, then committed
///    back to L1 on close.
#[ephemeral]
#[program]
pub mod onchain_program {
    use super::*;

    // ── Reputation instructions ──────────────────────────────────────

    /// Initialize a merchant reputation account.
    pub fn initialize_merchant(ctx: Context<InitializeMerchant>) -> Result<()> {
        instructions::reputation::initialize_merchant(ctx)
    }

    /// Record a payment to a merchant.
    pub fn record_payment(ctx: Context<RecordPayment>, amount: u64) -> Result<()> {
        instructions::reputation::record_payment(ctx, amount)
    }

    /// Read a merchant's reputation (view-only convenience).
    pub fn get_reputation(ctx: Context<GetReputation>) -> Result<()> {
        instructions::reputation::get_reputation(ctx)
    }

    // ── Streaming payment instructions ───────────────────────────────

    /// Create a StreamSession PDA on L1 before delegation.
    pub fn initialize_session(
        ctx: Context<InitializeSession>,
        session_id: [u8; 16],
        rate_per_tick: u64,
        interval_ms: u64,
    ) -> Result<()> {
        instructions::streaming::initialize_session(ctx, session_id, rate_per_tick, interval_ms)
    }

    /// Delegate the StreamSession PDA from L1 to the Ephemeral Rollup.
    pub fn delegate_session(ctx: Context<DelegateSession>, session_id: [u8; 16]) -> Result<()> {
        instructions::streaming::delegate_session(ctx, session_id)
    }

    /// Record a payment tick on the Ephemeral Rollup.
    pub fn record_tick(ctx: Context<RecordTick>, amount_paid: u64) -> Result<()> {
        instructions::streaming::record_tick(ctx, amount_paid)
    }

    /// Close the session and commit + undelegate back to L1.
    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::streaming::close_session(ctx)
    }
}
