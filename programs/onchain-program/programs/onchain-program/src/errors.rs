use anchor_lang::prelude::*;

#[error_code]
pub enum StreamError {
    #[msg("Tick interval must be at least 500ms")]
    IntervalTooFast,
    #[msg("Rate per tick must be greater than 0")]
    InvalidRate,
    #[msg("Session is not active")]
    SessionNotActive,
    #[msg("Arithmetic overflow")]
    Overflow,
}
