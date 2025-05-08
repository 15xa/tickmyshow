"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor"; 
import IDL from "../anchor/idl.json"; 
import { PROGRAM_ID, Tickmyshow } from "../anchor/setup"; 
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
    window.Buffer = Buffer;
}

interface CreatePopupProps {
    name: string;
    setName: (name: string) => void;
    date: string;
    setDate: (date: string) => void;
    capacity: number | string; 
    setCapacity: (capacity: number | string) => void;
    handleCreate: (event: React.FormEvent) => Promise<void>;
    isLoading: boolean; 
}

function CreatePopup({
    name,
    setName,
    date,
    setDate,
    capacity,
    setCapacity,
    handleCreate,
    isLoading
}: CreatePopupProps) {
    return (
        <div className="max-w-lg mx-auto mt-10 p-6 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Create New Event</h2>
            <form onSubmit={handleCreate} className="space-y-6">
                <div>
                    <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 mb-1">
                        Event Name
                    </label>
                    <input
                        id="eventName"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        placeholder="e.g., Summer Music Festival"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Event Date
                    </label>
                    <input
                        id="eventDate"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full mt-1 p-3 border text-black border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
                        Capacity
                    </label>
                    <input
                        id="capacity"
                        type="number"
                        min={1}
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        placeholder="e.g., 500 attendees"
                        required
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition ease-in-out duration-150 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? 'Creating Event...' : 'Create Event'}
                </button>
            </form>
        </div>
    );
}


export default function CreateEventPage() { 
    const [name, setName] = useState<string>("");
    const [date, setDate] = useState<string>("");
    const [capacity, setCapacity] = useState<number | string>(1); 
    const [isLoading, setIsLoading] = useState<boolean>(false);


    const { connection } = useConnection();
    const { publicKey, signTransaction, signAllTransactions, connected } = useWallet(); 
    const wallet = publicKey && signTransaction && signAllTransactions ? { publicKey, signTransaction, signAllTransactions } : null;

    const provider = wallet && connection
        ? new AnchorProvider(connection, wallet as any, { commitment: "confirmed" }) 
        : null;
    const program = provider
        ? new Program<Tickmyshow>(IDL as Tickmyshow,  provider) 
        : null;


    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);

        if (!program || !publicKey) {
            alert("Please connect your wallet first!");
            setIsLoading(false);
            return;
        }

        if (!name.trim()) {
            alert("Event name cannot be empty.");
            setIsLoading(false);
            return;
        }

        const numericCapacity = Number(capacity);
        if (isNaN(numericCapacity) || numericCapacity <= 0) {
            alert("Please enter a valid capacity.");
            setIsLoading(false);
            return;
        }

        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
             alert("Invalid date selected. Please select a valid date.");
             console.error("Invalid date string:", date);
             setIsLoading(false);
             return;
        }
        const today = new Date();
        today.setHours(0,0,0,0); 
        if (dateObj < today) {
            alert("Event date cannot be in the past.");
            setIsLoading(false);
            return;
        }


        const timestampInSeconds = Math.floor(dateObj.getTime() / 1000);

        //Convert to BN 
        const anchorTimestamp = new BN(timestampInSeconds);
        const anchorCapacity = new BN(numericCapacity);

        console.log("Event Name:", name);
        console.log("Timestamp (BN):", anchorTimestamp.toString());
        console.log("Capacity (BN):", anchorCapacity.toString());
        console.log("Creator PK:", publicKey.toBase58());


        try {
            const [eventPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("event"), publicKey.toBuffer(), Buffer.from(name)],
                PROGRAM_ID
            );

            console.log("Calculated Event PDA:", eventPDA.toBase58());

            const tx = await program.methods
                .initEvent(name, anchorTimestamp, anchorCapacity) 
                .accounts({
                    event: eventPDA,
                    creator: publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            console.log("Transaction signature", tx);
            alert(`Event created successfully!\nTransaction: ${tx}\nEvent PDA: ${eventPDA.toBase58()}`);

            setName("");
            setDate("");
            setCapacity(1);

        } catch (err: any) { 
            console.error("Error during event creation:", err);
            let errorMessage = "An unknown error occurred during event creation.";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            if (err.logs) {
                console.error("Solana Program Logs:", err.logs);
                errorMessage += `\nProgram Logs: ${err.logs.join("\n")}`;
            }
            alert("Error creating event: " + errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            {connected && wallet ? (
                <CreatePopup
                    name={name}
                    setName={setName}
                    date={date}
                    setDate={setDate}
                    capacity={capacity}
                    setCapacity={setCapacity}
                    handleCreate={handleCreate}
                    isLoading={isLoading}
                />
            ) : (
                <div className="text-center py-10">
                    <p className="text-xl text-gray-700">Please connect your wallet to create an event.</p>
                </div>
            )}
        </div>
    );
}