import React, { useMemo, useState, useEffect } from "react";
import Input from "../components/ui/input";
import Button from "../components/ui/button";
import ImageDropzone from "../components/ui/imageDropzone";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";
import { formatName } from "../utils/formatters";

const displayValue = (value) => {
  if (!value) return "Non renseigné";
  return value;
};

const formatRole = (role) => {
  if (!role) return "Utilisateur";
  if (role === "SUPERADMIN") return "Super admin";
  if (role === "ADMIN") return "Administrateur";
  return "Utilisateur";
};

function Profile() {
  const user = useAuthStore((state) => state.user);
  const changePassword = useAuthStore((state) => state.changePassword);
  const updateUser = useAuthStore((state) => state.updateUser);
  const showToast = useToastStore((state) => state.showToast);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(() => user?.avatarUrl || "");
  const [avatarSaving, setAvatarSaving] = useState(false);

  const fullName = useMemo(() => {
    const name = formatName(user);
    return name === "N/A" ? "Utilisateur" : name;
  }, [user]);

  const initials = useMemo(() => {
    const parts = fullName.split(" ").filter(Boolean);
    if (!parts.length) return "U";
    const letters = parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "");
    return letters.join("") || "U";
  }, [fullName]);

  const savedAvatar = user?.avatarUrl || "";

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(savedAvatar);
    }
  }, [avatarFile, savedAvatar]);

  const infoCards = useMemo(
    () => [
      { label: "Nom complet", value: fullName },
      { label: "Email", value: displayValue(user?.email) },
      { label: "Téléphone", value: displayValue(user?.phone) },
      { label: "Rôle", value: formatRole(user?.role) },
      { label: "Boutique", value: displayValue(user?.storeName) },
    ],
    [fullName, user]
  );

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Lecture impossible."));
      reader.readAsDataURL(file);
    });

  const handleAvatarSelect = (file, previewUrl) => {
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  };

  const handleAvatarClear = () => {
    setAvatarFile(null);
    setAvatarPreview(savedAvatar);
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) {
      showToast({
        title: "Aucune image",
        message: "Selectionnez une image avant de sauvegarder.",
        variant: "warning",
      });
      return;
    }

    setAvatarSaving(true);
    try {
      const dataUrl = await fileToDataUrl(avatarFile);
      updateUser?.({ avatarUrl: dataUrl });
      setAvatarPreview(dataUrl);
      setAvatarFile(null);
      showToast({
        title: "Photo mise a jour",
        message: "Votre photo de profil a ete mise a jour.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: "Impossible de sauvegarder la photo.",
        variant: "danger",
      });
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast({
        title: "Champs requis",
        message: "Veuillez remplir tous les champs.",
        variant: "warning",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({
        title: "Erreur",
        message: "Les mots de passe ne correspondent pas.",
        variant: "danger",
      });
      return;
    }
    setLoading(true);
    try {
      const result = await changePassword({ oldPassword, newPassword });
      if (result?.success) {
        showToast({
          title: "Mot de passe modifié",
          message: result.message || "Votre mot de passe a été mis à jour.",
          variant: "success",
        });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast({
          title: "Erreur",
          message: result?.message || "Impossible de modifier le mot de passe.",
          variant: "danger",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Profil</h1>
        <p className="text-sm text-text-secondary">
          Consultez vos informations et gérez votre mot de passe.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Photo de profil</p>
        <p className="mt-1 text-xs text-text-secondary">
          Ajoutez une photo pour personnaliser votre compte.
        </p>
        <div className="mt-4">
          <ImageDropzone
            value={avatarPreview}
            initials={initials}
            onFileSelect={handleAvatarSelect}
            onClear={handleAvatarClear}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              label={avatarSaving ? "Sauvegarde..." : "Sauvegarder"}
              variant="primary"
              size="small"
              disabled={!avatarFile || avatarSaving}
              onClick={handleAvatarSave}
            />
            {avatarFile ? (
              <span className="text-xs text-text-secondary">
                Image en attente de sauvegarde.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {infoCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs text-text-secondary">{card.label}</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">
          Modifier le mot de passe
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            label="Ancien mot de passe"
            name="oldPassword"
            type="password"
            allowToggle
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Nouveau mot de passe"
            name="newPassword"
            type="password"
            allowToggle
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Confirmer le mot de passe"
            name="confirmPassword"
            type="password"
            allowToggle
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
          />
          <div className="flex items-end">
            <Button
              type="submit"
              label={loading ? "Mise à jour..." : "Mettre à jour"}
              variant="primary"
              className="w-full"
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </section>
  );
}

export default Profile;
