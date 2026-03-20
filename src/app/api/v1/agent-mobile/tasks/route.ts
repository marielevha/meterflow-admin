import { NextResponse } from 'next/server';
import { getCurrentAgentMobileUser } from '@/lib/auth/agentMobileSession';
import { listAgentMobileTasks } from '@/lib/agentMobile/tasks';

export async function GET(request: Request) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const result = await listAgentMobileTasks(
    { id: auth.user.id, role: auth.user.role },
    {
      filter: searchParams.get('filter'),
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}
