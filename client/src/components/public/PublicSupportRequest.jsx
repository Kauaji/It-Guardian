import { ShieldCheck } from "lucide-react";
import PublicSupportForm from "./PublicSupportForm.jsx";
import PublicSupportSummary from "./PublicSupportSummary.jsx";
import PublicSupportSuccess from "./PublicSupportSuccess.jsx";
import { usePublicSupportRequest } from "./support/usePublicSupportRequest.js";

function PublicSupportHeader() {
  return (
    <header className="public-support-header">
      <div className="public-support-brand">
        <ShieldCheck size={34} />
        <div>
          <strong>IT Guardian</strong>
          <span>Monitoramento e suporte</span>
        </div>
      </div>
      <div>
        <h1>Abrir chamado de suporte</h1>
        <p>
          Descreva o problema encontrado. A equipe técnica receberá sua solicitação e acompanhará o
          atendimento pelo IT Guardian. Esta tela não dá acesso ao painel administrativo.
        </p>
      </div>
    </header>
  );
}

export default function PublicSupportRequest() {
  const request = usePublicSupportRequest();

  if (request.success) {
    return <PublicSupportSuccess success={request.success} onReset={() => window.location.reload()} />;
  }

  return (
    <main className="public-support-page">
      <section className="public-support-card">
        <PublicSupportHeader />

        {request.step === "form" ? (
          <PublicSupportForm
            form={request.form}
            options={request.options}
            businessMode={request.businessMode}
            deviceToken={request.machineContext.deviceToken}
            machineContextLoading={request.machineContextLoading}
            machineContextError={request.machineContextError}
            machine={request.machine}
            updateField={request.updateField}
            updateCategory={request.updateCategory}
            updateProblemType={request.updateProblemType}
            error={request.error}
            onSubmit={request.goToSummary}
          />
        ) : (
          <PublicSupportSummary
            form={request.form}
            machine={request.machine}
            loading={request.loading}
            error={request.error}
            onBack={() => request.setStep("form")}
            onConfirm={request.confirmSubmit}
          />
        )}
      </section>
    </main>
  );
}
