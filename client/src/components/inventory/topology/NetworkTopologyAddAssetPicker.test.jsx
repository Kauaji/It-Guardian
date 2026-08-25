import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NetworkTopologyAddAssetPicker from "./NetworkTopologyAddAssetPicker.jsx";

const DEVICES = [
  { id: "d1", name: "Apelido do Servidor", technicalName: "SRV-01", ip: "10.0.0.1", status: "online", assetType: "server" },
  { id: "d2", name: "Desktop RH", technicalName: "Desktop RH", ip: "10.0.0.2", status: "offline", assetType: "desktop" }
];

describe("NetworkTopologyAddAssetPicker", () => {
  it("nao mostra a lista antes do campo ganhar foco", () => {
    render(<NetworkTopologyAddAssetPicker devices={DEVICES} onPick={vi.fn()} />);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("foco sem digitar nada mostra todos os ativos disponiveis", () => {
    render(<NetworkTopologyAddAssetPicker devices={DEVICES} onPick={vi.fn()} />);
    fireEvent.focus(screen.getByPlaceholderText("Adicionar ativo ao mapa..."));
    expect(screen.getByText("Apelido do Servidor")).toBeTruthy();
    expect(screen.getByText("Desktop RH")).toBeTruthy();
  });

  it("busca filtra tanto pelo apelido quanto pelo nome tecnico", () => {
    render(<NetworkTopologyAddAssetPicker devices={DEVICES} onPick={vi.fn()} />);
    const input = screen.getByPlaceholderText("Adicionar ativo ao mapa...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "SRV-01" } });
    expect(screen.getByText("Apelido do Servidor")).toBeTruthy();
    expect(screen.queryByText("Desktop RH")).toBeNull();
  });

  it("clicar num ativo chama onPick e limpa a busca", () => {
    const onPick = vi.fn();
    render(<NetworkTopologyAddAssetPicker devices={DEVICES} onPick={onPick} />);
    fireEvent.focus(screen.getByPlaceholderText("Adicionar ativo ao mapa..."));
    fireEvent.click(screen.getByText("Apelido do Servidor"));
    expect(onPick).toHaveBeenCalledWith("d1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lista vazia mostra mensagem de que ja esta tudo no mapa", () => {
    render(<NetworkTopologyAddAssetPicker devices={[]} onPick={vi.fn()} />);
    fireEvent.focus(screen.getByPlaceholderText("Adicionar ativo ao mapa..."));
    expect(screen.getByText("Todos os ativos já estão no mapa.")).toBeTruthy();
  });

  it("busca sem resultado mostra mensagem especifica", () => {
    render(<NetworkTopologyAddAssetPicker devices={DEVICES} onPick={vi.fn()} />);
    const input = screen.getByPlaceholderText("Adicionar ativo ao mapa...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "inexistente" } });
    expect(screen.getByText('Nenhum ativo encontrado para "inexistente".')).toBeTruthy();
  });
});
