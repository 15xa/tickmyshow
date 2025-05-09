use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, mint_to};
use mpl_token_metadata::instruction::{create_metadata_accounts_v2};
use mpl_token_metadata::state::DataV2;

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

    pub fn mint_nft_ticket(
        ctx: Context<MintNftTicket>,
        uri: String,            
        title: String,          
        symbol: String,         
    ) -> Result<()> {
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.nft_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            1,
        )?;


        let metadata_seeds = &[
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            ctx.accounts.nft_mint.key().as_ref(),
        ];
        let (metadata_pda, _bump) =
            Pubkey::find_program_address(metadata_seeds, &mpl_token_metadata::ID);

        let data = DataV2 {
            name: title,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        invoke(
            &create_metadata_accounts_v2(
                mpl_token_metadata::ID,
                metadata_pda,
                ctx.accounts.nft_mint.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.payer.key(),
                data,
                true,
                false,
                None,
                None,
            ),
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.nft_mint.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;

        Ok(())
    }





    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let c = &mut ctx.accounts.checkin;
        c.ticket    = ctx.accounts.ticket.key();
        c.owner     = ctx.accounts.ticket.owner;
        c.timestamp = ctx.accounts.clock.unix_timestamp;
        c.bump      = ctx.bumps.checkin;

        let cpi_accounts = Burn {
            mint: ctx.accounts.nft_mint.to_account_info(),
            from: ctx.accounts.nft_account.to_account_info(),
            authority: ctx.accounts.gate_agent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::burn(cpi_ctx, 1)?;
        Ok(())
    }
       


        pub fn assign_entrypoint(
            ctx: Context<AssignEntrypoint>,
            entrypoint_id: String,
            authority: Pubkey
        ) -> Result<()> {
            let gate = &mut ctx.accounts.gate;
            gate.event = ctx.accounts.event.key();
            gate.entrypoint_id = entrypoint_id;
            gate.authority = authority;
            gate.bump = *ctx.bumps.get("gate").unwrap();
            Ok(());
        }



        pub fn mint_batch(ctx: Context<MintBatch>, qty: u8) -> Result<()> {
            let ev = &mut ctx.accounts.event;
            let ctr = &mut ctx.accounts.counter;
        
            require!(
                ev.issued + (qty as u32) <= ev.capacity,
                ErrorCode::SoldOut
            );
        
            // enforce per-wallet limit of 5
            require!(
                ctr.count + qty <= 5,
                ErrorCode::PerWalletLimit
            );
        
            for _ in 0..qty {
                ev.issued += 1;
                ctr.count += 1;
        
                let ticket = &mut ctx.accounts.tickets[ctr.count as usize - 1];
                ticket.event = ev.key();
                ticket.owner = ctx.accounts.owner.key();
                ticket.bump  = *ctx.bumps.get("tickets").unwrap(); 
            }
        
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
#[instruction(uri: String, title: String, symbol: String)]
pub struct MintNftTicket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer,
        mint::freeze_authority = payer,  
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = nft_mint,
        token::authority = payer,
    )]
    pub nft_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}






#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,

    #[account(
        seeds = [b"entrypoint", event.key().as_ref(), gate.entrypoint_id.as_bytes()],
        bump = gate.bump,
    )]
    pub gate: Account<'info, GateAuthority>,

    #[account(address = gate.authority)]
    pub gate_agent: Signer<'info>,

    #[account(
        init,
        seeds = [b"checkin", ticket.key().as_ref(), &clock.unix_timestamp.to_le_bytes()],
        bump,
        payer = gate_agent,
        space = 8 + std::mem::size_of::<CheckInData>(),
    )]
    pub checkin: Account<'info, CheckInData>,

    #[account(
        constraint = ticket.event == event.key() @ ErrorCode::InvalidTicket
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,
    #[account(mut)]
    pub nft_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}



#[account]
pub struct GateAuthority {
    pub event: Pubkey,  
    pub entrypoint_id: String, 
    pub authority: Pubkey,  
    pub bump: u8,
}


pub struct WalletCounter {
    pub event: Pubkey,
    pub wallet: Pubkey,
    pub count:   u8,    //5-limit //ad to enforce
    pub bump:    u8,
}

#[derive(Accounts)]
#[instruction(entrypoint_id: String)]
pub struct AssignEntrypoint<'info> {
    #[account(mut, address = event.creator)]
    pub creator: Signer<'info>,

    #[account(
        init_if_needed,
        seeds = [b"entrypoint", event.key().as_ref(), entrypoint_id.as_bytes()],
        bump,
        payer = creator,
        space = 8 + 32 + 4 + entrypoint_id.len() + 32 + 1,
    )]
    pub gate: Account<'info, GateAuthority>,

    #[account(mut)]
    pub event: Account<'info, Event>,

    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
#[instruction(qty: u8)]
pub struct MintBatch<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub event: Account<'info, Event>,

    #[account(
        init_if_needed,
        seeds = [b"counter", event.key().as_ref(), owner.key().as_ref()],
        bump,
        payer = owner,
        space = 8 + 32 + 32 + 1 + 1,
    )]
    pub counter: Account<'info, WalletCounter>,

    #[account(
      init,
      seeds = [b"ticket", event.key().as_ref(), owner.key().as_ref(), &[counter.count + i]],
      bump,
      payer = owner,
      space = 8 + 32 + 32 + 1,
    )]
    pub tickets: Vec<Account<'info, Ticket>>,

    pub system_program: Program<'info, System>,
}


#[error_code]
pub enum ErrorCode {
    #[msg("Event is sold out.")]
    SoldOut,
    #[msg("Ticket does not belong to this event.")] InvalidTicket,
    #[msg("Entrypoint is not authorized.")] UnauthorizedEntrypoint,
    #[msg("Cannot mint more than 5 tickets per wallet.")]
    PerWalletLimit,
}
