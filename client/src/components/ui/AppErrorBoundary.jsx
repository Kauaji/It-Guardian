import React from "react";
import { isDynamicImportFailure, recoverFromAssetFailure } from "../../runtimeRecovery.js";

export default class AppErrorBoundary extends React.Component {
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
    console.error("Falha de renderização no frontend", { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-runtime-fallback" role="alert">
        <h1>Não foi possível exibir esta tela</h1>
        <p>O IT Guardian encontrou uma falha inesperada. Seus dados não foram alterados.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </main>
    );
  }
}
