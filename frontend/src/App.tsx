import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Campaigns } from './pages/Campaigns';
import { Unauthorized } from './pages/Unauthorized';
import AdminUsers from './pages/AdminUsers';
import StatusDictionary from './pages/StatusDictionary';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AddLead } from './pages/AddLead';
import { ImportLeads } from './pages/ImportLeads';
import { LeadDetails } from './pages/LeadDetails';
import { LeadEdit } from './pages/LeadEdit';
import { LeadEnrichmentHistory } from './pages/LeadEnrichmentHistory';
import { SegmentList } from './pages/SegmentList';
import { CreateEditSegment } from './pages/CreateEditSegment';
import { CampaignEditor } from './pages/CampaignEditor';
import { CampaignDetails } from './pages/CampaignDetails';
import { MessageTemplates } from './pages/MessageTemplates';
import { TemplateEditor } from './pages/TemplateEditor';
import { ConsentManagement } from './pages/ConsentManagement';
import { SalesQueue } from './pages/SalesQueue';
import { AnalyticsReports } from './pages/AnalyticsReports';
import { IntegrationSettings } from './pages/IntegrationSettings';
import { AuditLogs } from './pages/AuditLogs';
import { Profile } from './pages/Profile';
import { Toaster } from 'react-hot-toast';

const RoleBasedRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Sales Rep') return <Navigate to="/leads" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes Wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Common protected pages: accessible by all internal personas */}
              <Route element={<ProtectedRoute allowedRoles={['System Admin', 'Growth Operator', 'Compliance Admin', 'Sales Rep']} />}>
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/add" element={<AddLead />} />
                <Route path="/leads/import" element={<ImportLeads />} />
                <Route path="/leads/:id" element={<LeadDetails />} />
                <Route path="/leads/:id/edit" element={<LeadEdit />} />
                <Route path="/leads/:id/enrichment" element={<LeadEnrichmentHistory />} />
                <Route path="/sales-queue" element={<SalesQueue />} />
                <Route path="/dictionary" element={<StatusDictionary />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
              </Route>

              {/* Elevated protected pages: accessible by Admin, Growth Operator, Compliance Admin */}
              <Route element={<ProtectedRoute allowedRoles={['System Admin', 'Growth Operator', 'Compliance Admin']} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaigns/create" element={<CampaignEditor />} />
                <Route path="/campaigns/:id/edit" element={<CampaignEditor />} />
                <Route path="/campaigns/:id" element={<CampaignDetails />} />
                <Route path="/segments" element={<SegmentList />} />
                <Route path="/segments/create" element={<CreateEditSegment />} />
                <Route path="/segments/:id/edit" element={<CreateEditSegment />} />
                <Route path="/templates" element={<MessageTemplates />} />
                <Route path="/templates/create" element={<TemplateEditor />} />
                <Route path="/templates/:id/edit" element={<TemplateEditor />} />
                <Route path="/consent" element={<ConsentManagement />} />
                <Route path="/reports" element={<AnalyticsReports />} />
              </Route>

              {/* Admin-only pages: accessible only by System Admin */}
              <Route element={<ProtectedRoute allowedRoles={['System Admin']} />}>
                <Route path="/settings/integrations" element={<IntegrationSettings />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/audit-logs" element={<AuditLogs />} />
              </Route>
            </Route>
          </Route>

          {/* Redirect root and unmatched routes */}
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
