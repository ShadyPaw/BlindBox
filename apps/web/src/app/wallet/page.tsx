import { WalletView } from '../../components/wallet-view';
import './wallet.css';

export const metadata = { title: '錢包預覽 · TURBOX' };

// Public prototype with fictional data. Real balances will require server-side authentication.
export default function Page() {
  return <WalletView />;
}
