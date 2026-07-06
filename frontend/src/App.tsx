import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Campaigns } from './pages/Campaigns';
import { Settings } from './pages/Settings';
import { Unauthorized } from './pages/Unauthorized';

const RoleBasedRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'agent') return <Navigate to="/leads" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes Wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Common protected pages: accessible by Admin, Manager, Agent */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'agent']} />}>
                <Route path="/leads" element={<Leads />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
              </Route>

              {/* Elevated protected pages: accessible by Admin, Manager */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campaigns" element={<Campaigns />} />
              </Route>

              {/* Admin-only pages: accessible only by Admin */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/settings" element={<Settings />} />
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
