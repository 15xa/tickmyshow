import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { SystemProgram, PublicKey, Keypair } from "@solana/web3.js";

describe("tickmyshow", () => {
  // 1) Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // 2) Load program - using workspace directly with ts-ignore
  // @ts-ignore
  const program = anchor.workspace.Tickmyshow;
  
  console.log("Program ID:", program.programId.toString());

  // keypairs
  const creator = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // event params
  const name = "Solana Summer Fest";
  const date = Math.floor(Date.now() / 1000) + 3600;
  const cap = 1;

  // PDA helpers
  const getEventPda = () =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("event"), creator.publicKey.toBuffer(), Buffer.from(name)],
      program.programId
    );

  const getTicketPda = (ev, owner) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), ev.toBuffer(), owner.toBuffer()],
      program.programId
    );

  const getCheckinPda = (tk, ts) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("checkin"), tk.toBuffer(), Buffer.from(ts.toString())],
      program.programId
    );

  // airdrop helper
  const airdrop = async (kp) => {
    const signature = await provider.connection.requestAirdrop(kp.publicKey, 1e9);
    console.log(`Airdrop to ${kp.publicKey.toString().slice(0, 8)}... requested: ${signature}`);
    
    // Wait for confirmation
    await provider.connection.confirmTransaction(signature, "confirmed");
    console.log(`Airdrop to ${kp.publicKey.toString().slice(0, 8)}... confirmed`);
  };

  before(async () => {
    console.log("Starting airdrops...");
    // Airdrop one at a time to avoid rate limiting
    await airdrop(creator);
    await airdrop(user1);
    await airdrop(user2);
    console.log("All airdrops completed");
  });

  it("initializes event", async () => {
    console.log("Creating event:", name);
    const [evPda, evBump] = getEventPda();
    console.log("Event PDA:", evPda.toString());

    const tx = await program.methods
      .initEvent(name, new anchor.BN(date), cap)
      .accounts({
        event: evPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();
    
    console.log("Event created with tx:", tx);

    // @ts-ignore
    const ev = await program.account.event.fetch(evPda);
    console.log("Event data:", {
      // @ts-ignore
      creator: ev.creator.toString(),
      // @ts-ignore
      name: ev.name,
      // @ts-ignore
      date: ev.date.toString(),
      // @ts-ignore
      capacity: ev.capacity,
      // @ts-ignore
      issued: ev.issued,
    });
    
    // @ts-ignore
    assert.ok(ev.creator.equals(creator.publicKey));
    // @ts-ignore
    assert.strictEqual(ev.name, name);
    // @ts-ignore
    assert.ok(ev.date.eq(new anchor.BN(date)));
    // @ts-ignore
    assert.strictEqual(ev.capacity, cap);
    // @ts-ignore
    assert.strictEqual(ev.issued, 0);
    // @ts-ignore
    assert.strictEqual(ev.bump, evBump);
  });

  it("mints a ticket", async () => {
    console.log("Minting ticket for user1");
    const [evPda] = getEventPda();
    const [tkPda, tkB] = getTicketPda(evPda, user1.publicKey);
    console.log("Ticket PDA:", tkPda.toString());

    const tx = await program.methods
      .mintTicket()
      .accounts({
        ticket: tkPda,
        owner: user1.publicKey,
        event: evPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();
    
    console.log("Ticket minted with tx:", tx);

    // @ts-ignore
    const tk = await program.account.ticket.fetch(tkPda);
    // @ts-ignore
    const ev = await program.account.event.fetch(evPda);
    
    console.log("Ticket data:", {
      // @ts-ignore
      event: tk.event.toString(),
      // @ts-ignore
      owner: tk.owner.toString(),
    });
    
    console.log("Updated event data:", {
      // @ts-ignore
      issued: ev.issued,
    });
    
    // @ts-ignore
    assert.ok(tk.event.equals(evPda));
    // @ts-ignore
    assert.ok(tk.owner.equals(user1.publicKey));
    // @ts-ignore
    assert.strictEqual(tk.bump, tkB);
    // @ts-ignore
    assert.strictEqual(ev.issued, 1);
  });

  it("fails when sold out", async () => {
    console.log("Attempting to mint ticket for user2 (should fail - sold out)");
    const [evPda] = getEventPda();
    const [tk2Pda] = getTicketPda(evPda, user2.publicKey);
    console.log("Ticket2 PDA:", tk2Pda.toString());

    try {
      const tx = await program.methods
        .mintTicket()
        .accounts({
          ticket: tk2Pda,
          owner: user2.publicKey,
          event: evPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();
      
      console.log("Unexpected success:", tx);
      assert.fail("Expected SoldOut error");
    } catch (err) {
      console.log("Got expected error:", err.toString().slice(0, 100) + "...");
      assert.include(err.toString(), "SoldOut");
    }

    // @ts-ignore
    const ev = await program.account.event.fetch(evPda);
    // @ts-ignore
    console.log("Event issued count still:", ev.issued);
    // @ts-ignore
    assert.strictEqual(ev.issued, 1);
  });

  it("checks in a ticket", async () => {
    console.log("Checking in ticket for user1");
    const [evPda] = getEventPda();
    const [tkPda] = getTicketPda(evPda, user1.publicKey);

    const ts = Math.floor(Date.now() / 1000);
    const [ciPda, ciB] = getCheckinPda(tkPda, ts);
    console.log("CheckIn PDA:", ciPda.toString());
    console.log("Current timestamp:", ts);

    const tx = await program.methods
      .checkIn()
      .accounts({
        checkin: ciPda,
        owner: user1.publicKey,
        ticket: tkPda,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();
    
    console.log("Check-in completed with tx:", tx);

    // @ts-ignore
    const ci = await program.account.checkInData.fetch(ciPda);
    console.log("CheckIn data:", {
      // @ts-ignore
      ticket: ci.ticket.toString(),
      // @ts-ignore
      owner: ci.owner.toString(),
      // @ts-ignore
      timestamp: ci.timestamp.toString(),
    });
    
    // @ts-ignore
    assert.ok(ci.ticket.equals(tkPda));
    // @ts-ignore
    assert.ok(ci.owner.equals(user1.publicKey));
    // @ts-ignore
    assert.strictEqual(ci.bump, ciB);
    // @ts-ignore
    assert.ok(ci.timestamp.toNumber() <= ts + 10);
    
    console.log("✅ All tests passed successfully!");
  });
});