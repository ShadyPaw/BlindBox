import { notFound } from 'next/navigation';
import { coinBoxes } from '../../../data/catalog';
import { DetailView } from '../../../components/detail-view';

export function generateStaticParams() {
  return coinBoxes.map((box) => ({ slug: box.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `${coinBoxes.find((box) => box.slug === slug)?.name ?? '免費盲盒'} · TURBOX`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const box = coinBoxes.find((box) => box.slug === slug);
  if (!box) notFound();
  return <DetailView box={box} />;
}
