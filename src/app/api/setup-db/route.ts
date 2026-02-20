import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    success: false,
    message: "Please run the SQL commands in your Supabase Dashboard SQL Editor manually. See implementation_plan.md."
  });
}
