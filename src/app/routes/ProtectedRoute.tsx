import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/app/context/AuthContext";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090B] gap-4">
        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/40 mb-2">
          <span className="text-white font-bold text-xl">W</span>
        </div>
        {/* Spinner */}
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        {/* Text */}
        <p className="text-slate-500 text-xs tracking-widest uppercase">WealthHub</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
