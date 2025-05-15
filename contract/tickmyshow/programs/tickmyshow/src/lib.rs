use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    sysvar::instructions::ID as SYSVAR_INSTRUCTIONS_ID,
    program::invoke_signed,
    system_program,
};
use anchor_spl::{
    token::{self, Mint, TokenAccount, MintTo, Burn, ThawAccount, Token},
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3,
        create_master_edition_v3,
        Metadata,
        CreateMetadataAccountsV3,
        CreateMasterEditionV3,
    },
};

use mpl_token_metadata::{
    instructions::{LockBuilder},
    types::{DataV2},
    // Removed unused import
};


declare_id!("5FFwn1xD4ae3kttPDNoHmnW2x2tfekLQXUbRiaj6mBeG");

const MAX_NAME_LEN: usize = 32;

#[program]
pub mod tickmyshow {
    use super::*;

    pub fn init_event(
        ctx: Context<InitEvent>,
        name: String,
        date: i64,
        capacity: u32,
    ) -> Result<()> {
        let e = &mut ctx.accounts.event;
        e.creator     = ctx.accounts.creator.key();
        e.name        = name;
        e.date        = date;
        e.bump        = ctx.bumps.event;
        e.capacity    = capacity;
        e.issued_nfts = 0;
        Ok(())
    }

    pub fn mint_nft_ticket(
        ctx: Context<MintNftTicket>,
        uri: String,
        title: String,
        symbol: String,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        require!(event.issued_nfts < event.capacity, ErrorCode::SoldOut);

        // 1) Mint
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint:      ctx.accounts.nft_mint.to_account_info(),
                    to:        ctx.accounts.nft_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            1,
        )?;

        // 2) Metadata
        let data = DataV2 {
            name: title.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata:         ctx.accounts.metadata.to_account_info(),
                    mint:             ctx.accounts.nft_mint.to_account_info(),
                    mint_authority:   ctx.accounts.payer.to_account_info(),
                    payer:            ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.payer.to_account_info(),
                    system_program:   ctx.accounts.system_program.to_account_info(),
                    rent:             ctx.accounts.rent.to_account_info(),
                },
            ),
            data,
            true, // is_mutable
            false, // collection_details_is_mutable
            None, // collection_details
        )?;

        // 3) Master Edition
        create_master_edition_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition:          ctx.accounts.master_edition.to_account_info(),
                    mint:             ctx.accounts.nft_mint.to_account_info(),
                    update_authority: ctx.accounts.payer.to_account_info(),
                    mint_authority:   ctx.accounts.payer.to_account_info(),
                    payer:            ctx.accounts.payer.to_account_info(),
                    metadata:         ctx.accounts.metadata.to_account_info(),
                    token_program:    ctx.accounts.token_program.to_account_info(),
                    system_program:   ctx.accounts.system_program.to_account_info(),
                    rent:             ctx.accounts.rent.to_account_info(),
                },
            ),
            Some(0),
        )?;

        // 4) Lock - Using the LockBuilder with the current API
        // Fix the temporary value dropped while borrowed error by chaining all calls
        let lock_ix = LockBuilder::new()
            .payer(ctx.accounts.payer.key())
            .authority(ctx.accounts.payer.key())
            .token(ctx.accounts.nft_account.key())
            .mint(ctx.accounts.nft_mint.key())
            .metadata(ctx.accounts.metadata.key())
            .edition(Some(ctx.accounts.master_edition.key()))
            .spl_token_program(Some(token::ID))
            .system_program(system_program::ID)
            .sysvar_instructions(SYSVAR_INSTRUCTIONS_ID)
            .instruction();

        // Invoke the instruction
        invoke_signed(
            &lock_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.nft_account.to_account_info(),
                ctx.accounts.nft_mint.to_account_info(),
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.master_edition.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.sysvar_instructions.to_account_info(),
            ],
            &[],
        )?;

        // 5) Record
        let ticket = &mut ctx.accounts.ticket;
        ticket.event       = event.key();
        ticket.owner       = ctx.accounts.payer.key();
        ticket.nft_mint    = ctx.accounts.nft_mint.key();
        ticket.nft_account = ctx.accounts.nft_account.key();
        ticket.checked_in  = false;
        ticket.bump        = ctx.bumps.ticket;
        event.issued_nfts += 1;

        Ok(())
    }

    pub fn assign_entrypoint(
        ctx: Context<AssignEntrypoint>,
        entrypoint_id: String,
        authority: Pubkey,
    ) -> Result<()> {
        let gate = &mut ctx.accounts.gate;
        gate.event         = ctx.accounts.event.key();
        gate.entrypoint_id = entrypoint_id;
        gate.authority     = authority;
        gate.bump          = ctx.bumps.gate;
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let event = &ctx.accounts.event;
        let seeds = &[
            b"event".as_ref(),
            event.name.as_bytes(),
            &event.date.to_le_bytes(),
            &[event.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Use the imported thaw_account function from anchor_spl::token
        token::thaw_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                ThawAccount {
                    account:   ctx.accounts.nft_account.to_account_info(),
                    mint:      ctx.accounts.nft_mint.to_account_info(),
                    authority: ctx.accounts.event.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // Use the imported burn function from anchor_spl::token
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint:      ctx.accounts.nft_mint.to_account_info(),
                    from:      ctx.accounts.nft_account.to_account_info(),
                    authority: ctx.accounts.event.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        let log = &mut ctx.accounts.checkin;
        log.ticket    = ctx.accounts.ticket.key();
        log.owner     = ctx.accounts.ticket.owner;
        log.timestamp = ctx.accounts.clock.unix_timestamp;
        log.bump      = ctx.bumps.checkin;
        ctx.accounts.ticket.checked_in = true;
        Ok(())
    }
}

// ───── State ─

#[account]
pub struct Event {
    pub creator:     Pubkey,
    pub name:        String,
    pub date:        i64,
    pub bump:        u8,
    pub capacity:    u32,
    pub issued_nfts: u32,
}

#[account]
pub struct Ticket {
    pub event:       Pubkey,
    pub owner:       Pubkey,
    pub nft_mint:    Pubkey,
    pub nft_account: Pubkey,
    pub checked_in:  bool,
    pub bump:        u8,
}

#[account]
pub struct GateAuthority {
    pub event:         Pubkey,
    pub entrypoint_id: String,
    pub authority:     Pubkey,
    pub bump:          u8,
}

#[account]
pub struct CheckInData {
    pub ticket:    Pubkey,
    pub owner:     Pubkey,
    pub timestamp: i64,
    pub bump:      u8,
}

#[account]
pub struct WalletCounter {
    pub event:  Pubkey,
    pub wallet: Pubkey,
    pub count:  u8,
    pub bump:   u8,
}

// ───── Contexts ─

#[derive(Accounts)]
#[instruction(name: String, date: i64, capacity: u32)]
pub struct InitEvent<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + (4 + name.len()) + 8 + 1 + 4 + 4,
        seeds = [b"event", name.as_bytes(), &date.to_le_bytes()],
        bump
    )]
    pub event: Account<'info, Event>,
    #[account(mut)] pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(uri: String, title: String, symbol: String)]
