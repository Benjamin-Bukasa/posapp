import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const loading = useAuthStore((state) => state.loading);
  const showToast = useToastStore((state) => state.showToast);
  const [step, setStep] = useState("request");

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: requestErrors },
  } = useForm({
    defaultValues: {
      identifier: "",
      sendVia: "email",
    },
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: resetErrors },
  } = useForm({
    defaultValues: {
      token: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const registerRequestField = (name) => {
    if (name === "identifier") {
      return registerRequest(name, { required: "Identifiant requis." });
    }
    return registerRequest(name);
  };

  const registerResetField = (name) => {
    if (name === "token") {
      return registerReset(name, { required: "Code requis." });
    }
    if (name === "newPassword") {
      return registerReset(name, { required: "Nouveau mot de passe requis." });
    }
    if (name === "confirmNewPassword") {
      return registerReset(name, { required: "Confirmation requise." });
    }
    return registerReset(name);
  };

  const onRequest = async (data) => {
    const result = await forgotPassword({
      identifier: data.identifier?.trim(),
      sendVia: data.sendVia,
    });

    if (result?.success) {
      showToast({
        title: "Code envoye",
        message: result?.message || "Consultez votre email ou SMS.",
        variant: "success",
      });
      setStep("reset");
      return;
    }

    showToast({
      title: "Erreur",
      message: result?.message || "Impossible d'envoyer le code.",
      variant: "danger",
    });
  };

  const onReset = async (data) => {
    if (data.newPassword !== data.confirmNewPassword) {
      showToast({
        title: "Mot de passe",
        message: "Les mots de passe ne correspondent pas.",
        variant: "warning",
      });
      return;
    }

    const result = await resetPassword({
      token: data.token?.trim(),
      newPassword: data.newPassword,
    });

    if (result?.success) {
      showToast({
        title: "Mot de passe mis a jour",
        message: result?.message || "Vous pouvez vous connecter.",
        variant: "success",
      });
      navigate("/login");
      return;
    }

    showToast({
      title: "Erreur",
      message: result?.message || "Impossible de reinitialiser le mot de passe.",
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
                  Recuperation de compte
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
              Mot de passe oublie
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Recevez un code par email ou SMS pour reinitialiser votre mot de
              passe.
            </p>
          </div>

          {step === "request" ? (
            <form className="space-y-4" onSubmit={handleSubmitRequest(onRequest)}>
              <Input
                label="Email ou telephone"
                name="identifier"
                type="text"
                placeholder="exemple@POSapp.com"
                register={registerRequestField}
                errors={requestErrors}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm text-text-secondary">
                  Canal d&apos;envoi
                </label>
                <select
                  className="border border-border rounded-lg bg-surface p-2 text-sm text-text-primary"
                  {...registerRequest("sendVia")}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>

              <Button
                label={loading ? "Envoi..." : "Envoyer le code"}
                variant="primary"
                size="default"
                className="w-full"
                type="submit"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() => setStep("reset")}
                className="w-full text-xs text-text-secondary hover:text-text-primary"
              >
                J&apos;ai deja un code
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmitReset(onReset)}>
              <Input
                label="Code de reinitialisation"
                name="token"
                type="text"
                placeholder="Entrez le code"
                register={registerResetField}
                errors={resetErrors}
              />
              <Input
                label="Nouveau mot de passe"
                name="newPassword"
                type="password"
                placeholder="Nouveau mot de passe"
                register={registerResetField}
                errors={resetErrors}
              />
              <Input
                label="Confirmer le mot de passe"
                name="confirmNewPassword"
                type="password"
                placeholder="Confirmez le mot de passe"
                register={registerResetField}
                errors={resetErrors}
              />

              <Button
                label={loading ? "Mise a jour..." : "Mettre a jour"}
                variant="primary"
                size="default"
                className="w-full"
                type="submit"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() => setStep("request")}
                className="w-full text-xs text-text-secondary hover:text-text-primary"
              >
                Renvoyer un code
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
