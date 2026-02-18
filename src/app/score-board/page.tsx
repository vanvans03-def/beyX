"use client";

import Scoreboard from "@/components/Scoreboard";
import { useRouter } from "next/navigation";

export default function ScoreboardPage() {
    const router = useRouter();
    return <Scoreboard onBack={() => router.push('/')} />;
}
