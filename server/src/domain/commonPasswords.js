// Lista de senhas/radicais muito comuns (inclui as mais usadas em
// portugues). Comparada depois de normalizar (minusculas, sem simbolos,
// leetspeak simples) em passwordPolicy.js -- por isso basta guardar a forma
// base: "p@ssw0rd2024" e "Password123!" caem em "password".
export const commonPasswordRoots = new Set([
  "password", "passw0rd", "senha", "senhas", "senhaforte", "mudar", "mudarsenha",
  "admin", "administrador", "administrator", "root", "toor", "user", "usuario",
  "guest", "convidado", "login", "logon", "welcome", "bemvindo", "letmein",
  "qwerty", "qwertyuiop", "qwerty123", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm",
  "qazwsx", "1q2w3e", "1q2w3e4r", "1qaz2wsx", "q1w2e3r4", "abc123", "abcdef",
  "abcdefgh", "iloveyou", "teamo", "teamoo", "monkey", "dragon", "master",
  "shadow", "superman", "batman", "football", "futebol", "baseball", "soccer",
  "hockey", "mustang", "ranger", "harley", "buster", "tigger", "sunshine",
  "princess", "princesa", "freedom", "liberdade", "trustno1", "whatever",
  "starwars", "matrix", "computer", "computador", "internet", "secret", "segredo",
  "flamengo", "corinthians", "palmeiras", "saopaulo", "santos", "gremio",
  "internacional", "vasco", "cruzeiro", "botafogo", "fluminense", "atletico",
  "brasil", "brazil", "brasileiro", "saopaulo", "riodejaneiro", "minasgerais",
  "itguardian", "guardian", "suporte", "support", "helpdesk", "infra", "redes",
  "empresa", "company", "default", "changeme", "trocar", "trocarsenha", "temp",
  "temporaria", "teste", "test", "testing", "testes", "demo", "demonstracao",
  "mudar123", "senha123", "admin123", "teste123", "master123", "root123",
  "michael", "jennifer", "jessica", "nicole", "ashley", "daniel", "andrew",
  "thomas", "robert", "george", "charlie", "jordan", "hunter", "joshua",
  "maggie", "ginger", "pepper", "cheese", "amanda", "summer", "chelsea",
  "yankees", "dallas", "austin", "thunder", "taylor", "killer", "lovely",
  "pokemon", "naruto", "minecraft", "fortnite", "spiderman", "mickey", "snoopy",
  "jesus", "deus", "jesuscristo", "deusefiel", "familia", "amor", "meuamor",
  "gatinho", "cachorro", "lindo", "linda", "amigos", "amizade", "felicidade"
]);

// Sequencias e linhas de teclado: bloqueadas quando o texto normalizado e
// feito so delas (ou de repeticoes delas).
export const commonSequences = [
  "0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiopasdfghjklzxcvbnm", "qwertyuiop", "asdfghjkl", "zxcvbnm",
  "1qaz2wsx3edc4rfv", "azertyuiop", "qazwsxedcrfvtgb"
];
