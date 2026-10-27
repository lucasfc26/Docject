import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2 } from "lucide-react";
import { useRef } from "react";
import { apiDelete, apiGet, apiUploadLogo, type ApiUser } from "../../services/api";
import { Button } from "../ui";
import { UserAvatar, profileQueryKey, type CurrentProfile } from "../UserAvatar";

const MAX_BYTES = 2 * 1024 * 1024;

/** Company logo or photo: shown in the header and next to the brand on issued invoices. */
export function LogoUploader() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: profile } = useQuery({
    queryKey: profileQueryKey,
    queryFn: () => apiGet<CurrentProfile>("/auth/me"),
  });

  const onSaved = (saved: ApiUser) => {
    queryClient.setQueryData<CurrentProfile>(profileQueryKey, (current) =>
      current ? { ...current, logoUrl: saved.logoUrl ?? null } : current,
    );
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiUploadLogo(file),
    onSuccess: onSaved,
    meta: { successMessage: "Logo atualizada." },
  });
  const removeMutation = useMutation({
    mutationFn: () => apiDelete<ApiUser>("/users/me/logo"),
    onSuccess: onSaved,
    meta: { successMessage: "Logo removida." },
  });

  return (
    <div className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <UserAvatar className="h-20 w-20 rounded-2xl text-3xl" logoUrl={profile?.logoUrl} name={profile?.name} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Foto ou logo da empresa</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Aparece no topo do sistema e ao lado do nome da empresa nas faturas. PNG, JPG ou WEBP de ate 2 MB.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          ref={inputRef}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > MAX_BYTES) {
              uploadMutation.reset();
              window.alert("A imagem deve ter no maximo 2 MB.");
              return;
            }
            uploadMutation.mutate(file);
          }}
        />
        <Button disabled={uploadMutation.isPending} type="button" onClick={() => inputRef.current?.click()}>
          <ImageUp size={17} />
          {uploadMutation.isPending ? "Enviando..." : profile?.logoUrl ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {profile?.logoUrl ? (
          <Button disabled={removeMutation.isPending} type="button" variant="ghost" onClick={() => removeMutation.mutate()}>
            <Trash2 size={17} /> Remover
          </Button>
        ) : null}
      </div>
    </div>
  );
}
