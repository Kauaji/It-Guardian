// Rota da conta autenticada que NAO depende de permissao (toda pessoa logada
// pode ver e proteger a propria conta). Fica fora de `viewRoutes` de proposito:
// nao entra na sidebar nem na lista de visoes permitidas por perfil.
export const ACCOUNT_VIEW_ID = "account-security";
export const ACCOUNT_SECURITY_PATH = "/conta/seguranca";
export const ACCOUNT_SECURITY_LABEL = "Segurança da conta";
