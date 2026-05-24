import { AdminDashboard } from "./pages/AdminDashboard";
import { EmployeeDashboard } from "./pages/EmployeeDashboard";
import { LoginPage } from "./pages/LoginPage";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600 shadow-soft">Carregando...</div>
      </main>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return user.role === "ADMIN" ? <AdminDashboard /> : <EmployeeDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
