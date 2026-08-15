import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PermissionBlocked from "./PermissionBlocked.jsx";

describe("PermissionBlocked", () => {
  it("informa que o acesso e negado e orienta a pedir liberacao a um administrador", () => {
    render(<PermissionBlocked />);
    expect(screen.getByRole("heading")).toHaveTextContent(/não possui permissão/i);
    expect(screen.getByText(/administrador/i)).toBeInTheDocument();
  });
});
