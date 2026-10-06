import { useState } from "react";

// Estado de selecao e edicao do mapa (no, conexao, modo de edicao e destaques).
export default function useTopologySelectionState() {
  const [editMode, setEditMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [justAddedNodeId, setJustAddedNodeId] = useState(null);
  const [justCreatedLinkId, setJustCreatedLinkId] = useState(null);
  return {
    editMode, setEditMode, selectedNodeId, setSelectedNodeId, selectedLinkId, setSelectedLinkId,
    justAddedNodeId, setJustAddedNodeId, justCreatedLinkId, setJustCreatedLinkId
  };
}
