import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";

const FirstConnexionPassword = () => {
  const navigate = useNavigate();
  const firstLoginChangePassword = useAuthStore(
    (state) => state.firstLoginChangePassword
  );
  const getPendingIdentifier = useAuthStore(
    (state) => state.getPendingIdentifier
  );
  const loading = useAuthStore((state) => state.loading);
  const showToast = useToastStore((state) => state.showToast);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      identifier: "",
      tempPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  useEffect(() => {
    const pending = getPendingIdentifier();
    if (pending) {
      setValue("identifier", pending);
    }
  }, [getPendingIdentifier, setValue]);

  const registerField = (name) => {
    if (name === "identifier") {
      return register(name, { required: "Identifiant requis." });
    }
    if (name === "tempPassword") {
      return register(name, { required: "Mot de passe temporaire requis." });
    }
    if (name === "newPassword") {
      return register(name, { required: "Nouveau mot de passe requis." });
    }
    if (name === "confirmNewPassword") {
      return register(name, { required: "Confirmation requise." });
    }
    return register(name);
  };

  const onSubmit = async (data) => {
    if (data.newPassword !== data.confirmNewPassword) {
      showToast({
        title: "Mot de passe",
        message: "Les mots de passe ne correspondent pas.",
        variant: "warning",
      });
      return;
    }

    const result = await firstLoginChangePassword({
      identifier: data.identifier?.trim(),
      tempPassword: data.tempPassword,
      newPassword: data.newPassword,
    });

    if (result?.success) {
      showToast({
        title: "Mot de passe mis a jour",
        message: result?.message || "Veuillez vous reconnecter.",
        variant: "success",
      });
      navigate("/login");
      return;
    }

    showToast({
      title: "Erreur",
      message: result?.message || "Impossible de modifier le mot de passe.",
      variant: "danger",
    });
  };

  return (
    <section className="min-h-screen w-full bg-background text-text-primary font-poppins">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-white">
                NP
              </div>
              <div>
                <p className="text-lg font-semibold text-text-primary">
                  POSapp
                </p>
                <p className="text-xs text-text-secondary">
                  Premiere connexion
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Retour connexion
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text-primary">
              Changer votre mot de passe
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Utilisez le mot de passe temporaire recu pour definir un nouveau
              mot de passe.
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
              label="Mot de passe temporaire"
              name="tempPassword"
              type="password"
              placeholder="Mot de passe temporaire"
              register={registerField}
              errors={errors}
            />
            <Input
              label="Nouveau mot de passe"
              name="newPassword"
              type="password"
              placeholder="Nouveau mot de passe"
              register={registerField}
              errors={errors}
              autoComplete="new-password"
            />
            <Input
              label="Confirmer le mot de passe"
              name="confirmNewPassword"
              type="password"
              placeholder="Confirmez le mot de passe"
              register={registerField}
              errors={errors}
              autoComplete="new-password"
            />

            <Button
              label={loading ? "Mise a jour..." : "Mettre a jour"}
              variant="primary"
              size="default"
              className="w-full"
              type="submit"
              disabled={loading}
            />
          </form>
        </div>
      </div>
    </section>
  );
};

export default FirstConnexionPassword;
