import React from "react";
import { isDynamicImportFailure, recoverFromAssetFailure } from "../../runtimeRecovery.js";

/**
 * Isola falhas de renderizacao por modulo (Inventario, OS, Avisos, Dashboard)
 * para que um erro em uma tela nao derrube o app inteiro. O AppErrorBoundary
 * global continua como rede de seguranca para qualquer coisa fora das telas
 * (sidebar, cabecalho).
 */
export default class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isDynamicImportFailure(error)) {
      recoverFromAssetFailure(error);
      return;
    }
    console.error(`Falha de renderizacao em "${this.props.label || "tela"}"`, {
      error,
      componentStack: info.componentStack
    });
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="view-error-fallback" role="alert">
        <h2>Não foi possível abrir {this.props.label || "esta tela"}</h2>
        <p>Ocorreu uma falha inesperada. Seus dados não foram alterados.</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          Tentar novamente
        </button>
      </div>
    );
  }
}
