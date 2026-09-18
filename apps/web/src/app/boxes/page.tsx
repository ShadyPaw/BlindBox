import { CatalogView } from '../../components/catalog-view';
import { loadCatalog } from '../../lib/catalog-server';
export default async function Page() {
  return <CatalogView initial={await loadCatalog()} />;
}
