import { notFound } from 'next/navigation';
import { DetailView } from '../../../components/detail-view';
import { loadCatalogDetail } from '../../../lib/catalog-server';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { box } = await loadCatalogDetail((await params).slug, 'COIN');
  if (box.mode !== 'COIN') notFound();
  return { title: `${box.name} · TURBOX` };
}
export default async function Page({ params }: Props) {
  const detail = await loadCatalogDetail((await params).slug, 'COIN');
  if (detail.box.mode !== 'COIN') notFound();
  return <DetailView {...detail} />;
}
