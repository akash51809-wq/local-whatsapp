import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/layout/Layout'

// Page Components
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import SendPage from '../pages/send/SendPage'
import GroupsPage from '../pages/groups/GroupsPage'
import IncomingPage from '../pages/incoming/IncomingPage'
import ReportsPage from '../pages/reports/ReportsPage'
import UsersPage from '../pages/admin/UsersPage'
import AdminPlansPage from '../pages/admin/AdminPlansPage'
import AdminPlanRequestsPage from '../pages/admin/AdminPlanRequestsPage'
import UserPlansPage from '../pages/subscription/UserPlansPage'
import ApiPage from '../pages/api/ApiPage'
import SystemPage from '../pages/system/SystemPage'

function ProtectedRoute({ children }) {
  const { login } = useAuth()
  if (!login) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function PublicOnlyRoute({ children }) {
  const { login } = useAuth()
  if (login) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route 
        path="/login" 
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        } 
      />

      {/* Main Shell (Protected) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="send" element={<SendPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="incoming" element={<IncomingPage />} />
        <Route path="chat" element={<Navigate to="/incoming" replace />} />
        
        {/* Reports */}
        <Route path="report" element={<ReportsPage />} />
        <Route path="reports" element={<Navigate to="/report" replace />} />

        {/* User Pricing & Plans */}
        <Route path="plans" element={<UserPlansPage />} />
        <Route path="subscription" element={<Navigate to="/plans" replace />} />

        {/* Admin Routes */}
        <Route 
          path="user" 
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          } 
        />
        <Route path="users" element={<Navigate to="/user" replace />} />
        <Route path="admin/users" element={<Navigate to="/user" replace />} />
        
        <Route 
          path="admin" 
          element={
            <AdminRoute>
              <AdminPlansPage />
            </AdminRoute>
          } 
        />
        <Route 
          path="admin/plans" 
          element={
            <AdminRoute>
              <AdminPlansPage />
            </AdminRoute>
          } 
        />

        <Route 
          path="payment/daybook" 
          element={
            <AdminRoute>
              <AdminPlanRequestsPage />
            </AdminRoute>
          } 
        />
        <Route path="admin/plan-requests" element={<Navigate to="/payment/daybook" replace />} />
        <Route path="admin/purchases" element={<Navigate to="/payment/daybook" replace />} />

        {/* API & System */}
        <Route path="api" element={<ApiPage />} />
        <Route path="system" element={<SystemPage />} />

        {/* Default fallback inside layout */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Global Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
