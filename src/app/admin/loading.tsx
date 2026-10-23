/** Route-local loading state: never cover the public navigation with a fixed overlay. */
export default function AdminLoading() {
    return <main aria-busy="true" aria-label="Loading dashboard" className="min-h-svh bg-background p-4 text-foreground sm:p-8">
        <div className="mx-auto max-w-5xl space-y-5" role="status">
            <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล / Loading dashboard…</p>
            <div aria-hidden="true" className="h-8 w-52 animate-pulse rounded-lg bg-white/10" />
            <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(index => <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
        </div>
    </main>;
}
