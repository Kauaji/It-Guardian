import { createContext, useContext } from "react";

// Cria um contexto "fatia" do workspace: o hook de leitura falha com uma
// mensagem clara quando usado fora do provedor correspondente.
export function createSliceContext(name) {
  const Context = createContext(null);

  function useSlice() {
    const value = useContext(Context);
    if (!value) {
      throw new Error(`${name} precisa ser usado dentro do WorkspaceProvider.`);
    }
    return value;
  }

  return [Context.Provider, useSlice];
}
