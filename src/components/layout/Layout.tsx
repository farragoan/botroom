import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-50">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
