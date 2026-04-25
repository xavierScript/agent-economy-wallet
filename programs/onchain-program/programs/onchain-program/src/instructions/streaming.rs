use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use crate::state::StreamSession;
use crate::state::SessionStatus;
use crate::errors::StreamError;

pub const STREAM_SESSION_SEED: &[u8] = b"stream_session";

// ── Instruction handlers ────────────────────────────────────────────────

/// Create a StreamSession PDA on L1 before delegation.
pub fn initialize_session(
    ctx: Context<InitializeSession>,
    session_id: [u8; 16],
    rate_per_tick: u64,
    interval_ms: u64,
) -> Result<()> {
    require!(interval_ms >= 500, StreamError::IntervalTooFast);
    require!(rate_per_tick > 0, StreamError::InvalidRate);

    let session = &mut ctx.accounts.session;
    session.session_id = session_id;
    session.buyer = ctx.accounts.payer.key();
    session.merchant = ctx.accounts.merchant.key();
    session.rate_per_tick = rate_per_tick;
    session.interval_ms = interval_ms;
    session.tick_count = 0;
    session.total_paid = 0;
    session.status = SessionStatus::Active;
    session.started_at = Clock::get()?.unix_timestamp;
    session.bump = ctx.bumps.session;

    msg!(
        "Stream session initialized: buyer={}, merchant={}, rate={}/{}ms",
        session.buyer,
        session.merchant,
        rate_per_tick,
        interval_ms
    );
    Ok(())
}

/// Delegate the StreamSession PDA from L1 to the Ephemeral Rollup.
pub fn delegate_session(
    ctx: Context<DelegateSession>,
    session_id: [u8; 16],
) -> Result<()> {
    ctx.accounts.delegate_session(
        &ctx.accounts.payer,
        &[
            STREAM_SESSION_SEED,
            ctx.accounts.payer.key.as_ref(),
            &session_id,
        ],
        DelegateConfig {
            validator: ctx.accounts.validator.as_ref().map(|v| v.key()),
            ..Default::default()
        },
    )?;

    msg!("Stream session delegated to ER");
    Ok(())
}

/// Record a payment tick on the Ephemeral Rollup.
/// Called each tick interval to update session state in real time.
pub fn record_tick(ctx: Context<RecordTick>, amount_paid: u64) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(
        session.status == SessionStatus::Active,
        StreamError::SessionNotActive
    );
    session.tick_count += 1;
    session.total_paid = session
        .total_paid
        .checked_add(amount_paid)
        .ok_or(StreamError::Overflow)?;

    msg!(
        "Tick #{}: total_paid={} for session buyer={}",
        session.tick_count,
        session.total_paid,
        session.buyer
    );
    Ok(())
}

/// Close the session and commit + undelegate back to L1.
pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(
        session.status == SessionStatus::Active,
        StreamError::SessionNotActive
    );
    session.status = SessionStatus::Closed;

    msg!(
        "Stream session closed: ticks={}, total_paid={}",
        session.tick_count,
        session.total_paid
    );

    // Serialize before CPI so the ER has the latest state
    session.exit(&crate::ID)?;

    commit_and_undelegate_accounts(
        &ctx.accounts.payer,
        vec![&ctx.accounts.session.to_account_info()],
        &ctx.accounts.magic_context,
        &ctx.accounts.magic_program,
        None,
    )?;

    Ok(())
}

// ── Accounts ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(session_id: [u8; 16])]
pub struct InitializeSession<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + StreamSession::INIT_SPACE,
        seeds = [STREAM_SESSION_SEED, payer.key().as_ref(), &session_id],
        bump
    )]
    pub session: Account<'info, StreamSession>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: merchant is just a pubkey reference stored in the session
    pub merchant: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(session_id: [u8; 16])]
pub struct DelegateSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Checked by the delegation program
    pub validator: Option<AccountInfo<'info>>,

    /// CHECK: The PDA to delegate — ownership verified by the delegation program
    #[account(mut, del)]
    pub session: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RecordTick<'info> {
    #[account(
        mut,
        seeds = [STREAM_SESSION_SEED, session.buyer.as_ref(), session.session_id.as_ref()],
        bump = session.bump
    )]
    pub session: Account<'info, StreamSession>,

    pub payer: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(
        mut,
        seeds = [STREAM_SESSION_SEED, session.buyer.as_ref(), session.session_id.as_ref()],
        bump = session.bump
    )]
    pub session: Account<'info, StreamSession>,

    #[account(mut)]
    pub payer: Signer<'info>,
}
