import { NextResponse } from 'next/server';
import { getCurrentAgentMobileUser } from '@/lib/auth/agentMobileSession';
import { getAgentMobileTaskDetail } from '@/lib/agentMobile/tasks';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  const result = await getAgentMobileTaskDetail({ id: auth.user.id, role: auth.user.role }, id);

  return NextResponse.json(result.body, { status: result.status });
}
