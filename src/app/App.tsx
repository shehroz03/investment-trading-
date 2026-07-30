import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/app/context/AuthContext";
import { ThemeProvider } from "@/app/context/ThemeContext";
import { ProtectedRoute } from "@/app/routes/ProtectedRoute";
import { AdminRoute } from "@/app/routes/AdminRoute";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { AdminLayout } from "@/app/layouts/AdminLayout";

import Login from "@/app/pages/Login";
import Signup from "@/app/pages/Signup";
import Dashboard from "@/app/pages/Dashboard";
import Trade from "@/app/pages/Trade";
import Kyc from "@/app/pages/Kyc";
import WalletBalance from "@/app/pages/WalletBalance";
import WalletDeposit from "@/app/pages/WalletDeposit";
import WalletWithdraw from "@/app/pages/WalletWithdraw";
import ReportsDaily from "@/app/pages/ReportsDaily";
import ReportsMonthly from "@/app/pages/ReportsMonthly";
import Settings from "@/app/pages/Settings";
import SocialBanners from "@/app/pages/SocialBanners";
import News from "@/app/pages/News";
import Guides from "@/app/pages/Guides";
import AdminHome from "@/app/pages/admin/AdminHome";
import AdminDeposits from "@/app/pages/admin/AdminDeposits";
import AdminWithdrawals from "@/app/pages/admin/AdminWithdrawals";
import AdminKyc from "@/app/pages/admin/AdminKyc";
import AdminUsers from "@/app/pages/admin/AdminUsers";
import AdminSettings from "@/app/pages/admin/AdminSettings";
import AdminContent from "@/app/pages/admin/AdminContent";
import AdminTrades from "@/app/pages/admin/AdminTrades";
import VipChannel from "@/app/pages/VipChannel";
import AdminVip from "@/app/pages/admin/AdminVip";
import Support from "@/app/pages/Support";
import MakeMeAdmin from "@/app/pages/MakeMeAdmin";
import AdminSupport from "@/app/pages/admin/AdminSupport";
import MyReferrals from "@/app/pages/MyReferrals";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/make-me-admin" element={<MakeMeAdmin />} />
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trade" element={<Trade />} />
                <Route path="/trade/:symbol" element={<Trade />} />
                <Route path="/kyc" element={<Kyc />} />
                <Route path="/wallet" element={<WalletBalance />} />
                <Route path="/wallet/deposit" element={<WalletDeposit />} />
                <Route path="/wallet/withdraw" element={<WalletWithdraw />} />
                <Route path="/reports/daily" element={<ReportsDaily />} />
                <Route path="/reports/monthly" element={<ReportsMonthly />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/social-banners" element={<SocialBanners />} />
                <Route path="/news" element={<News />} />
                <Route path="/guides" element={<Guides />} />
                <Route path="/vip-channel" element={<VipChannel />} />
                <Route path="/support" element={<Support />} />
                <Route path="/referrals" element={<MyReferrals />} />

              </Route>

              <Route element={<AdminLayout />}>
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminHome />} />
                  <Route path="/admin/deposits" element={<AdminDeposits />} />
                  <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                  <Route path="/admin/kyc" element={<AdminKyc />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/content" element={<AdminContent />} />
                  <Route path="/admin/trades" element={<AdminTrades />} />
                  <Route path="/admin/vip-requests" element={<AdminVip />} />
                  <Route path="/admin/support" element={<AdminSupport />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
