/**
 * Fachada historica da assistencia remota. A implementacao foi dividida por
 * responsabilidade em services/remoteAssistance/*:
 *
 * - remoteAssistanceAudit:   auditoria, encerramento automatico e limpeza do relay
 * - remoteAssistanceGuards:  autenticacao de tecnico/agente/visualizador e sessao publica
 * - remoteAssistanceSessionService: inicio/consulta/encerramento pelo tecnico e configuracao publica
 * - remoteAssistanceViewerService:  quadros, chat, entrada, monitor, controle e WebRTC do tecnico
 * - remoteAssistanceAgentService:   consentimento, quadros, comandos e WebRTC do agente
 *
 * As regras puras (entrada permitida, normalizacao, token) estao em
 * domain/remoteAssistance/* e domain/remoteAssistancePolicy.js.
 */
export { closeAbandonedRemoteAssistanceSessions, endRemoteAssistanceSessionsOnLogout } from "./remoteAssistance/remoteAssistanceAudit.js";
export {
  endRemoteAssistanceByTechnician,
  getRemoteAssistanceEventIntegrity,
  getRemoteAssistanceEvents,
  getRemoteAssistancePublicConfig,
  getRemoteAssistanceSession,
  reportAgentRustdeskId,
  startRemoteAssistanceSession
} from "./remoteAssistance/remoteAssistanceSessionService.js";
export {
  getRemoteAssistanceFrame,
  getRemoteAssistanceRustdeskCredentials,
  getRemoteAssistanceWebrtcAnswer,
  selectRemoteAssistanceMonitor,
  sendRemoteAssistanceChatMessage,
  sendRemoteAssistanceInput,
  submitRemoteAssistanceWebrtcOffer,
  updateRemoteAssistanceCapture,
  updateRemoteAssistanceControl
} from "./remoteAssistance/remoteAssistanceViewerService.js";
export {
  endRemoteAssistanceByAgent,
  getPendingRemoteAssistanceForAgent,
  getRemoteAssistanceCommandsForAgent,
  getRemoteAssistanceWebrtcOfferForAgent,
  receiveRemoteAssistanceFrame,
  respondToRemoteAssistanceConsent,
  sendRemoteAssistanceChatMessageFromAgent,
  submitRemoteAssistanceWebrtcAnswer
} from "./remoteAssistance/remoteAssistanceAgentService.js";
