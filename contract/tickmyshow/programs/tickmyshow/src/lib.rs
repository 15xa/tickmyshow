use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, TokenAccount, MintTo, FreezeAccount, SetAuthority, ThawAccount, Burn, Token},
};
use mpl_token_metadata::ID as TOKEN_METADATA_PROGRAM_ID; // if you ever need it

declare_id!("5FFwn1xD4ae3kttPDNoHmnW2x2tfekLQXUbRiaj6mBeG");

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

 
    pub fn mint_and_freeze(ctx: Context<MintAndFreeze>) -> Result<()> {
        let event = &ctx.accounts.event;

        // 1) Mint to the buyer's ATA
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

        // 2) Transfer freeze_authority from payer -> event PDA
        token::set_authority(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.payer.to_account_info(),
                    account_or_mint:   ctx.accounts.nft_mint.to_account_info(),
                },
            ),
            token::spl_token::instruction::AuthorityType::FreezeAccount,
            Some(event.key()),
        )?;

        // 3) Freeze the buyer's ATA, signed by the Event PDA
        let seeds       = &[
            b"event".as_ref(),
            event.name.as_bytes(),
            &event.date.to_le_bytes(),
            &[event.bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

        token::freeze_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                FreezeAccount {
                    account:   ctx.accounts.nft_account.to_account_info(),
                    mint:      ctx.accounts.nft_mint.to_account_info(),
                    authority: ctx.accounts.event.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        Ok(())
    }

   
}

// ───── Account State ─────

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
pub struct WalletCounter {
    pub event:  Pubkey,
    pub wallet: Pubkey,
    pub count:  u8,
    pub bump:   u8,
}

// ───── Contexts ─────

#[derive(Accounts)]
#[instruction(name: String, date: i64, capacity: u32)]
pub struct InitEvent<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + (4 + name.len()) + 8 + 1 + 4 + 4,
        seeds = [b"event", name.as_bytes(), &date.to_le_bytes()],
        bump
    )]
    pub event:           Account<'info, Event>,
    #[account(mut)] pub creator: Signer<'info>,
    pub system_program:  Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintAndFreeze<'info> {
    #[account(mut)] pub payer:  Signer<'info>,
    #[account(
        mut,
        seeds = [b"event", event.name.as_bytes(), &event.date.to_le_bytes()],
        bump = event.bump,
    )]
    pub event:                 Account<'info, Event>,
    #[account(
        init, payer = payer,
        mint::decimals = 0,
        mint::authority = payer,
        mint::freeze_authority = payer,
    )]
    pub nft_mint:             Account<'info, Mint>,
    #[account(
        init, payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = payer,
    )]
    pub nft_account:          Account<'info, TokenAccount>,
    pub token_program:        Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:       Program<'info, System>,
    pub rent:                 Sysvar<'info, Rent>,
}
