"use client";

import { useRegistration } from "./useRegistration";
import { RegistrationView } from "./RegistrationView";

type Props = {
    tournamentId: string;
    tournamentName?: string;
    tournamentStatus?: string;
    banList?: string[];
    challongeUrl?: string;
};

export default function RegistrationFormNMM({
    tournamentId,
    tournamentName,
    tournamentStatus,
    banList,
    challongeUrl
}: Props) {
    const hook = useRegistration({
        tournamentId,
        tournamentType: "NoMoreMeta", // Hardcoded
        banList,
        tournamentStatus,
        challongeUrl
    });

    return (
        <RegistrationView
            hook={hook}
            tournamentType="NoMoreMeta"
            tournamentStatus={tournamentStatus}
            challongeUrl={challongeUrl}
            banList={banList}
        />
    );
}
