export function assignCompetitionRanks<T extends object>(
    rows: T[],
    isTied: (current: T, previous: T) => boolean,
): Array<T & { rank: number }> {
    let previous: T | undefined;
    let previousRank = 0;

    return rows.map((row, index) => {
        const rank = previous && isTied(row, previous) ? previousRank : index + 1;
        previous = row;
        previousRank = rank;
        return { ...row, rank };
    });
}
