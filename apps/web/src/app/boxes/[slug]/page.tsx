import { notFound } from 'next/navigation';
import { boxes } from '../../../data/catalog';
import { DetailView } from '../../../components/detail-view';
export function generateStaticParams() {
  return boxes.map((box) => ({ slug: box.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `${boxes.find((box) => box.slug === slug)?.name ?? '盲盒'} · TURBOX`,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const box = boxes.find((box) => box.slug === slug);
  if (!box) notFound();
  return <DetailView box={box} />;
}
