import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarEventModal from "./CalendarEventModal.jsx";

const props = () => ({
  selectedDate: new Date(2026, 8, 3, 15, 30),
  defaults: {},
  technicians: [{ id: "tec1", name: "Ana" }],
  serviceOrders: [
    { id: "os1", number: "OS-1", title: "Rede", status: "new", assetId: "d1" },
    { id: "os2", number: "OS-2", title: "Feita", status: "Concluída" },
    { id: "os3", number: "OS-3", title: "Fechada", status: "new", closedAt: "2026-01-01" },
    { id: "os4", number: "OS-4", title: "Sem ativo", status: "open" },
    { id: "os5", number: "OS-5", title: "Ativo na manutenção", status: "open", assetId: "d2" }
  ],
  tabs: [
    { id: "t1", name: "Matriz" },
    { id: "t2", name: "Filial" }
  ],
  groups: [
    { id: "g1", name: "Operação", tabId: "t1" },
    { id: "g2", name: "Campo", tabId: "t2" }
  ],
  segments: [
    { id: "s1", name: "Financeiro", groupId: "g1", tabId: "t1" },
    { id: "s2", name: "Manutenção", groupId: "g1", tabId: "t1" },
    { id: "s3", name: "Padrão", groupId: "g1", tabId: "t1", isDefault: true },
    { id: "s4", name: "Vendas", groupId: "g2", tabId: "t2" }
  ],
  devices: [
    { id: "d1", alias: "PC Fin", segmentId: "s1", tabId: "t1" },
    { id: "d2", hostname: "host-m", segmentId: "s2", tabId: "t1" },
    { id: "d3", name: "Vendas 1", segmentId: "s4" },
    { id: "d4", segmentId: "s1" }
  ],
  permissions: { create: true, update: true, delete: true, cancel: true, assignTechnician: true },
  saving: false,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onComplete: vi.fn(),
  onDelete: vi.fn()
});
const field = (label) => screen.getByLabelText(label);
const optionNames = (label) => [...field(label).querySelectorAll("option")].map((o) => o.textContent);

