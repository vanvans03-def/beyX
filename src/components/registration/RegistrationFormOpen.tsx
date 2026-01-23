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

export default function RegistrationFormOpen({
    tournamentId,
    tournamentName,
    tournamentStatus,
    banList,
    challongeUrl
}: Props) {
    const hook = useRegistration({
        tournamentId,
        tournamentType: "Open", // Hardcoded to Open, but internal logic treats as Standard/Open
        banList,
        tournamentStatus,
        challongeUrl
    });

    return (
        <RegistrationView
            hook={hook}
            tournamentType="Open"
            tournamentStatus={tournamentStatus}
            challongeUrl={challongeUrl}
            banList={banList}
        />
    );
}
