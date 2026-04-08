import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useMe } from '@/features/user/hooks/useMe';

export function Layout() {
  useMe(); // bootstraps wallet balance on sign-in
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
