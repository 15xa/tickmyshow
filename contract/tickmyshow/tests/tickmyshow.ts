import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Tickmyshow } from "../target/types/tickmyshow";
import { assert } from "chai";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

describe("tickmyshow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Tickmyshow as Program<Tickmyshow>;

  // PDAs and bumps
  let eventPda: PublicKey, eventBump: number;
  let ticketPda: PublicKey, ticketBump: number;
  let entryPda: PublicKey, entryBump: number;
  let checkinPda: PublicKey, checkinBump: number;

  // Common parameters
  const name = "My Concert";
  const date = Math.floor(Date.now() / 1000) + 3600; // 1h from now
  const capacity = 2;

  // Will hold the NFT mint and ATA across tests
  let nftMint: PublicKey;
  let buyerAta: PublicKey;

  it("initializes an event", async () => {
    // Derive event PDA
    [eventPda, eventBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("event"),
        Buffer.from(name),
        Buffer.from(new anchor.BN(date).toArray("le", 8)),
      ],
      program.programId
    );

    // Call init_event
    await program.methods
      .initEvent(name, new anchor.BN(date), capacity)
      .accounts({
        event: eventPda,
        creator: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch and assert
    const eventAcc = await program.account.event.fetch(eventPda);
    assert.equal(eventAcc.creator.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(eventAcc.name, name);
    assert.equal(eventAcc.date.toNumber(), date);
    assert.equal(eventAcc.capacity, capacity);
    assert.equal(eventAcc.issuedNfts, 0);
    assert.equal(eventAcc.bump, eventBump);
  });

  it("mints an NFT ticket", async () => {
    // 1) Create a new mint
    nftMint = await createMint(
      provider.connection,
      provider.wallet,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      0
    );

    // 2) Create buyer ATA
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet,
      nftMint,
      provider.wallet.publicKey
    );
    buyerAta = ata.address;

    // 3) Generate dummy metadata + master edition PDAs
    const metadata = Keypair.generate().publicKey;
    const masterEdition = Keypair.generate().publicKey;

    // 4) Derive ticket PDA
    [ticketPda, ticketBump] = await PublicKey.findProgramAddress(
      [Buffer.from("ticket"), eventPda.toBuffer(), nftMint.toBuffer()],
      program.programId
    );

    // 5) Call mint_nft_ticket
    await program.methods
      .mintNftTicket("https://uri.test", "ConcertTicket", "CTS")
      .accounts({
        payer: provider.wallet.publicKey,
        event: eventPda,
        nftMint,
        nftAccount: buyerAta,
        metadata,
        masterEdition,
        ticket: ticketPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: program.programId, // local tests use programId
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // 6) Fetch and assert ticket
    const ticketAcc = await program.account.ticket.fetch(ticketPda);
    assert.equal(ticketAcc.event.toBase58(), eventPda.toBase58());
    assert.equal(ticketAcc.owner.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(ticketAcc.nftMint.toBase58(), nftMint.toBase58());
    assert.equal(ticketAcc.nftAccount.toBase58(), buyerAta.toBase58());
    assert.isFalse(ticketAcc.checkedIn);
    assert.equal(ticketAcc.bump, ticketBump);

    // 7) Ensure event.issued_nfts == 1
    const evt = await program.account.event.fetch(eventPda);
    assert.equal(evt.issuedNfts, 1);
  });

  it("prevents minting past capacity", async () => {
  
    const nft2 = await createMint(
      provider.connection,
      provider.wallet,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      0
    );
    const ata2 = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet,
      nft2,
      provider.wallet.publicKey
    )).address;
    const meta2 = Keypair.generate().publicKey;
    const me2 = Keypair.generate().publicKey;
    const [tick2, b2] = await PublicKey.findProgramAddress(
      [Buffer.from("ticket"), eventPda.toBuffer(), nft2.toBuffer()],
      program.programId
    );

    await program.methods
      .mintNftTicket("uri2", "T2", "T2")
      .accounts({
        payer: provider.wallet.publicKey,
        event: eventPda,
        nftMint: nft2,
        nftAccount: ata2,
        metadata: meta2,
        masterEdition: me2,
        ticket: tick2,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: program.programId,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Third mint should fail SoldOut
    try {
      const nft3 = await createMint(
        provider.connection,
        provider.wallet,
        provider.wallet.publicKey,
        provider.wallet.publicKey,
        0
      );
      const ata3 = (await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet,
        nft3,
        provider.wallet.publicKey
      )).address;
      const meta3 = Keypair.generate().publicKey;
      const me3 = Keypair.generate().publicKey;
      const [tick3] = await PublicKey.findProgramAddress(
        [Buffer.from("ticket"), eventPda.toBuffer(), nft3.toBuffer()],
        program.programId
      );
      await program.methods
        .mintNftTicket("uri3", "T3", "T3")
        .accounts({
          payer: provider.wallet.publicKey,
          event: eventPda,
          nftMint: nft3,
          nftAccount: ata3,
          metadata: meta3,
          masterEdition: me3,
          ticket: tick3,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: program.programId,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Expected SoldOut error");
    } catch (err: any) {
      assert.include(err.error.errorMessage, "SoldOut");
    }
  });

  it("assigns an entrypoint and checks in", async () => {
    // 1) Derive gate PDA
    const entryId = "gate1";
    [entryPda, entryBump] = await PublicKey.findProgramAddress(
      [Buffer.from("entrypoint"), eventPda.toBuffer(), Buffer.from(entryId)],
      program.programId
    );

    // 2) assign_entrypoint
    await program.methods
      .assignEntrypoint(entryId, provider.wallet.publicKey)
      .accounts({
        creator: provider.wallet.publicKey,
        event: eventPda,
        gate: entryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 3) Derive checkin PDA (use a fixed timestamp to match seeds)
    const ts = Math.floor(Date.now() / 1000);
    [checkinPda, checkinBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("checkin"),
        ticketPda.toBuffer(),
        Buffer.from(new anchor.BN(ts).toArray("le", 8)),
      ],
      program.programId
    );

    // 4) check_in
    await program.methods
      .checkIn()
      .accounts({
        event: eventPda,
        gate: entryPda,
        gateAgent: provider.wallet.publicKey,
        nftMint,
        nftAccount: buyerAta,
        ticket: ticketPda,
        checkin: checkinPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 5) Fetch and assert check‑in log
    const ci = await program.account.checkInData.fetch(checkinPda);
    assert.equal(ci.ticket.toBase58(), ticketPda.toBase58());
    assert.equal(ci.owner.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(ci.bump, checkinBump);

    // 6) Ticket must now be marked checked_in = true
    const ticketAfter = await program.account.ticket.fetch(ticketPda);
    assert.isTrue(ticketAfter.checkedIn);
  });
});
