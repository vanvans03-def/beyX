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

export default function RegistrationFormU10({
    tournamentId,
    tournamentName,
    tournamentStatus,
    banList,
    challongeUrl
}: Props) {
    const hook = useRegistration({
        tournamentId,
        tournamentType: "U10", // Hardcoded
        banList,
        tournamentStatus,
        challongeUrl
    });

    return (
        <RegistrationView
            hook={hook}
            tournamentType="U10"
            tournamentStatus={tournamentStatus}
            challongeUrl={challongeUrl}
            banList={banList}
        />
    );
}
