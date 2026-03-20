import { NextResponse } from 'next/server';

import { getCurrentAgentMobileUser } from '@/lib/auth/agentMobileSession';
import { submitAgentMobileTaskResult } from '@/lib/agentMobile/tasks';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await submitAgentMobileTaskResult(
    { id: auth.user.id, role: auth.user.role },
    id,
    payload as Record<string, unknown>
  );

  return NextResponse.json(result.body, { status: result.status });
}
