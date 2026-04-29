import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TenderList from './pages/TenderList';
import TenderDetail from './pages/TenderDetail';
import DocumentUpload from './pages/DocumentUpload';
import EvaluationConsole from './pages/EvaluationConsole';
import BidSubmission from './pages/BidSubmission';
import SubmissionStatus from './pages/SubmissionStatus';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="tenders" element={<ProtectedRoute><TenderList /></ProtectedRoute>} />
          <Route path="tenders/:id" element={<ProtectedRoute><TenderDetail /></ProtectedRoute>} />
          <Route path="upload" element={<ProtectedRoute><DocumentUpload /></ProtectedRoute>} />
          <Route path="evaluation/:tenderId" element={<ProtectedRoute requiredRole={['committee_member', 'approver', 'admin']}><EvaluationConsole /></ProtectedRoute>} />
          <Route path="submit-bid/:tenderId" element={<ProtectedRoute requiredRole="bidder"><BidSubmission /></ProtectedRoute>} />
          <Route path="submission-status/:submissionId" element={<ProtectedRoute requiredRole="bidder"><SubmissionStatus /></ProtectedRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
