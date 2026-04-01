import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const showToast = useToastStore((state) => state.showToast);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const fromPath = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(fromPath, { replace: true });
    }
  }, [fromPath, isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await login({ identifier, password, rememberMe });
    if (result?.success) {
      showToast({
        title: "Connexion reussie",
        message: "Bienvenue dans l'administration.",
        variant: "success",
      });
      navigate(fromPath, { replace: true });
      return;
    }

    showToast({
      title: "Connexion echouee",
      message: result?.message || "Impossible de se connecter.",
      variant: "danger",
    });
  };

  return (
    <section className="flex min-h-screen items-center justify-center bg-background px-4 font-poppins">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden bg-secondary p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <Pill size={28} strokeWidth={2} className="text-accent" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent/80">
                Administration
              </p>
<<<<<<< HEAD
              <h1 className="text-3xl font-semibold">POSapp Admin</h1>
=======
              <h1 className="text-3xl font-semibold">NeoPharma Admin</h1>
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent/80">
                Acces protege
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                Supervision centrale des commandes, stocks et configurations.
              </h2>
            </div>
            <p className="max-w-md text-sm text-white/75">
              Connecte-toi avec un compte `ADMIN` ou `SUPERADMIN` pour acceder
              aux ecrans centraux de gestion.
            </p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mx-auto max-w-md">
            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
              Connexion
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-text-primary">
              Se connecter
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Utilise ton email ou ton telephone et ton mot de passe.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  Identifiant
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="email ou telephone"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  Mot de passe
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="mot de passe"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                  required
                />
              </label>

              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-secondary accent-secondary"
                />
                Garder la session active
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>

            <div className="mt-6 text-sm text-text-secondary">
              Retour a{" "}
              <Link to="/dashboard" className="font-medium text-secondary">
                l'application
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
