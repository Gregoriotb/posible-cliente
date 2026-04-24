import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getStoredApiKey } from "@/api/client";

/**
 * Guard de auth: si no hay API key en localStorage, redirige a /login
 * preservando la ruta destino para volver tras el login.
 */
export function ProtectedRoute() {
  const hasKey = !!getStoredApiKey();
  const location = useLocation();

  if (!hasKey) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return <Outlet />;
}
