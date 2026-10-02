import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'trustlayer-client'
    },
    error: null
  });
}
