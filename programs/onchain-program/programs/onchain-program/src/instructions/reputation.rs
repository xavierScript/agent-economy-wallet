use anchor_lang::prelude::*;
use crate::state::MerchantAccount;

// ── Instruction handlers ────────────────────────────────────────────────

/// Initialize a merchant reputation account.
/// Callable by anyone — typically the first buyer or the merchant itself.
/// The PDA is derived from the merchant's public key, ensuring one
/// reputation account per merchant.
pub fn initialize_merchant(ctx: Context<InitializeMerchant>) -> Result<()> {
    let account = &mut ctx.accounts.merchant_account;
    account.merchant = ctx.accounts.merchant.key();
    account.total_payments = 0;
    account.total_volume_lamports = 0;
    account.unique_buyers = 0;
    account.last_payment_ts = 0;
    account.bump = ctx.bumps.merchant_account;

    msg!(
        "Merchant reputation initialized: {}",
        ctx.accounts.merchant.key()
    );
    Ok(())
}

/// Record a payment to a merchant.
/// Called by the buyer after a successful x402 payment.
/// Updates total payment count, volume, and timestamp.
///
/// The unique_buyers counter is incremented every 5 payments as
/// a simple heuristic — a production version would track exact
/// unique buyers via a bitmap or separate PDA.
pub fn record_payment(ctx: Context<RecordPayment>, amount: u64) -> Result<()> {
    let account = &mut ctx.accounts.merchant_account;

    account.total_payments = account.total_payments.checked_add(1).unwrap();
    account.total_volume_lamports = account
        .total_volume_lamports
        .checked_add(amount)
        .unwrap();

    let clock = Clock::get()?;
    account.last_payment_ts = clock.unix_timestamp;

    // Simple heuristic: increment unique buyers every 5 payments.
    // A production implementation would track buyer pubkeys via
    // a separate PDA or bitmap for exact counts.
    if account.total_payments % 5 == 1 {
        account.unique_buyers = account.unique_buyers.checked_add(1).unwrap();
    }

    msg!(
        "Payment recorded: {} lamports to merchant {}, total: {}",
        amount,
        account.merchant,
        account.total_payments
    );
    Ok(())
}

/// Read a merchant's reputation (view-only convenience).
/// On-chain this is a no-op — clients read the PDA directly.
/// This instruction exists so the IDL generates the correct
/// TypeScript types for account deserialization.
pub fn get_reputation(ctx: Context<GetReputation>) -> Result<()> {
    let account = &ctx.accounts.merchant_account;
    msg!(
        "Reputation for {}: payments={}, volume={}, buyers={}, trust={}",
        account.merchant,
        account.total_payments,
        account.total_volume_lamports,
        account.unique_buyers,
        // Trust score: (payments / (payments + 10)) * 100
        (account.total_payments * 100) / (account.total_payments + 10)
    );
    Ok(())
}

// ── Accounts ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMerchant<'info> {
    /// The merchant reputation PDA — one per merchant pubkey.
    #[account(
        init,
        payer = payer,
        space = 8 + MerchantAccount::INIT_SPACE,
        seeds = [b"merchant", merchant.key().as_ref()],
        bump,
    )]
    pub merchant_account: Account<'info, MerchantAccount>,

    /// The merchant whose reputation is being tracked.
    /// CHECK: This is just a public key used for PDA derivation — no data is read.
    pub merchant: UncheckedAccount<'info>,

    /// Transaction payer (rent).
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordPayment<'info> {
    /// Merchant reputation PDA — must already be initialized.
    #[account(
        mut,
        seeds = [b"merchant", merchant.key().as_ref()],
        bump = merchant_account.bump,
    )]
    pub merchant_account: Account<'info, MerchantAccount>,

    /// The merchant whose reputation is being updated.
    /// CHECK: This is just a public key for PDA derivation.
    pub merchant: UncheckedAccount<'info>,

    /// The buyer recording the payment — must sign.
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetReputation<'info> {
    /// Merchant reputation PDA — read-only.
    #[account(
        seeds = [b"merchant", merchant.key().as_ref()],
        bump = merchant_account.bump,
    )]
    pub merchant_account: Account<'info, MerchantAccount>,

    /// CHECK: Public key for PDA derivation only.
    pub merchant: UncheckedAccount<'info>,
}
