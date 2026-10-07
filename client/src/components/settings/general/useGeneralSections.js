import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Palette, SlidersHorizontal, UserCog } from "lucide-react";

/** Abas do modal: "Admin" só existe para administradores; abas inválidas voltam a Usabilidade. */
export function useGeneralSections(open, isAdmin) {
  const [section, setSection] = useState("usability");

  const sections = useMemo(() => {
    const items = [
      { id: "usability", label: "Usabilidade", icon: SlidersHorizontal },
      { id: "appearance", label: "Aparência", icon: Palette }
    ];

    if (isAdmin) {
      items.push({ id: "admin", label: "Admin", icon: UserCog });
    }

    items.push({ id: "mode", label: "Modo do sistema", icon: BriefcaseBusiness });
    return items;
  }, [isAdmin]);

  useEffect(() => {
    if (open && section === "admin" && !isAdmin) {
      setSection("usability");
    }
    if (open && section === "account") {
      setSection("usability");
    }
  }, [open, section, isAdmin]);

  return { section, setSection, sections };
}