describe("CalendarEventModal (fluxos)", () => {
  let p;
  beforeEach(() => {
    p = props();
  });

  it("novo agendamento: valores iniciais derivados da data selecionada", () => {
    render(<CalendarEventModal {...p} />);
    expect(screen.getByRole("dialog", { name: "Novo agendamento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novo agendamento" })).toBeInTheDocument();
    expect(field("Início")).toHaveValue("2026-09-03T09:00");
    expect(field("Término")).toHaveValue("2026-09-03T10:00");
    expect(field("Tipo")).toHaveValue("technical_visit");
    expect(field("Prioridade")).toHaveValue("normal");
    expect(field("Status")).toHaveValue("scheduled");
    expect(field("Título")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Criar agendamento" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /concluir evento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(optionNames("Tipo")).toContain("Ordem de Serviço");
    expect(optionNames("Prioridade")).toEqual(["Baixa", "Normal", "Alta", "Urgente"]);
    expect(optionNames("Status")).toContain("Não realizado");
    expect(field("Técnico")).toBeEnabled();
    expect(optionNames("Técnico")).toEqual(["Não atribuído", "Ana"]);
  });

  it("sem selectedDate usa a data atual às 09:00 e aplica defaults", () => {
    render(
      <CalendarEventModal
        {...p}
        selectedDate={undefined}
        defaults={{ title: "Padrão", eventType: "reminder", technicianId: "tec1", serviceOrderId: "os4", startAt: "2026-10-01T14:00:00" }}
      />
    );
    expect(field("Título")).toHaveValue("Padrão");
    expect(field("Tipo")).toHaveValue("reminder");
    expect(field("Técnico")).toHaveValue("tec1");
    expect(field("Ordem de Serviço")).toHaveValue("os4");
    expect(field("Início")).toHaveValue("2026-10-01T14:00");
    expect(field("Término")).toHaveValue("2026-10-01T15:00");
  });

  it("sem defaults de início cai para a data atual", () => {
    render(<CalendarEventModal {...p} selectedDate={undefined} defaults={undefined} />);
    expect(field("Início").value).toMatch(/T09:00$/);
  });

  it("editar: preenche com o evento e mostra ações conforme status e permissões", () => {
    const event = {
      id: "e1",
      title: "Existente",
      eventType: "preventive_maintenance",
      status: "scheduled",
      priority: "high",
      startAt: new Date(2026, 8, 4, 8, 0).toISOString(),
      endAt: new Date(2026, 8, 4, 9, 30).toISOString(),
      allDay: false,
      technicianId: "tec1",
      description: "Detalhe"
    };
    render(<CalendarEventModal {...p} event={event} />);
    expect(screen.getByRole("dialog", { name: "Editar agendamento" })).toBeInTheDocument();
    expect(field("Título")).toHaveValue("Existente");
    expect(field("Início")).toHaveValue("2026-09-04T08:00");
    expect(field("Término")).toHaveValue("2026-09-04T09:30");
    expect(field("Descrição")).toHaveValue("Detalhe");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Concluir evento/ }));
    expect(p.onComplete).toHaveBeenCalledWith(event);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar evento" }));
    expect(p.onCancel).toHaveBeenCalledWith(event);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(p.onDelete).toHaveBeenCalledWith(event);
  });

  it("ações escondidas para eventos concluídos/cancelados ou sem permissão", () => {
    const { rerender } = render(<CalendarEventModal {...p} event={{ id: "e1", status: "completed", title: "x" }} />);
    expect(screen.queryByRole("button", { name: /Concluir evento/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar evento" })).toBeInTheDocument();
    rerender(<CalendarEventModal {...p} event={{ id: "e1", status: "cancelled", title: "x" }} />);
    expect(screen.queryByRole("button", { name: /Concluir evento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar evento" })).not.toBeInTheDocument();
    rerender(<CalendarEventModal {...p} permissions={{}} event={{ id: "e1", status: "scheduled", title: "x" }} />);
    expect(screen.queryByRole("button", { name: /Concluir evento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar evento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    expect(field("Técnico")).toBeDisabled();
  });

  it("desabilita o envio sem permissão de criar e durante o salvamento", () => {
    const { rerender } = render(<CalendarEventModal {...p} permissions={{}} />);
    expect(screen.getByRole("button", { name: "Criar agendamento" })).toBeDisabled();
    rerender(<CalendarEventModal {...p} saving event={{ id: "e1", status: "scheduled", title: "x" }} />);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Concluir evento/ })).toBeDisabled();
  });

  it("fecha pelo botão, por Voltar, pelo fundo e pelo Escape, mas não por clique interno", () => {
    render(<CalendarEventModal {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(p.onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(p.onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(document.querySelector(".calendar-modal-backdrop"));
    expect(p.onClose).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(p.onClose.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("serializa o envio: remove tabId, converte datas e zera ambiente", () => {
    render(<CalendarEventModal {...p} />);
    fireEvent.change(field("Título"), { target: { value: "Nova visita" } });
    fireEvent.change(field("Tipo"), { target: { value: "reminder" } });
    fireEvent.change(field("Prioridade"), { target: { value: "urgent" } });
    fireEvent.change(field("Status"), { target: { value: "in_progress" } });
    fireEvent.change(field("Técnico"), { target: { value: "tec1" } });
    fireEvent.change(field("Descrição"), { target: { value: "Levar cabos" } });
    fireEvent.change(field("Início"), { target: { value: "2026-09-10T08:15" } });
    fireEvent.change(field("Término"), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("dialog"));
    expect(p.onSave).toHaveBeenCalledTimes(1);
    const payload = p.onSave.mock.calls[0][0];
    expect(payload).toEqual({
      title: "Nova visita",
      eventType: "reminder",
      status: "in_progress",
      priority: "urgent",
      startAt: new Date("2026-09-10T08:15").toISOString(),
      endAt: null,
      allDay: false,
      technicianId: "tec1",
      serviceOrderId: "",
      assetId: "",
      segmentId: "",
      groupId: "",
      description: "Levar cabos",
      environmentName: null
    });
  });

  it("dia inteiro envia o checkbox e mantém as datas", () => {
    render(<CalendarEventModal {...p} />);
    fireEvent.change(field("Título"), { target: { value: "Dia todo" } });
    fireEvent.click(field("Dia inteiro"));
    expect(field("Dia inteiro")).toBeChecked();
    fireEvent.submit(screen.getByRole("dialog"));
    const payload = p.onSave.mock.calls[0][0];
    expect(payload.allDay).toBe(true);
    expect(payload.endAt).toBe(new Date("2026-09-03T10:00").toISOString());
  });

  it("hierarquia: cada nível limpa os filhos e habilita o seguinte", () => {
    render(<CalendarEventModal {...p} />);
    expect(field("Grupo")).toBeDisabled();
    expect(field("Segmento")).toBeDisabled();
    expect(field("Máquina/ativo")).toBeDisabled();
    fireEvent.change(field("Aba"), { target: { value: "t1" } });
    expect(optionNames("Grupo")).toEqual(["Selecione o grupo", "Operação"]);
    fireEvent.change(field("Grupo"), { target: { value: "g1" } });
    expect(optionNames("Segmento")).toEqual(["Selecione o segmento", "Financeiro"]);
    fireEvent.change(field("Segmento"), { target: { value: "s1" } });
    expect(optionNames("Máquina/ativo")).toEqual(["Sem ativo vinculado", "PC Fin", "d4"]);
    fireEvent.change(field("Máquina/ativo"), { target: { value: "d1" } });
    fireEvent.change(field("Segmento"), { target: { value: "" } });
    expect(field("Máquina/ativo")).toHaveValue("");
    fireEvent.change(field("Segmento"), { target: { value: "s1" } });
    fireEvent.change(field("Grupo"), { target: { value: "" } });
    expect(field("Segmento")).toHaveValue("");
    fireEvent.change(field("Grupo"), { target: { value: "g1" } });
    fireEvent.change(field("Aba"), { target: { value: "t2" } });
    expect(field("Grupo")).toHaveValue("");
    expect(optionNames("Grupo")).toEqual(["Selecione o grupo", "Campo"]);
    fireEvent.change(field("Aba"), { target: { value: "" } });
    expect(field("Grupo")).toBeDisabled();
  });

  it("segmentos de outra aba não aparecem para o grupo", () => {
    const q = props();
    q.segments = [{ id: "sx", name: "Cruzado", groupId: "g1", tabId: "t2" }, ...q.segments];
    render(<CalendarEventModal {...q} />);
    fireEvent.change(field("Aba"), { target: { value: "t1" } });
    fireEvent.change(field("Grupo"), { target: { value: "g1" } });
    expect(optionNames("Segmento")).not.toContain("Cruzado");
  });

  it("escolher uma OS preenche ativo, segmento, grupo e aba", () => {
    render(<CalendarEventModal {...p} />);
    expect(optionNames("Ordem de Serviço")).toEqual(["Sem OS vinculada", "OS-1 · Rede", "OS-4 · Sem ativo", "OS-5 · Ativo na manutenção"]);
    fireEvent.change(field("Ordem de Serviço"), { target: { value: "os1" } });
    expect(field("Aba")).toHaveValue("t1");
    expect(field("Grupo")).toHaveValue("g1");
    expect(field("Segmento")).toHaveValue("s1");
    expect(field("Máquina/ativo")).toHaveValue("d1");
  });

  it("OS sem ativo mantém a hierarquia; OS de ativo em Manutenção não troca o segmento", () => {
    render(<CalendarEventModal {...p} />);
    fireEvent.change(field("Aba"), { target: { value: "t1" } });
    fireEvent.change(field("Ordem de Serviço"), { target: { value: "os4" } });
    expect(field("Aba")).toHaveValue("t1");
    expect(field("Segmento")).toBeDisabled();
    fireEvent.change(field("Ordem de Serviço"), { target: { value: "os5" } });
    expect(field("Segmento")).toHaveValue("");
    expect(field("Grupo")).toHaveValue("g1");
    fireEvent.change(field("Ordem de Serviço"), { target: { value: "" } });
    expect(field("Ordem de Serviço")).toHaveValue("");
  });

  it("infere aba/grupo/segmento a partir do ativo informado nos defaults", () => {
    render(<CalendarEventModal {...p} defaults={{ assetId: "d1" }} />);
    expect(field("Aba")).toHaveValue("t1");
    expect(field("Grupo")).toHaveValue("g1");
    expect(field("Segmento")).toHaveValue("s1");
    expect(field("Máquina/ativo")).toHaveValue("d1");
  });

  it("infere a aba pelo grupo ou pelo segmento do evento", () => {
    const { unmount } = render(<CalendarEventModal {...p} event={{ id: "e", status: "scheduled", title: "t", groupId: "g2" }} />);
    expect(field("Aba")).toHaveValue("t2");
    expect(field("Grupo")).toHaveValue("g2");
    unmount();
    render(<CalendarEventModal {...p} event={{ id: "e", status: "scheduled", title: "t", segmentId: "s4" }} />);
    expect(field("Aba")).toHaveValue("t2");
    expect(field("Grupo")).toHaveValue("g2");
    expect(field("Segmento")).toHaveValue("s4");
  });

  it("não infere nada quando o ativo não existe", () => {
    render(<CalendarEventModal {...p} defaults={{ assetId: "inexistente" }} />);
    expect(field("Aba")).toHaveValue("");
    expect(field("Máquina/ativo")).toBeDisabled();
  });

  it("reinicia o formulário quando o evento selecionado muda", () => {
    const { rerender } = render(<CalendarEventModal {...p} event={{ id: "a", status: "scheduled", title: "Primeiro" }} />);
    expect(field("Título")).toHaveValue("Primeiro");
    fireEvent.change(field("Título"), { target: { value: "Editado" } });
    rerender(<CalendarEventModal {...p} event={{ id: "b", status: "scheduled", title: "Segundo" }} />);
    expect(field("Título")).toHaveValue("Segundo");
  });
});
