import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import CampaignsListPage from '@/pages/CampaignsListPage';
import CampaignNewPage from '@/pages/CampaignNewPage';
import CampaignDetailPage from '@/pages/CampaignDetailPage';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/campaigns" element={<ProtectedRoute><CampaignsListPage /></ProtectedRoute>} />
      <Route path="/campaigns/new" element={<ProtectedRoute><CampaignNewPage /></ProtectedRoute>} />
      <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetailPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  );
}
