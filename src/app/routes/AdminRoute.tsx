import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/app/context/AuthContext";

export function AdminRoute() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  if (profile?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
