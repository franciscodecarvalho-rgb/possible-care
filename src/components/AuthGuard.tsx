import { Navigate } from "react-router-dom";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const isAuth = sessionStorage.getItem("app_authenticated") === "true";
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default AuthGuard;
