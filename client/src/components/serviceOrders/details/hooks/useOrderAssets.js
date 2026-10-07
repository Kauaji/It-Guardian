import { useEffect, useMemo, useState } from "react";
import { fetchDevice } from "../../../../api.js";
import { filterAvailableBackups } from "../utils/assetLink.js";

// Maquina da OS (ficha completa quando carregada), backup vinculado e backups livres.
export function useOrderAssets({ serviceOrder, devices, token }) {
  const [assetDetails, setAssetDetails] = useState(null);

  useEffect(() => {
    let active = true;
    setAssetDetails(null);

    if (!serviceOrder?.assetId || !token) return undefined;

    fetchDevice(token, serviceOrder.assetId)
      .then((response) => {
        if (active) setAssetDetails(response.device);
      })
      .catch(() => {
        if (active) setAssetDetails(null);
      });

    return () => {
      active = false;
    };
  }, [serviceOrder?.assetId, token]);

  const asset = useMemo(
    () => assetDetails || devices.find((device) => device.id === serviceOrder?.assetId),
    [assetDetails, devices, serviceOrder?.assetId]
  );
  const backupAsset = useMemo(
    () => devices.find((device) => device.id === serviceOrder?.backupAssetId) || null,
    [devices, serviceOrder?.backupAssetId]
  );
  const availableBackupDevices = useMemo(
    () => filterAvailableBackups(devices, serviceOrder),
    [devices, serviceOrder?.assetId, serviceOrder?.backupAssetId]
  );

  return { asset, backupAsset, availableBackupDevices };
}
