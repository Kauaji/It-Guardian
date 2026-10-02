import { useEffect, useRef, useState } from "react";
import {
  deleteFloorPlanBackground,
  fetchFloorPlanBackgroundBlob,
  uploadFloorPlanBackground
} from "../../../api.js";
import { setBackgroundSettingsInDraft, withFloorBackgroundUrl } from "../utils/entityMutations.js";
import { isValidBackgroundFile } from "../utils/infrastructure.js";

/**
 * Imagem de fundo do pavimento ativo: download protegido (blob), envio,
 * remocao e ajustes (opacidade, escala, posicao, encaixe).
 */
export function useFloorBackground({ token, notify, doc }) {
  const { editor, setEditor, activeFloorId, activeFloorRecord, commitEditor } = doc;
  const [backgroundSrc, setBackgroundSrc] = useState("");
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const inputRef = useRef(null);
  const settings = activeFloorRecord?.metadata?.backgroundSettings || {};

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    if (!editor?.plan?.id || !activeFloorRecord?.id || !activeFloorRecord.backgroundUrl) {
      setBackgroundSrc("");
      return undefined;
    }
    fetchFloorPlanBackgroundBlob(token, editor.plan.id, activeFloorRecord.id)
      .then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setBackgroundSrc(objectUrl); })
      .catch(() => { if (active) setBackgroundSrc(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [activeFloorRecord?.backgroundUrl, activeFloorRecord?.id, editor?.plan?.id, token]);

  const updateSettings = (nextSettings) => {
    commitEditor((draft) => setBackgroundSettingsInDraft(draft, activeFloorId, nextSettings), { track: false });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor?.plan?.id || !activeFloorId) return;
    if (!isValidBackgroundFile(file)) {
      notify?.("Envie uma imagem PNG, JPG ou WEBP de até 8 MB.", "danger");
      return;
    }
    setBackgroundBusy(true);
    try {
      const payload = await uploadFloorPlanBackground(token, editor.plan.id, activeFloorId, file);
      setEditor((current) => withFloorBackgroundUrl(current, activeFloorId, payload.background.backgroundUrl));
      notify?.("Planta de fundo enviada com segurança.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    } finally {
      setBackgroundBusy(false);
    }
  };

  const remove = async () => {
    if (!editor?.plan?.id || !activeFloorId || !window.confirm("Remover a imagem de fundo desta planta? Os componentes posicionados serão preservados.")) return;
    setBackgroundBusy(true);
    try {
      await deleteFloorPlanBackground(token, editor.plan.id, activeFloorId);
      setEditor((current) => withFloorBackgroundUrl(current, activeFloorId, null));
      setBackgroundSrc("");
      notify?.("Imagem de fundo removida; o mapa técnico foi preservado.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    } finally {
      setBackgroundBusy(false);
    }
  };

  return {
    src: backgroundSrc,
    busy: backgroundBusy,
    settings,
    inputRef,
    openFilePicker: () => inputRef.current?.click(),
    updateSettings,
    upload,
    remove
  };
}
