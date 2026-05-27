// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  // If there is no user logged in, send them to the login page instantly
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If they are logged in, let them see the page (the "children")
  return children;
}