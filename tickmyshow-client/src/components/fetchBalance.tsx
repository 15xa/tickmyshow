'use client';

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export const FetchWallet = () => {
    const [balance, setBalance] = useState<number | null>(null);
    const { connection } = useConnection();   
    const { publicKey } = useWallet();        

    const wallBalance = async () => {
        if (publicKey) {
            const lamports = await connection.getBalance(publicKey);
            setBalance(lamports / 1e9); 
        }
    };

    return (
        <>
            <button onClick={wallBalance}>Balance</button>
            {balance !== null && <div>Balance (SOL): {balance}</div>}
        </>
    );
};
