import { normalizeFeedbackRating } from "../../domain/serviceOrders/serviceOrderFeedback.js";
import { upsertServiceOrderFeedback } from "../../repositories/serviceOrders/serviceOrderFeedbackRepository.js";
import { addServiceOrderAssetHistory, addServiceOrderHistory } from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { findServiceOrderById } from "../../repositories/serviceOrders/serviceOrderReadRepository.js";

// Avaliacao interna (registrada por admin/tecnico dentro da OS) - sem
// fluxo de link publico com token nesta rodada. Uma avaliacao por OS
// (indice unico) - reenviar atualiza a existente.
export async function submitServiceOrderFeedback({ id, rating, comment, user, source = "internal" }) {
  const current = await findServiceOrderById(id);
  if (!current) return null;

  const normalizedRating = normalizeFeedbackRating(rating);
  const feedback = await upsertServiceOrderFeedback({
    serviceOrderId: id,
    rating: normalizedRating,
    comment,
    user,
    source
  });

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "feedback_submitted",
    message: `Avaliação registrada: ${normalizedRating}/5.`,
    newValue: String(normalizedRating),
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "feedback_submitted",
    message: `avaliação registrada: ${normalizedRating}/5.`,
    newValue: String(normalizedRating),
    user
  });

  return feedback;
}
