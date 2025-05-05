use anchor_lang::prelude::*;

declare_id!("5FFwn1xD4ae3kttPDNoHmnW2x2tfekLQXUbRiaj6mBeG");

#[program]
pub mod tickmyshow {
    use super::*;

    pub fn init_event(ctx: Context<InitEvent>, name: String, date: i64, capacity: u32) -> Result<()> {
        let ev = &mut ctx.accounts.event;
        ev.creator = ctx.accounts.creator.key();
        ev.name = name;
        ev.date = date;
        ev.bump = ctx.bumps.event;
        ev.capacity = capacity;
        ev.issued = 0;
        Ok(())
    }

    pub fn mint_ticket(ctx: Context<MintTicket>) -> Result<()> {
        let ev: &mut Account<Event> = &mut ctx.accounts.event;

        require!(ev.issued < ev.capacity, ErrorCode::SoldOut);
        ev.issued += 1;

        let t = &mut ctx.accounts.ticket;
        t.event = ev.key();
        t.owner = ctx.accounts.owner.key();
        t.bump = ctx.bumps.ticket;
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let c = &mut ctx.accounts.checkin;
        c.ticket = ctx.accounts.ticket.key();
        c.owner = *ctx.accounts.owner.key;
        c.timestamp = ctx.accounts.clock.unix_timestamp;
        c.bump = ctx.bumps.checkin;
        Ok(())
    }
}

#[account]
pub struct Ticket {
    pub event: Pubkey,
    pub owner: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Event {
    pub creator: Pubkey,
    pub name: String,
    pub date: i64,
    pub bump: u8,
    pub capacity: u32, 
    pub issued: u32,  
}

#[account]
pub struct CheckInData {
    pub ticket: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitEvent<'info> {
    #[account(
        init,
        seeds = [b"event", creator.key().as_ref(), name.as_bytes()],
        bump,
        payer = creator,
        space = 8 + 32 + 4 + name.len() + 8 + 1 + 4 + 4, // extra for capacity + issued
    )]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTicket<'info> {
    #[account(
        init,
        seeds = [b"ticket", event.key().as_ref(), owner.key().as_ref()],
        bump,
        payer = owner,
        space = 8 + 32 + 32 + 1,
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(
        init,
        seeds = [b"checkin", ticket.key().as_ref(), &clock.unix_timestamp.to_le_bytes()],
        bump,
        payer = owner,
        space = 8 + 32 + 32 + 8 + 1,
    )]
    pub checkin: Account<'info, CheckInData>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub ticket: Account<'info, Ticket>,
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Event is sold out.")]
    SoldOut,
}
