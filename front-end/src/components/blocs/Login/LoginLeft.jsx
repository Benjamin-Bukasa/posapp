import React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../ui/button";
import Input from "../../ui/input";
import useAuthStore from "../../../stores/authStore";
import useToastStore from "../../../stores/toastStore";

const LoginLeft = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const showToast = useToastStore((state) => state.showToast);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: true,
    },
  });

  const registerField = (name) => {
    if (name === "identifier") {
      return register(name, { required: "Identifiant requis." });
    }
    if (name === "password") {
      return register(name, { required: "Mot de passe requis." });
    }
    return register(name);
  };

  const onSubmit = async (data) => {
    const result = await login({
      identifier: data.identifier?.trim(),
      password: data.password,
      rememberMe: data.rememberMe,
    });

    if (result?.requirePasswordChange) {
      showToast({
        title: "Changement requis",
        message: "Veuillez changer votre mot de passe avant de continuer.",
        variant: "warning",
      });
      navigate("/first-connexion-password", { replace: true });
      return;
    }

    if (result?.success) {
      showToast({
        title: "Connexion reussie",
        message: "Bienvenue dans POSapp.",
        variant: "success",
      });
      navigate("/dashboard");
      return;
    }

    showToast({
      title: "Connexion echouee",
      message: result?.message || "Identifiants invalides.",
      variant: "danger",
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-white">
            NP
          </div>
          <span className="text-lg font-semibold text-text-primary">
            POSapp
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>Vous n&apos;avez pas de compte&nbsp;?</span>
          <Button label="Creer" variant="default" size="small" type="button" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-text-primary">
              Connexion
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Entrez vos informations de connexion
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email ou telephone"
              name="identifier"
              type="text"
              placeholder="exemple@POSapp.com"
              register={registerField}
              errors={errors}
              autoComplete="username"
            />
            <Input
              label="Mot de passe"
              name="password"
              type="password"
              placeholder="Votre mot de passe"
              register={registerField}
              errors={errors}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-surface text-primary focus:ring-primary accent-primary"
                  {...register("rememberMe")}
                />
                Se souvenir de moi
              </label>
              <Link
                to="/forgot-password"
                className="text-text-secondary hover:text-text-primary"
              >
                Mot de passe oublie&nbsp;?
              </Link>
            </div>

            <Button
              label={loading ? "Connexion..." : "Login"}
              variant="primary"
              size="default"
              className="w-full"
              type="submit"
              disabled={loading}
            />

            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span className="h-px flex-1 bg-border" />
              ou continuer avec
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:bg-background"
            >
              Se connecter avec Google
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 text-center text-xs text-text-secondary">
        www.POSapp.com
      </div>
    </div>
  );
};

export default LoginLeft;
