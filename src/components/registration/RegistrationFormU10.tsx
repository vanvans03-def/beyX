"use client";

import { useRegistration } from "./useRegistration";
import { RegistrationView } from "./RegistrationView";

type Props = {
    tournamentId: string;
    tournamentName?: string;
    tournamentStatus?: string;
    tournamentType?: string;
    banList?: string[];
    challongeUrl?: string;
};

export default function RegistrationFormU10({
    tournamentId,
    tournamentName,
    tournamentStatus,
    tournamentType,
    banList,
    challongeUrl
}: Props) {
    const hook = useRegistration({
        tournamentId,
        tournamentType: (tournamentType as "U10" | "U10South") || "U10",
        banList,
        tournamentStatus,
        challongeUrl
    });

    return (
        <RegistrationView
            hook={hook}
            tournamentType={tournamentType || "U10"}
            tournamentStatus={tournamentStatus}
            challongeUrl={challongeUrl}
            banList={banList}
        />
    );
}
