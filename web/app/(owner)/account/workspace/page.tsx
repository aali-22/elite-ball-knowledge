import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ownerAccess, ownerManifest } from '@/lib/server/owner';
import { OwnerWorkspace } from '@/components/owner/OwnerWorkspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your workspace', referrer: 'no-referrer', description: 'Your account workspace.', robots: { index: false, follow: false, noarchive: true }, openGraph: { title: 'Your workspace', description: 'Your account workspace.' } };
export default async function Page() {
  const h = await headers();
  if (!(await ownerAccess(h))) notFound();
  return <OwnerWorkspace manifest={await ownerManifest(h)} />;
}
