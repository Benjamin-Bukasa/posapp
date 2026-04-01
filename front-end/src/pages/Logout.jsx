import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/ui/modal";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";

const Logout = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.showToast);
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    setIsOpen(false);
    navigate(-1);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await logout();
    showToast({
      title: "Deconnexion",
      message: "Vous etes deconnecte.",
      variant: "info",
    });
    navigate("/login", { replace: true });
  };

  return (
    <section className="min-h-screen w-full bg-background text-text-primary font-poppins">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6 py-10">
        <Modal
          isOpen={isOpen}
          title="Confirmer la deconnexion"
          description="Voulez-vous vraiment vous deconnecter ?"
          confirmLabel={isSubmitting ? "Deconnexion..." : "Se deconnecter"}
          cancelLabel="Annuler"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirmButtonClassName="bg-red-500 hover:bg-red-600"
        />
      </div>
    </section>
  );
};

export default Logout;
