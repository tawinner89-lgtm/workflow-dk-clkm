export const dynamic = 'force-dynamic';
export const metadata = { title: 'DK CLIM - Administration' };
import InterventionsClient from './InterventionsClient';
import RecentStockAdditions from '@/components/RecentStockAdditions';

export default function AdminPage() {
  return <><RecentStockAdditions /><InterventionsClient /></>;
}


