"use client";

import RegistrationFormU10 from "./registration/RegistrationFormU10";
import RegistrationFormNMM from "./registration/RegistrationFormNMM";
import RegistrationFormOpen from "./registration/RegistrationFormOpen"; // Acts as Standard/Open
import { Loader2 } from "lucide-react";

export default function RegistrationForm(props: {
    tournamentId: string,
    tournamentName?: string,
    tournamentStatus?: string,
    tournamentType?: string,
    banList?: string[],
    challongeUrl?: string
}) {
    if (!props.tournamentType) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (props.tournamentType === 'U10') {
        return <RegistrationFormU10 {...props} />;
    }

    if (props.tournamentType === 'NoMoreMeta') {
        return <RegistrationFormNMM {...props} />;
    }

    // Default to Open for 'Open', 'Standard', or any other type
    return <RegistrationFormOpen {...props} />;
}
