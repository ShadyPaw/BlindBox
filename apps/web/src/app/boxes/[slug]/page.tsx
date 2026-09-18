import { notFound } from 'next/navigation';
import { DetailView } from '../../../components/detail-view';
import { loadCatalogDetail } from '../../../lib/catalog-server';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { box } = await loadCatalogDetail((await params).slug);
  if (box.mode !== 'CONSUMER') notFound();
  return { title: `${box.name} · TURBOX` };
}
export default async function Page({ params }: Props) {
  const detail = await loadCatalogDetail((await params).slug);
  if (detail.box.mode !== 'CONSUMER') notFound();
  return <DetailView {...detail} />;
}
