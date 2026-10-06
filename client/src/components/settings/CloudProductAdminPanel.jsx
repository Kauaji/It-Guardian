import CloudAdminHeader from "./cloud/CloudAdminHeader.jsx";
import ActivationList from "./cloud/ActivationList.jsx";
import IntegrationGrid from "./cloud/IntegrationGrid.jsx";
import ProductKeyList from "./cloud/ProductKeyList.jsx";
import { KeyRevealCard, ProductKeyForm } from "./cloud/ProductKeyForm.jsx";
import { defaultInstallerUrl } from "./cloud/cloudAdminModel.js";
import { useCloudAdmin } from "./cloud/useCloudAdmin.js";

export default function CloudProductAdminPanel({ token, notify }) {
  const admin = useCloudAdmin(token, notify);
  const installerUrl = import.meta.env.VITE_COLLECTOR_INSTALLER_URL || defaultInstallerUrl;

  return (
    <div className="cloud-admin-panel">
      <CloudAdminHeader installerUrl={installerUrl} />

      <div className="cloud-admin-create-layout">
        <ProductKeyForm
          form={admin.form}
          setForm={admin.setForm}
          busy={admin.busyAction === "create-key"}
          onSubmit={admin.submitProductKey}
        />
        <KeyRevealCard createdKey={admin.createdKey} onCopy={admin.copyCreatedKey} />
      </div>

      <ProductKeyList
        productKeys={admin.productKeys}
        loading={admin.loading}
        selectedKeyId={admin.selectedKeyId}
        busyAction={admin.busyAction}
        onRefresh={admin.loadProductKeys}
        onSelect={admin.setSelectedKeyId}
        onChangeStatus={admin.changeProductKeyStatus}
      />

      {admin.selectedKey && (
        <ActivationList
          selectedKey={admin.selectedKey}
          activations={admin.activations}
          loading={admin.busyAction === `activations:${admin.selectedKeyId}`}
          busyAction={admin.busyAction}
          onDeactivate={admin.deactivateActivation}
        />
      )}

      <IntegrationGrid
        integrations={admin.integrations}
        busyAction={admin.busyAction}
        onRun={admin.runIntegrationAction}
      />
    </div>
  );
}