pub struct MintNftTicket<'info> {
    #[account(mut)] pub payer: Signer<'info>,

    #[account(mut, seeds = [b"event", event.name.as_bytes(), &event.date.to_le_bytes()], bump)]
    pub event: Account<'info, Event>,

    #[account(init, payer = payer, mint::decimals = 0, mint::authority = payer, mint::freeze_authority = payer)]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(init, payer = payer, associated_token::mint = nft_mint, associated_token::authority = payer)]
    pub nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is the metadata account that will be created
    #[account(mut)] pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: This is the master edition account that will be created
    #[account(mut)] pub master_edition: UncheckedAccount<'info>,

    #[account(init, payer = payer,
        space = 8 + 32 + 32 + 32 + 32 + 1 + 1,
        seeds = [b"ticket", event.key().as_ref(), nft_mint.key().as_ref()],
        bump)]
    pub ticket: Account<'info, Ticket>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: This is the token metadata program
    #[account(address = Metadata::id())]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: This is the instructions sysvar
    #[account(address = SYSVAR_INSTRUCTIONS_ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(entrypoint_id: String)]
pub struct AssignEntrypoint<'info> {
    #[account(mut, address = event.creator)] pub creator: Signer<'info>,

    #[account(
        init_if_needed, payer = creator,
        space = 8 + 32 + (4 + entrypoint_id.len()) + 32 + 1,
        seeds = [b"entrypoint", event.key().as_ref(), entrypoint_id.as_bytes()],
        bump
    )]
    pub gate: Account<'info, GateAuthority>,

    #[account(mut)] pub event: Account<'info, Event>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)] pub event: Account<'info, Event>,

    #[account(
        seeds = [b"entrypoint", event.key().as_ref(), gate.entrypoint_id.as_bytes()],
        bump = gate.bump
    )]
    pub gate: Account<'info, GateAuthority>,

    #[account(mut, address = gate.authority)]
    pub gate_agent: Signer<'info>,

    #[account(mut)] pub nft_mint: Account<'info, Mint>,
    #[account(mut)] pub nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"ticket", event.key().as_ref(), nft_mint.key().as_ref()],
        bump = ticket.bump,
        constraint = ticket.event == event.key() @ ErrorCode::InvalidTicket
    )]
    pub ticket: Account<'info, Ticket>,

    #[account(
        init, payer = gate_agent,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"checkin", ticket.key().as_ref(), &clock.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub checkin: Account<'info, CheckInData>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(qty: u8)]
pub struct MintBatch<'info> {
    #[account(mut)] pub owner: Signer<'info>,
    #[account(mut)] pub event: Account<'info, Event>,

    #[account(
        init_if_needed, payer = owner,
        space = 8 + 32 + 32 + 1 + 1,
        seeds = [b"counter", event.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, WalletCounter>,

    #[account(mut)] pub ticket: Account<'info, Ticket>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Event sold out")]            SoldOut,
    #[msg("Ticket invalid for this event")] InvalidTicket,
    #[msg("Entrypoint unauthorized")]   UnauthorizedEntrypoint,
}