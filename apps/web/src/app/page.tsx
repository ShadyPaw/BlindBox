import { Home } from '../components/home';
import { loadCatalog } from '../lib/catalog-server';
export default async function Page() {
  return <Home boxes={(await loadCatalog()).boxes} />;
}
