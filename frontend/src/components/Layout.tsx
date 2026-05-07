import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  ClipboardCheck, 
  LogOut,
  User,
  UserCircle,
  Menu,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isOfficer = user?.role === 'committee_member' || user?.role === 'approver' || user?.role === 'admin';
  const isBidder = user?.role === 'bidder';
  const portalName = isBidder ? 'Bidder Portal' : isOfficer ? 'Admin Portal' : 'Satyam Portal';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tenders', label: isBidder ? 'Find Tenders' : 'Tenders', icon: FileText },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    ...(isOfficer ? [
      { path: '/upload', label: 'Document Vault', icon: Upload },
      { path: '/admin/bid-reviews', label: 'Bid Reviews', icon: ClipboardCheck },
    ] : []),
    ...(isBidder ? [
      { path: '/bidder/profile', label: 'Profile', icon: UserCircle },
      { path: '/my-submissions', label: 'My Submissions', icon: ClipboardCheck },
    ] : []),
  ];

  if (!isAuthenticated) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0b1220] text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <Link to="/" className="text-xl font-bold leading-tight">
            <span className="block">Satyam</span>
            <span className="block text-sm font-medium text-slate-300">{portalName}</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pt-5">
          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-sky-400/10 to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles size={14} />
              Evaluation workspace
            </div>
            <p className="mt-2 text-sm text-slate-200">
              Tender navigation, bidder review, and document checkpoints stay available from a single officer console.
            </p>
          </div>
        </div>
        
        <nav className="mt-6 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon size={20} className="mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/85 backdrop-blur border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {portalName}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <User size={16} className="mr-2" />
              <span className="font-medium">{user?.full_name || user?.email}</span>
              <span className="mx-2">|</span>
              <span className="text-primary-700">{user?.role?.replace(/_/g, ' ') || 'User'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
