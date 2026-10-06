import { WorkflowWorkspace } from '@/components/workflow-workspace';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <WorkflowWorkspace view="detail" assessmentId={id} />; }
