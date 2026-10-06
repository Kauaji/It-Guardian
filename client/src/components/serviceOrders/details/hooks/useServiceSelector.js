import { useEffect, useMemo, useState } from "react";
import { filterServiceSuggestions, findServiceByName } from "../utils/catalog.js";
import { parseCurrency } from "../utils/money.js";

const SUGGESTION_CLOSE_DELAY_MS = 120;

// Escolha do servico realizado: busca, sugestoes e valor padrao no modo Business.
export function useServiceSelector({ serviceOrder, services, businessMode, setDraft, updateDraft }) {
  const [search, setSearch] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!serviceOrder) return;
    setSearch("");
    setSelectedServiceId("");
    setSuggestionsOpen(false);
    setOpen(false);
  }, [serviceOrder?.id]);

  const suggestions = useMemo(() => filterServiceSuggestions(services, search), [services, search]);

  function toggleOpen() {
    setOpen((current) => !current);
  }

  function changeSearch(value) {
    setSearch(value);
    setSelectedServiceId("");
    updateDraft("servicePerformed", "");
    setSuggestionsOpen(true);
  }

  function openSuggestions() {
    setSuggestionsOpen(true);
  }

  function closeSuggestionsSoon() {
    window.setTimeout(() => setSuggestionsOpen(false), SUGGESTION_CLOSE_DELAY_MS);
  }

  function selectService(service) {
    setSearch(service.name);
    setSelectedServiceId(service.id);
    setSuggestionsOpen(false);
    setDraft((current) => ({
      ...current,
      servicePerformed: service.name,
      serviceValue: businessMode
        ? (!parseCurrency(current.serviceValue) && service.defaultValue != null
          ? String(service.defaultValue)
          : current.serviceValue)
        : "0"
    }));
  }

  function confirmService() {
    const typedService = search.trim();
    const matchedService = services.find((service) => service.id === selectedServiceId)
      || findServiceByName(services, typedService);
    if (matchedService) {
      selectService(matchedService);
      return;
    }
    if (!typedService) return;
    setDraft((current) => ({ ...current, servicePerformed: typedService }));
    setSuggestionsOpen(false);
  }

  return {
    open,
    search,
    selectedServiceId,
    suggestionsOpen,
    suggestions,
    toggleOpen,
    changeSearch,
    openSuggestions,
    closeSuggestionsSoon,
    selectService,
    confirmService
  };
}
