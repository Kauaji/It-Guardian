import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithSession } from "../../test/identityHarness.jsx";
import UserMenu from "./UserMenu.jsx";

function Probe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function mount() {
  const { tree } = renderWithSession(
    <>
      <UserMenu />
      <Probe />
    </>
  );
  render(tree);
  return userEvent.setup();
}

describe("UserMenu", () => {
  it("abre com o nome/e-mail, foca o primeiro item e navega para a seguranca da conta", async () => {
    const user = mount();
    const button = screen.getByRole("button", { name: "Minha conta" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("ana@empresa.com")).toBeInTheDocument();
    const item = screen.getByRole("menuitem", { name: /Segurança da conta/ });
    expect(item).toHaveFocus();

    await user.click(item);
    expect(screen.getByTestId("path")).toHaveTextContent("/conta/seguranca");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Escape fecha e devolve o foco ao botao", async () => {
    const user = mount();
    const button = screen.getByRole("button", { name: "Minha conta" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("Tab e clique fora fecham o menu; clicar no botao alterna", async () => {
    const user = mount();
    const button = screen.getByRole("button", { name: "Minha conta" });
    await user.click(button);
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
