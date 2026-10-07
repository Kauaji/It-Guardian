using System;
using System.Collections.Generic;
using System.IO;
using System.Numerics;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using ITGuardian.Windows;

// Mini framework de testes do agente Windows (sem NuGet, sem NUnit).
// Compila com ITGuardian.Signing.cs, ITGuardian.Policy.cs, ITGuardian.Config.cs
// e ITGuardian.Logging.cs -- nada de WinForms/WMI -- e roda igual em Mono
// (run-tests.sh) e no .NET Framework (Run-Tests.ps1). Codigo de saida != 0 se
// qualquer caso falhar.
namespace ITGuardian.Tests
{
    internal sealed class AssertionFailed : Exception
    {
        internal AssertionFailed(string message) : base(message) { }
    }

    internal static class Check
    {
        internal static void True(bool condition, string message)
        {
            if (!condition) throw new AssertionFailed(message);
        }

        internal static void False(bool condition, string message)
        {
            if (condition) throw new AssertionFailed(message);
        }

        internal static void Equal<T>(T expected, T actual, string message)
        {
            if (!EqualityComparer<T>.Default.Equals(expected, actual))
            {
                throw new AssertionFailed(message + " (esperado: <" + expected + ">, obtido: <" + actual + ">)");
            }
        }

        internal static void Contains(string text, string fragment, string message)
        {
            if (text == null || text.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) < 0)
            {
                throw new AssertionFailed(message + " (esperava conter \"" + fragment + "\" em: " + text + ")");
            }
        }

        internal static void Refused(GateDecision decision, string reasonFragment, string message)
        {
            False(decision.Allowed, message + " -- deveria ser RECUSADO, mas foi: " + decision);
            if (reasonFragment != null) Contains(decision.Reason, reasonFragment, message + " -- motivo");
        }

        internal static void Allowed(GateDecision decision, string message)
        {
            True(decision.Allowed, message + " -- deveria ser PERMITIDO, mas foi: " + decision);
        }

        internal static void Throws<TException>(Action action, string message) where TException : Exception
        {
            try
            {
                action();
            }
            catch (TException)
            {
                return;
            }
            throw new AssertionFailed(message + " (esperava " + typeof(TException).Name + ")");
        }
    }

    internal sealed class TestCase
    {
        internal string Name;
        internal Action Body;
    }

    internal static class TestRunner
    {
        private static readonly List<TestCase> Cases = new List<TestCase>();

        internal static void Add(string name, Action body)
        {
            Cases.Add(new TestCase { Name = name, Body = body });
        }

        internal static int Main(string[] args)
        {
            TestPaths.Initialize(args);
            Log.Sink = delegate { }; // testes que precisam das linhas instalam o proprio Sink
            SigningTests.Register();
            MessageTests.Register();
            VersionTests.Register();
            UpdateGateTests.Register();
            JobGateTests.Register();
            ReplayStoreTests.Register();
            ConfigTests.Register();
            LogTests.Register();
            SourceHygieneTests.Register();

            int passed = 0;
            List<string> failures = new List<string>();
            foreach (TestCase test in Cases)
            {
                Log.ResetForTests();
                Log.Sink = delegate { };
                Log.UtcNow = delegate { return DateTime.UtcNow; };
                try
                {
                    test.Body();
                    passed++;
                    Console.WriteLine("  ok   " + test.Name);
                }
                catch (Exception error)
                {
                    failures.Add(test.Name);
                    Console.WriteLine("  FAIL " + test.Name);
                    Console.WriteLine("       " + error.GetType().Name + ": " + error.Message);
                }
            }
            Console.WriteLine();
            Console.WriteLine("Resultado: " + passed + " passaram, " + failures.Count + " falharam, " + Cases.Count + " no total.");
            if (failures.Count > 0)
            {
                Console.WriteLine("Falhas:");
                foreach (string name in failures) Console.WriteLine("  - " + name);
                return 1;
            }
            return 0;
        }
    }

    internal static class TestPaths
    {
        internal static string AgentDirectory;
        internal static string TestsDirectory;

        internal static void Initialize(string[] args)
        {
            string start = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
            DirectoryInfo directory = new DirectoryInfo(start);
            while (directory != null && !File.Exists(Path.Combine(directory.FullName, "ITGuardian.Windows.cs")))
            {
                if (File.Exists(Path.Combine(directory.FullName, "agent", "windows", "ITGuardian.Windows.cs")))
                {
                    directory = new DirectoryInfo(Path.Combine(directory.FullName, "agent", "windows"));
                    break;
                }
                directory = directory.Parent;
            }
            if (directory == null) throw new InvalidOperationException("Nao achei agent/windows a partir de " + start);
            AgentDirectory = directory.FullName;
            TestsDirectory = Path.Combine(AgentDirectory, "tests");
        }

        internal static string NewTempDirectory()
        {
            string path = Path.Combine(Path.GetTempPath(), "itg-tests-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(path);
            return path;
        }
    }

    // ---- vetores ---------------------------------------------------------------------------------

    internal sealed class Vector
    {
        internal string Name;
        internal string Kind;
        internal string PublicKey;
        internal string Message;
        internal string Signature;
        internal bool StrictOnly;
        internal Dictionary<string, object> Fields;
        internal string Expect;
    }

    internal static class Vectors
    {
        private static Dictionary<string, object> root;

        private static Dictionary<string, object> Root
        {
            get
            {
                if (root == null)
                {
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = int.MaxValue;
                    string text = File.ReadAllText(Path.Combine(TestPaths.TestsDirectory, "signing-vectors.json"), Encoding.UTF8);
                    root = (Dictionary<string, object>)serializer.DeserializeObject(text);
                }
                return root;
            }
        }

        private static string Str(Dictionary<string, object> item, string key)
        {
            object value;
            return item.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : null;
        }

        private static List<Vector> Load(string section)
        {
            List<Vector> list = new List<Vector>();
            foreach (object raw in (object[])Root[section])
            {
                Dictionary<string, object> item = (Dictionary<string, object>)raw;
                Vector vector = new Vector();
                vector.Name = Str(item, "name");
                vector.Kind = Str(item, "kind");
                vector.PublicKey = Str(item, "publicKey");
                vector.Message = Str(item, "message");
                vector.Signature = Str(item, "signature");
                vector.Expect = Str(item, "expect");
                object strict;
                vector.StrictOnly = item.TryGetValue("strictOnly", out strict) && Convert.ToBoolean(strict);
                object fields;
                if (item.TryGetValue("fields", out fields)) vector.Fields = (Dictionary<string, object>)fields;
                list.Add(vector);
            }
            return list;
        }

        internal static List<Vector> Positives() { return Load("positives"); }
        internal static List<Vector> Negatives() { return Load("negatives"); }
        internal static List<Vector> UpdateScenarios() { return Load("updateScenarios"); }

        internal static string F(Vector vector, string key) { return Str(vector.Fields, key); }
        internal static long L(Vector vector, string key) { return Convert.ToInt64(vector.Fields[key]); }

        internal static Vector FirstJob()
        {
            foreach (Vector vector in Positives()) if (vector.Kind == "job") return vector;
            throw new InvalidOperationException("sem vetor de job");
        }

        internal static List<Vector> Jobs(int max)
        {
            List<Vector> jobs = new List<Vector>();
            foreach (Vector vector in Positives())
            {
                if (vector.Kind == "job") jobs.Add(vector);
                if (jobs.Count >= max) break;
            }
            return jobs;
        }

        internal static SignedJob ToSignedJob(Vector vector)
        {
            SignedJob job = new SignedJob();
            job.JobId = F(vector, "jobId");
            job.AssetId = F(vector, "assetId");
            job.Interpreter = F(vector, "interpreter");
            job.TimeoutSeconds = L(vector, "timeoutSeconds");
            job.Content = F(vector, "content");
            job.Signature = vector.Signature;
            job.NotAfter = L(vector, "notAfter");
            return job;
        }
    }

    // ---- assinatura ------------------------------------------------------------------------------

    internal static class SigningTests
    {
        internal static void Register()
        {
            TestRunner.Add("curva P-256: G esta na curva e 2G tem o X conhecido", delegate
            {
                Check.True(P256Curve.IsOnCurve(P256Curve.Gx, P256Curve.Gy), "G na curva");
                JacobianPoint g = JacobianPoint.FromAffine(P256Curve.Gx, P256Curve.Gy);
                JacobianPoint twoG = JacobianPoint.Double(g);
                Check.Equal(
                    "7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978",
                    JacobianPoint.AffineX(twoG).ToString("X").TrimStart('0'),
                    "X de 2G");
                JacobianPoint viaAdd = JacobianPoint.Add(g, g);
                Check.Equal(JacobianPoint.AffineX(twoG), JacobianPoint.AffineX(viaAdd), "G+G == 2G");
                JacobianPoint threeA = JacobianPoint.Add(twoG, g);
                JacobianPoint threeB = JacobianPoint.Add(g, twoG);
                Check.Equal(JacobianPoint.AffineX(threeA), JacobianPoint.AffineX(threeB), "2G+G == G+2G");
            });

            TestRunner.Add("curva P-256: pontos fora da curva e coordenadas fora de [0,p) sao recusados", delegate
            {
                Check.False(P256Curve.IsOnCurve(P256Curve.Gx, P256Curve.Gy + 1), "Y alterado");
                Check.False(P256Curve.IsOnCurve(BigInteger.Zero, BigInteger.Zero), "(0,0)");
                Check.False(P256Curve.IsOnCurve(P256Curve.Gx + P256Curve.P, P256Curve.Gy), "X >= p");
                Check.False(P256Curve.IsOnCurve(BigInteger.MinusOne, P256Curve.Gy), "X negativo");
            });

            TestRunner.Add("vetores do Node: TODOS os positivos (>=200) verificam e a mensagem reconstruida e identica", delegate
            {
                List<Vector> positives = Vectors.Positives();
                Check.True(positives.Count >= 200, "pelo menos 200 positivos; ha " + positives.Count);
                int updates = 0, jobs = 0;
                foreach (Vector vector in positives)
                {
                    string error;
                    Check.True(
                        SignatureVerifier.TryVerifyText(vector.PublicKey, vector.Message, vector.Signature, out error),
                        "positivo " + vector.Kind + " recusado: " + error);
                    Check.Equal<string>(null, error, "erro nulo quando valido");
                    string rebuilt;
                    if (vector.Kind == "update")
                    {
                        updates++;
                        rebuilt = UpdateMessage.Build(Vectors.F(vector, "version"), Vectors.F(vector, "sha256"), Vectors.F(vector, "url"));
                    }
                    else
                    {
                        jobs++;
                        string contentHash = Hashing.Sha256HexOfText(Vectors.F(vector, "content"));
                        Check.Equal(Vectors.F(vector, "contentSha256"), contentHash, "SHA-256 do conteudo (UTF-8) igual ao do Node");
                        rebuilt = JobMessage.Build(
                            Vectors.F(vector, "jobId"), Vectors.F(vector, "assetId"), Vectors.F(vector, "interpreter"),
                            Vectors.L(vector, "timeoutSeconds"), contentHash, Vectors.L(vector, "notAfter"));
                    }
                    Check.Equal(vector.Message, rebuilt, "mensagem reconstruida pelo C# == mensagem do Node");
                }
                Check.True(updates >= 100 && jobs >= 100, "mistura de updates e jobs (" + updates + "/" + jobs + ")");
            });

            TestRunner.Add("vetores do Node: TODOS os negativos sao recusados, com motivo", delegate
            {
                List<Vector> negatives = Vectors.Negatives();
                Check.True(negatives.Count >= 100, "negativos suficientes: " + negatives.Count);
                foreach (Vector vector in negatives)
                {
                    string error;
                    bool ok = SignatureVerifier.TryVerifyText(vector.PublicKey, vector.Message, vector.Signature, out error);
                    Check.False(ok, "negativo ACEITO: " + vector.Name);
                    Check.True(!string.IsNullOrEmpty(error), "negativo sem motivo: " + vector.Name);
                }
            });

            TestRunner.Add("verificacao nunca lanca com entradas lixo", delegate
            {
                string error;
                Vector reference = Vectors.Positives()[0];
                Check.False(SignatureVerifier.TryVerify(null, new byte[0], null, out error), "tudo nulo");
                Check.False(SignatureVerifier.TryVerify(reference.PublicKey, null, reference.Signature, out error), "mensagem nula");
                Check.False(SignatureVerifier.TryVerifyText(reference.PublicKey, null, reference.Signature, out error), "texto nulo");
                Check.False(SignatureVerifier.TryVerify("!!!", new byte[] { 1 }, "!!!", out error), "base64 invalido");
                Check.False(SignatureVerifier.TryVerify(reference.PublicKey, new byte[] { 1 }, "   ", out error), "assinatura em branco");
                Check.Contains(error, "ausente", "motivo de assinatura em branco");
            });

            TestRunner.Add("chave publica: so SPKI P-256 de 91 bytes na curva e aceita", delegate
            {
                Vector reference = Vectors.Positives()[0];
                Check.True(SignatureVerifier.IsValidPublicKey(reference.PublicKey), "chave valida");
                Check.True(SignatureVerifier.IsValidPublicKey("  " + reference.PublicKey + "\n"), "espacos ao redor tolerados");
                foreach (Vector vector in Vectors.Negatives())
                {
                    if (!vector.Name.StartsWith("chave:")) continue;
                    Check.False(SignatureVerifier.IsValidPublicKey(vector.PublicKey), "chave invalida aceita: " + vector.Name);
                }
            });

            TestRunner.Add("z do hash e inteiro nao negativo (byte de sinal): assinaturas com hash de bit alto verificam", delegate
            {
                // ~metade dos hashes SHA-256 tem o bit alto ligado; os 240 positivos cobrem os dois casos.
                int highBit = 0;
                foreach (Vector vector in Vectors.Positives())
                {
                    byte[] digest = System.Security.Cryptography.SHA256.Create().ComputeHash(new UTF8Encoding(false).GetBytes(vector.Message));
                    if ((digest[0] & 0x80) != 0) highBit++;
                }
                Check.True(highBit >= 50 && highBit <= 190, "vetores cobrem hashes com bit alto ligado e desligado (" + highBit + ")");
                Check.True(P256Curve.FromBigEndian(new byte[] { 0xFF, 0xFF }, 0, 2) == new BigInteger(65535), "FromBigEndian nao negativo");
            });
        }
    }

    // ---- construtores de mensagem ----------------------------------------------------------------

    internal static class MessageTests
    {
        internal static void Register()
        {
            TestRunner.Add("mensagem de atualizacao: formato exato, sha minusculo, sem \\n final", delegate
            {
                string message = UpdateMessage.Build("1.7.0", new string('A', 64), "https://x/y.exe");
                Check.Equal("ITG-UPDATE-V1\nversion=1.7.0\nsha256=" + new string('a', 64) + "\nurl=https://x/y.exe", message, "formato");
                Check.False(message.EndsWith("\n"), "sem newline final");
            });

            TestRunner.Add("mensagem de job: formato exato", delegate
            {
                string message = JobMessage.Build("j1", "a1", "powershell", 120, new string('B', 64), 1700000900L);
                Check.Equal(
                    "ITG-JOB-V1\njobId=j1\nassetId=a1\ninterpreter=powershell\ntimeoutSeconds=120\ncontentSha256=" +
                    new string('b', 64) + "\nnotAfter=1700000900",
                    message, "formato");
            });

            TestRunner.Add("campos com CR ou LF sao recusados (injecao de campo)", delegate
            {
                Check.Throws<ArgumentException>(delegate { UpdateMessage.Build("1\nsha256=" + new string('0', 64), "a", "https://x"); }, "LF em version");
                Check.Throws<ArgumentException>(delegate { UpdateMessage.Build("1", "a", "https://x\r"); }, "CR em url");
                Check.Throws<ArgumentException>(delegate { JobMessage.Build("j\n", "a", "cmd", 15, "h", 1); }, "LF em jobId");
                Check.Throws<ArgumentException>(delegate { JobMessage.Build("j", "a\r\nnotAfter=9", "cmd", 15, "h", 1); }, "CRLF em assetId");
                Check.Throws<ArgumentException>(delegate { JobMessage.Build("j", "a", "cmd\n", 15, "h", 1); }, "LF em interpreter");
            });

            TestRunner.Add("SHA-256 de texto: UTF-8 sem BOM, hex minusculo", delegate
            {
                Check.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", Hashing.Sha256HexOfText(""), "vazio");
                Check.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Hashing.Sha256HexOfText("abc"), "abc");
                Check.Equal(Hashing.Sha256HexOfText(null), Hashing.Sha256HexOfText(""), "nulo == vazio");
            });
        }
    }

    // ---- comparador de versao --------------------------------------------------------------------

    internal static class VersionTests
    {
        internal static void Register()
        {
            TestRunner.Add("comparador de versao: ordem numerica por segmento (como o servidor)", delegate
            {
                Check.True(VersionComparer.Compare("1.10.0", "1.9.0") > 0, "1.10.0 > 1.9.0 (nao e comparacao de string)");
                Check.True(VersionComparer.Compare("1.6.5", "1.6.4") > 0, "patch");
                Check.True(VersionComparer.Compare("2.0", "1.99.99") > 0, "major");
                Check.True(VersionComparer.Compare("1.6.4", "1.6.5") < 0, "menor");
                Check.Equal(0, VersionComparer.Compare("1.6.4", "1.6.4"), "igual");
                Check.Equal(0, VersionComparer.Compare("1.6.4.0", "1.6.4"), "segmento ausente vale 0");
                Check.True(VersionComparer.Compare("1.6.4.1", "1.6.4") > 0, "quarto segmento");
                Check.True(VersionComparer.Compare("1.6.x", "1.6.1") < 0, "segmento nao numerico vale 0");
                Check.True(VersionComparer.Compare(null, "0.0.1") < 0, "nulo vale 0");
            });

            TestRunner.Add("versao oferecida precisa ser ESTRITAMENTE maior (igual e menor sao recusadas)", delegate
            {
                Check.True(VersionComparer.IsStrictlyNewer("1.6.5", "1.6.4"), "maior");
                Check.False(VersionComparer.IsStrictlyNewer("1.6.4", "1.6.4"), "igual");
                Check.False(VersionComparer.IsStrictlyNewer("1.6.4.0", "1.6.4"), "igual com zero a mais");
                Check.False(VersionComparer.IsStrictlyNewer("1.6.3", "1.6.4"), "menor (downgrade)");
            });

            TestRunner.Add("formato estrito de versao oferecida", delegate
            {
                string[] good = { "1", "1.6", "1.6.4", "1.6.4.0", "10.20.30.40", "999999999.0" };
                string[] bad = { "", null, " 1.6.4", "1.6.4 ", "1.6.4-beta", "1..4", ".1", "1.", "a.b", "1.2.3.4.5", "1.6.4\n", "1000000000.0", "v1.6", "1,6" };
                foreach (string value in good) Check.True(VersionComparer.IsStrictVersion(value), "deveria ser valida: " + value);
                foreach (string value in bad) Check.False(VersionComparer.IsStrictVersion(value), "deveria ser invalida: " + value);
            });
        }
    }

    // ---- portao de atualizacao -------------------------------------------------------------------

    internal static class UpdateGateTests
    {
        private const string Current = "0.0.1";

        private static AgentConfig Config(string key, bool allowUnsigned)
        {
            AgentConfig config = new AgentConfig();
            config.serverUrl = "https://servidor.local";
            config.releasePublicKey = key;
            config.allowUnsignedUpdates = allowUnsigned;
            return config;
        }

        private static Vector FirstUpdate()
        {
            foreach (Vector vector in Vectors.Positives()) if (vector.Kind == "update") return vector;
            throw new InvalidOperationException("sem vetor de update");
        }

        private static GateDecision Evaluate(AgentConfig config, string current, Vector vector)
        {
            return UpdateGate.Evaluate(
                config, current, Vectors.F(vector, "version"), Vectors.F(vector, "url"), Vectors.F(vector, "sha256"), vector.Signature);
        }

        internal static void Register()
        {
            TestRunner.Add("update: SEGURO POR PADRAO -- sem releasePublicKey e sem opt-out, ignora (mesmo com assinatura valida)", delegate
            {
                Vector vector = FirstUpdate();
                GateDecision decision = Evaluate(Config(null, false), Current, vector);
                Check.Refused(decision, "releasePublicKey nao configurada", "sem chave");
                Check.Refused(Evaluate(Config("", false), Current, vector), "releasePublicKey nao configurada", "chave vazia");
                Check.Refused(Evaluate(Config("   ", false), Current, vector), "releasePublicKey nao configurada", "chave em branco");
                Check.Refused(UpdateGate.Evaluate(Config(null, false), Current, "9.9.9", "https://x/y.exe", new string('a', 64), null), "releasePublicKey", "sem assinatura");
                Check.Refused(UpdateGate.Evaluate(null, Current, "9.9.9", "https://x/y.exe", new string('a', 64), null), "configuracao", "config nula");
            });

            TestRunner.Add("update: opt-out allowUnsignedUpdates sem chave permite, com AVISO obrigatorio", delegate
            {
                GateDecision decision = UpdateGate.Evaluate(
                    Config(null, true), "1.6.4", "1.7.0", "https://releases.local/ITGuardian.exe", new string('a', 64), null);
                Check.Allowed(decision, "opt-out");
                Check.True(!string.IsNullOrEmpty(decision.Warning), "aviso presente");
                Check.Contains(decision.Warning, "SEM verificar assinatura", "texto do aviso");
            });

            TestRunner.Add("update: opt-out NAO dispensa as demais regras (https, versao maior, hash, formato)", delegate
            {
                AgentConfig config = Config(null, true);
                string sha = new string('a', 64);
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.7.0", "http://x/y.exe", sha, null), "HTTPS", "http");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.6.4", "https://x/y.exe", sha, null), "estritamente maior", "igual");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.6.3", "https://x/y.exe", sha, null), "estritamente maior", "downgrade");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.7.0", "https://x/y.exe", "abc", null), "SHA-256", "hash curto");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "", "https://x/y.exe", sha, null), "incompleta", "sem versao");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.7.0", "", sha, null), "incompleta", "sem URL");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.7.0", "https://x/y.exe", "", null), "incompleta", "sem hash");
                Check.Refused(UpdateGate.Evaluate(config, "1.6.4", "1.7.0-beta", "https://x/y.exe", sha, null), "formato", "versao fora do formato");
            });

            TestRunner.Add("update: com chave, assinatura valida e aceita (todos os vetores de update)", delegate
            {
                int count = 0;
                foreach (Vector vector in Vectors.Positives())
                {
                    if (vector.Kind != "update") continue;
                    GateDecision decision = Evaluate(Config(vector.PublicKey, false), Current, vector);
                    Check.Allowed(decision, "update assinado");
                    Check.True(decision.Warning == null, "sem aviso quando assinado");
                    count++;
                }
                Check.True(count >= 100, "cobriu varios vetores: " + count);
            });

            TestRunner.Add("update: com chave, assinatura ausente/vazia/lixo/outra chave e recusada", delegate
            {
                Vector vector = FirstUpdate();
                AgentConfig config = Config(vector.PublicKey, false);
                string version = Vectors.F(vector, "version"), url = Vectors.F(vector, "url"), sha = Vectors.F(vector, "sha256");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, sha, null), "sem assinatura", "nula");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, sha, ""), "sem assinatura", "vazia");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, sha, "   "), "sem assinatura", "branca");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, sha, "lixo!!"), "recusada", "lixo");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, sha, Convert.ToBase64String(new byte[64])), "recusada", "zeros");
                Vector other = null;
                foreach (Vector candidate in Vectors.Positives()) if (candidate.PublicKey != vector.PublicKey) { other = candidate; break; }
                Check.Refused(Evaluate(Config(other.PublicKey, false), Current, vector), "recusada", "chave de outro emissor");
            });

            TestRunner.Add("update: allowUnsignedUpdates NAO contorna a assinatura quando ha chave configurada", delegate
            {
                Vector vector = FirstUpdate();
                AgentConfig config = Config(vector.PublicKey, true);
                Check.Refused(
                    UpdateGate.Evaluate(config, Current, Vectors.F(vector, "version"), Vectors.F(vector, "url"), Vectors.F(vector, "sha256"), null),
                    "sem assinatura", "opt-out + chave + sem assinatura");
                Check.Allowed(Evaluate(config, Current, vector), "opt-out + chave + assinatura valida continua valendo");
            });

            TestRunner.Add("update: qualquer campo alterado (versao, hash, URL) invalida a assinatura", delegate
            {
                Vector vector = FirstUpdate();
                AgentConfig config = Config(vector.PublicKey, false);
                string version = Vectors.F(vector, "version"), url = Vectors.F(vector, "url"), sha = Vectors.F(vector, "sha256");
                Check.Refused(UpdateGate.Evaluate(config, Current, "99.0.0", url, sha, vector.Signature), "recusada", "versao");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url, new string('0', 64), vector.Signature), "recusada", "hash");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, "https://atacante.local/ITGuardian.exe", sha, vector.Signature), "recusada", "URL");
                Check.Refused(UpdateGate.Evaluate(config, Current, version, url + "\n", sha, vector.Signature), null, "URL com LF (campo invalido na mensagem)");
            });

            TestRunner.Add("update: manifesto assinado de versao igual ou menor e recusado (anti-downgrade/replay de manifesto antigo)", delegate
            {
                Vector vector = FirstUpdate();
                AgentConfig config = Config(vector.PublicKey, false);
                string version = Vectors.F(vector, "version");
                Check.Refused(Evaluate(config, version, vector), "estritamente maior", "versao atual == oferecida");
                Check.Refused(Evaluate(config, "99.0.0", vector), "estritamente maior", "agente mais novo que o manifesto");
            });

            TestRunner.Add("update: chave configurada mas invalida recusa tudo", delegate
            {
                Vector vector = FirstUpdate();
                Check.Refused(Evaluate(Config("nao-e-chave", false), Current, vector), "recusada", "lixo");
                Check.Refused(Evaluate(Config(Convert.ToBase64String(new byte[91]), false), Current, vector), "recusada", "91 zeros");
            });

            TestRunner.Add("update: cenarios malformados e assinados (http, ftp, hash, versao) -- recusa mesmo com assinatura valida", delegate
            {
                foreach (Vector scenario in Vectors.UpdateScenarios())
                {
                    AgentConfig config = Config(scenario.PublicKey, false);
                    GateDecision decision = UpdateGate.Evaluate(
                        config, "1.6.4", Vectors.F(scenario, "version"), Vectors.F(scenario, "url"), Vectors.F(scenario, "sha256"), scenario.Signature);
                    if (scenario.Expect == "allowed") Check.Allowed(decision, scenario.Name);
                    else Check.Refused(decision, null, scenario.Name);
                }
            });

            TestRunner.Add("update: cenario normal e igual/menor que a versao atual (9.9.9) e recusado", delegate
            {
                Vector scenario = Vectors.UpdateScenarios()[0];
                AgentConfig config = Config(scenario.PublicKey, false);
                Check.Allowed(UpdateGate.Evaluate(config, "9.9.8", "9.9.9", Vectors.F(scenario, "url"), Vectors.F(scenario, "sha256"), scenario.Signature), "9.9.8 -> 9.9.9");
                Check.Refused(UpdateGate.Evaluate(config, "9.9.9", "9.9.9", Vectors.F(scenario, "url"), Vectors.F(scenario, "sha256"), scenario.Signature), "estritamente maior", "igual");
                Check.Refused(UpdateGate.Evaluate(config, "9.10.0", "9.9.9", Vectors.F(scenario, "url"), Vectors.F(scenario, "sha256"), scenario.Signature), "estritamente maior", "9.10 > 9.9");
            });
        }
    }

    // ---- portao de jobs --------------------------------------------------------------------------

    internal static class JobGateTests
    {
        private static AgentConfig Config(string key, bool allowUnsigned)
        {
            AgentConfig config = new AgentConfig();
            config.serverUrl = "https://servidor.local";
            config.jobSigningPublicKey = key;
            config.allowUnsignedJobs = allowUnsigned;
            return config;
        }

        private static GateDecision Evaluate(Vector vector, SignedJob job, long now, ICollection<string> seen)
        {
            return JobGate.Evaluate(Config(vector.PublicKey, false), job, Vectors.F(vector, "assetId"), now, seen);
        }

        internal static void Register()
        {
            TestRunner.Add("job: SEGURO POR PADRAO -- sem jobSigningPublicKey e sem opt-out, recusa", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                long now = job.NotAfter - 60;
                Check.Refused(JobGate.Evaluate(Config(null, false), job, job.AssetId, now, new HashSet<string>()), "jobSigningPublicKey nao configurada", "sem chave");
                Check.Refused(JobGate.Evaluate(Config("  ", false), job, job.AssetId, now, new HashSet<string>()), "jobSigningPublicKey nao configurada", "chave em branco");
                Check.Refused(JobGate.Evaluate(null, job, job.AssetId, now, null), "configuracao", "config nula");
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, false), null, job.AssetId, now, null), "job ausente", "job nulo");
            });

            TestRunner.Add("job: opt-out allowUnsignedJobs sem chave permite com AVISO", delegate
            {
                SignedJob job = Vectors.ToSignedJob(Vectors.FirstJob());
                job.Signature = null;
                GateDecision decision = JobGate.Evaluate(Config(null, true), job, "qualquer", 0, new HashSet<string>());
                Check.Allowed(decision, "opt-out");
                Check.Contains(decision.Warning, "SEM verificar assinatura", "aviso");
            });

            TestRunner.Add("job: allowUnsignedJobs NAO contorna a assinatura quando ha chave configurada", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.Signature = null;
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, true), job, job.AssetId, job.NotAfter, null), "sem assinatura", "opt-out + chave + sem assinatura");
                job.Signature = Convert.ToBase64String(new byte[64]);
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, true), job, job.AssetId, job.NotAfter, null), "recusada", "opt-out + chave + assinatura falsa");
            });

            TestRunner.Add("job: aceita todos os jobs assinados validos (>=100 vetores) para o proprio ativo dentro da validade", delegate
            {
                int count = 0;
                foreach (Vector vector in Vectors.Jobs(1000))
                {
                    SignedJob job = Vectors.ToSignedJob(vector);
                    GateDecision decision = Evaluate(vector, job, job.NotAfter - 60, new HashSet<string>());
                    Check.Allowed(decision, "job assinado");
                    Check.True(decision.Warning == null, "sem aviso quando assinado");
                    count++;
                }
                Check.True(count >= 100, "varios jobs cobertos: " + count);
            });

            TestRunner.Add("job: contentSha256 informado e conferido; com valor correto passa", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.ContentSha256 = Vectors.F(vector, "contentSha256").ToUpperInvariant();
                Check.Allowed(Evaluate(vector, job, job.NotAfter, null), "hash informado correto (maiusculas)");
            });

            TestRunner.Add("job: assinatura ausente, vazia ou lixo e recusada", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                foreach (string bad in new string[] { null, "", "   " })
                {
                    job.Signature = bad;
                    Check.Refused(Evaluate(vector, job, job.NotAfter, null), "sem assinatura", "assinatura ausente");
                }
                job.Signature = "@@@";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "recusada", "lixo");
                job.Signature = Convert.ToBase64String(new byte[63]);
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "recusada", "63 bytes");
            });

            TestRunner.Add("job: conteudo trocado com a assinatura original e recusado (hash local != assinado)", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.Content = job.Content + "\nRemove-Item C:\\ -Recurse -Force";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "recusada", "conteudo adulterado");
                job.Content = job.Content.Substring(0, job.Content.Length - 5);
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "recusada", "conteudo truncado");
            });

            TestRunner.Add("job: contentSha256 informado que nao bate com o conteudo recebido e recusado com motivo claro", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.ContentSha256 = new string('0', 64);
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "contentSha256", "hash informado errado");
                // Servidor "esperto": conteudo trocado E hash do conteudo novo -- ainda assim a assinatura nao cobre.
                job = Vectors.ToSignedJob(vector);
                job.Content = "calc.exe";
                job.ContentSha256 = Hashing.Sha256HexOfText("calc.exe");
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "assinatura", "conteudo e hash trocados");
            });

            TestRunner.Add("job: cada campo assinado alterado (jobId, interpretador, timeout, validade, ativo) invalida a assinatura", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob original = Vectors.ToSignedJob(vector);
                long now = original.NotAfter - 60;

                SignedJob job = Vectors.ToSignedJob(vector); job.JobId = original.JobId + "x";
                Check.Refused(Evaluate(vector, job, now, null), "assinatura", "jobId");
                job = Vectors.ToSignedJob(vector); job.Interpreter = original.Interpreter == "cmd" ? "powershell" : "cmd";
                Check.Refused(Evaluate(vector, job, now, null), "assinatura", "interpretador");
                job = Vectors.ToSignedJob(vector); job.TimeoutSeconds = original.TimeoutSeconds + 1;
                Check.Refused(Evaluate(vector, job, now, null), "assinatura", "timeout");
                job = Vectors.ToSignedJob(vector); job.NotAfter = original.NotAfter + 999999;
                Check.Refused(Evaluate(vector, job, now, null), "assinatura", "validade estendida");
                job = Vectors.ToSignedJob(vector); job.AssetId = "outro-ativo";
                Check.Refused(Evaluate(vector, job, now, null), "assinatura", "assetId do job adulterado");
            });

            TestRunner.Add("job: campos com CR/LF sao recusados", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.JobId = job.JobId + "\nassetId=outro";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), null, "LF em jobId");
                job = Vectors.ToSignedJob(vector);
                job.Interpreter = job.Interpreter + "\r";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), null, "CR em interpretador");
            });

            TestRunner.Add("job: assinado VALIDAMENTE para outro ativo e recusado (assetId != proprio)", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                GateDecision decision = JobGate.Evaluate(Config(vector.PublicKey, false), job, "OUTRA-MAQUINA", job.NotAfter, null);
                Check.Refused(decision, "outro ativo", "ativo diferente");
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, false), job, null, job.NotAfter, null), "desconhecido", "proprio nulo");
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, false), job, "", job.NotAfter, null), "desconhecido", "proprio vazio");
                Check.Refused(JobGate.Evaluate(Config(vector.PublicKey, false), job, job.AssetId.ToUpperInvariant() + "x", job.NotAfter, null), "outro ativo", "prefixo/sufixo");
                Check.Allowed(JobGate.Evaluate(Config(vector.PublicKey, false), job, "  " + job.AssetId + " ", job.NotAfter, null), "espacos ao redor do id proprio sao tolerados");
            });

            TestRunner.Add("job: limite de expiracao -- notAfter+300s ainda vale; notAfter+301s expira (tolerancia de 5 min)", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                Check.Equal(300L, JobGate.ClockToleranceSeconds, "tolerancia");
                Check.Allowed(Evaluate(vector, job, job.NotAfter - 100000, null), "muito antes (relogio atrasado) vale");
                Check.Allowed(Evaluate(vector, job, job.NotAfter, null), "exatamente notAfter");
                Check.Allowed(Evaluate(vector, job, job.NotAfter + 299, null), "notAfter + 299");
                Check.Allowed(Evaluate(vector, job, job.NotAfter + 300, null), "notAfter + 300 (limite inclusivo)");
                Check.Refused(Evaluate(vector, job, job.NotAfter + 301, null), "expirada", "notAfter + 301");
                Check.Refused(Evaluate(vector, job, job.NotAfter + 86400, null), "expirada", "um dia depois");
            });

            TestRunner.Add("job: sem validade (notAfter 0 ou negativo) e recusado", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                job.NotAfter = 0;
                Check.Refused(Evaluate(vector, job, 0, null), "sem validade", "notAfter 0");
                job.NotAfter = -5;
                Check.Refused(Evaluate(vector, job, 0, null), "sem validade", "notAfter negativo");
            });

            TestRunner.Add("job: jobId ja visto e recusado (replay); outros ids vistos nao atrapalham", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                HashSet<string> seen = new HashSet<string>();
                seen.Add("outro-job");
                Check.Allowed(Evaluate(vector, job, job.NotAfter, seen), "id novo");
                seen.Add(job.JobId);
                Check.Refused(Evaluate(vector, job, job.NotAfter, seen), "replay", "id repetido");
            });

            TestRunner.Add("job: campos obrigatorios ausentes e conteudo nulo sao recusados", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector); job.JobId = "";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "jobId", "jobId vazio");
                job = Vectors.ToSignedJob(vector); job.AssetId = null;
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "assetId", "assetId nulo");
                job = Vectors.ToSignedJob(vector); job.Interpreter = " ";
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "interpretador", "interpretador em branco");
                job = Vectors.ToSignedJob(vector); job.Content = null;
                Check.Refused(Evaluate(vector, job, job.NotAfter, null), "conteudo", "conteudo nulo");
            });

            TestRunner.Add("job: chave de outro emissor ou invalida recusa", delegate
            {
                Vector vector = Vectors.FirstJob();
                SignedJob job = Vectors.ToSignedJob(vector);
                Vector other = null;
                foreach (Vector candidate in Vectors.Positives()) if (candidate.PublicKey != vector.PublicKey) { other = candidate; break; }
                Check.Refused(JobGate.Evaluate(Config(other.PublicKey, false), job, job.AssetId, job.NotAfter, null), "recusada", "chave de outro emissor");
                Check.Refused(JobGate.Evaluate(Config("lixo", false), job, job.AssetId, job.NotAfter, null), "recusada", "chave invalida");
            });

            TestRunner.Add("job: jobId com formato nao armazenavel e recusado mesmo assinado", delegate
            {
                // Nao ha vetor assinado com id fora da lista de caracteres; o contrato esta em ReplayStore.IsValidId.
                Check.True(ReplayStore.IsValidId("0f8fad5b-d9cb-469f-a165-70867728950e"), "uuid");
                Check.False(ReplayStore.IsValidId("a b"), "espaco");
                Check.False(ReplayStore.IsValidId("a\nb"), "quebra de linha");
                Check.False(ReplayStore.IsValidId(""), "vazio");
                Check.False(ReplayStore.IsValidId(new string('a', 181)), "longo demais");
                Check.False(ReplayStore.IsValidId("\uFFFD"), "caractere de substituicao (arquivo corrompido)");
            });

            TestRunner.Add("job: postura de confianca descreve chave, ausencia e opt-out", delegate
            {
                Vector vector = Vectors.FirstJob();
                AgentConfig config = new AgentConfig();
                config.jobSigningPublicKey = vector.PublicKey;
                List<KeyValuePair<string, string>> lines = TrustPosture.Describe(config);
                Check.Equal(2, lines.Count, "duas linhas");
                Check.Contains(lines[1].Value, "fingerprint", "jobs com chave");
                Check.Contains(lines[0].Value, "seguro por padrao", "update sem chave");
                config.allowUnsignedUpdates = true;
                Check.Contains(TrustPosture.Describe(config)[0].Value, "SEM verificacao", "opt-out de update");
                config.releasePublicKey = "invalida";
                Check.Equal(Log.LevelError, TrustPosture.Describe(config)[0].Key, "chave invalida e erro");
            });
        }
    }

    // ---- registro anti-replay --------------------------------------------------------------------

    internal static class ReplayStoreTests
    {
        private static string PathIn(string directory) { return Path.Combine(directory, "state", "seen-job-ids.txt"); }

        internal static void Register()
        {
            TestRunner.Add("replay: registra, persiste e recarrega do disco", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    ReplayStore store = ReplayStore.Load(PathIn(dir));
                    Check.Equal(0, store.Count, "comeca vazio");
                    string error;
                    Check.True(store.TryRecord("job-1", out error), "grava 1: " + error);
                    Check.True(store.TryRecord("job-2", out error), "grava 2: " + error);
                    Check.True(store.Contains("job-1") && store.Contains("job-2"), "em memoria");
                    Check.False(store.Contains("job-3"), "nao inventa");
                    ReplayStore reloaded = ReplayStore.Load(PathIn(dir));
                    Check.Equal(2, reloaded.Count, "recarregado");
                    Check.True(reloaded.Contains("job-1") && reloaded.Contains("job-2"), "ids sobrevivem ao 'reinicio'");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: limite de 500 -- os mais antigos saem, os 500 mais recentes ficam (memoria e disco)", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    Check.Equal(500, ReplayStore.Capacity, "capacidade");
                    ReplayStore store = ReplayStore.Load(PathIn(dir));
                    string error;
                    for (int index = 0; index < 520; index++)
                    {
                        Check.True(store.TryRecord("job-" + index, out error), "grava " + index + ": " + error);
                    }
                    Check.Equal(500, store.Count, "tamanho limitado");
                    Check.False(store.Contains("job-0"), "mais antigo removido");
                    Check.False(store.Contains("job-19"), "20o mais antigo removido");
                    Check.True(store.Contains("job-20"), "primeiro que fica");
                    Check.True(store.Contains("job-519"), "mais recente");
                    ReplayStore reloaded = ReplayStore.Load(PathIn(dir));
                    Check.Equal(500, reloaded.Count, "disco tambem limitado");
                    Check.False(reloaded.Contains("job-19"), "disco: removido");
                    Check.True(reloaded.Contains("job-20") && reloaded.Contains("job-519"), "disco: ficam");
                    Check.Equal(500, File.ReadAllLines(PathIn(dir)).Length, "500 linhas no arquivo");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: id repetido nao cresce a lista e vira o mais recente", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    ReplayStore store = ReplayStore.Load(PathIn(dir));
                    string error;
                    store.TryRecord("a", out error); store.TryRecord("b", out error); store.TryRecord("a", out error);
                    Check.Equal(2, store.Count, "sem duplicata");
                    List<string> order = new List<string>(store);
                    Check.Equal("b", order[0], "a ficou mais recente (ordem)");
                    Check.Equal("a", order[1], "a ficou mais recente (fim)");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: arquivo corrompido (binario) nao quebra -- carrega vazio e avisa", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    List<string> logged = new List<string>();
                    Log.Sink = delegate(string level, string message) { logged.Add(level + " " + message); };
                    string path = PathIn(dir);
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    byte[] junk = new byte[2048];
                    new Random(7).NextBytes(junk);
                    File.WriteAllBytes(path, junk);
                    ReplayStore store = ReplayStore.Load(path);
                    Check.Equal(0, store.Count, "nada aproveitado do lixo");
                    Check.True(logged.Exists(delegate(string line) { return line.StartsWith("WARN") && line.Contains("invalida"); }), "avisou no log");
                    string error;
                    Check.True(store.TryRecord("depois-do-lixo", out error), "volta a gravar: " + error);
                    Check.Equal(1, ReplayStore.Load(path).Count, "arquivo reescrito limpo");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: arquivo parcialmente corrompido mantem os ids validos e descarta o resto", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    string path = PathIn(dir);
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    File.WriteAllText(path, "ok-1\r\nlinha com espacos\r\n\r\nok-2\n\u0001\u0002\nok-3\n" + new string('x', 500) + "\n");
                    ReplayStore store = ReplayStore.Load(path);
                    Check.Equal(3, store.Count, "so os 3 validos");
                    Check.True(store.Contains("ok-1") && store.Contains("ok-2") && store.Contains("ok-3"), "validos");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: arquivo ausente e vazio sao ok; diretorio no lugar do arquivo nao quebra o Load", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    Check.Equal(0, ReplayStore.Load(PathIn(dir)).Count, "ausente");
                    string path = PathIn(dir);
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    File.WriteAllText(path, "");
                    Check.Equal(0, ReplayStore.Load(path).Count, "vazio");
                    File.Delete(path);
                    Directory.CreateDirectory(path);
                    Check.Equal(0, ReplayStore.Load(path).Count, "e um diretorio");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: falha ao gravar => TryRecord retorna false com motivo e NAO deixa o id em memoria", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    string blocker = Path.Combine(dir, "arquivo");
                    File.WriteAllText(blocker, "x");
                    // O "diretorio" pai do store e um arquivo comum: impossivel criar/gravar.
                    ReplayStore store = ReplayStore.Load(Path.Combine(blocker, "seen.txt"));
                    string error;
                    Check.False(store.TryRecord("job-x", out error), "gravacao deve falhar");
                    Check.True(!string.IsNullOrEmpty(error), "motivo informado");
                    Check.False(store.Contains("job-x"), "id nao ficou em memoria (execucao seria recusada)");
                    Check.Equal(0, store.Count, "estado anterior restaurado");
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: id invalido nunca e gravado; escrita atomica nao deixa temporarios", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    ReplayStore store = ReplayStore.Load(PathIn(dir));
                    string error;
                    Check.False(store.TryRecord("com espaco", out error), "espaco");
                    Check.False(store.TryRecord("com\nquebra", out error), "quebra de linha");
                    Check.False(store.TryRecord("", out error), "vazio");
                    Check.False(store.TryRecord(null, out error), "nulo");
                    for (int index = 0; index < 25; index++) store.TryRecord("ok-" + index, out error);
                    string[] files = Directory.GetFiles(Path.GetDirectoryName(PathIn(dir)));
                    Check.Equal(1, files.Length, "so o arquivo final (sem .tmp): " + string.Join(",", files));
                }
                finally { Directory.Delete(dir, true); }
            });

            TestRunner.Add("replay: integracao Gate + store -- job aceito uma vez e recusado na segunda entrega (mesmo apos reinicio)", delegate
            {
                string dir = TestPaths.NewTempDirectory();
                try
                {
                    Vector vector = Vectors.FirstJob();
                    SignedJob job = Vectors.ToSignedJob(vector);
                    AgentConfig config = new AgentConfig();
                    config.jobSigningPublicKey = vector.PublicKey;
                    ReplayStore store = ReplayStore.Load(PathIn(dir));
                    Check.Allowed(JobGate.Evaluate(config, job, job.AssetId, job.NotAfter, store), "primeira entrega");
                    string error;
                    Check.True(store.TryRecord(job.JobId, out error), "registrou: " + error);
                    Check.Refused(JobGate.Evaluate(config, job, job.AssetId, job.NotAfter, store), "replay", "segunda entrega");
                    ReplayStore afterRestart = ReplayStore.Load(PathIn(dir));
                    Check.Refused(JobGate.Evaluate(config, job, job.AssetId, job.NotAfter, afterRestart), "replay", "apos reinicio");
                }
                finally { Directory.Delete(dir, true); }
            });
        }
    }

    // ---- configuracao ----------------------------------------------------------------------------

    internal static class ConfigTests
    {
        internal static void Register()
        {
            TestRunner.Add("config: chaves de confianca ausentes => nulas/false (seguro por padrao)", delegate
            {
                AgentConfig config = AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"agentToken\":\"t\"}");
                Check.True(config.releasePublicKey == null, "releasePublicKey nula");
                Check.True(config.jobSigningPublicKey == null, "jobSigningPublicKey nula");
                Check.False(config.allowUnsignedUpdates, "allowUnsignedUpdates false");
                Check.False(config.allowUnsignedJobs, "allowUnsignedJobs false");
                Check.Equal(300, config.intervalSeconds, "intervalo padrao");
                Check.False(config.enableRemoteScriptExecution, "scripts desligados");
            });

            TestRunner.Add("config: le as quatro chaves novas e ignora campos desconhecidos", delegate
            {
                Vector vector = Vectors.FirstJob();
                string json = "{\"serverUrl\":\"https://x\",\"agentToken\":\"t\",\"intervalSeconds\":60," +
                    "\"releasePublicKey\":\"" + vector.PublicKey + "\",\"jobSigningPublicKey\":\"" + vector.PublicKey + "\"," +
                    "\"allowUnsignedUpdates\":true,\"allowUnsignedJobs\":true,\"campoFuturo\":{\"a\":1}}";
                AgentConfig config = AgentConfigReader.Parse(json);
                Check.Equal(vector.PublicKey, config.releasePublicKey, "release");
                Check.Equal(vector.PublicKey, config.jobSigningPublicKey, "jobs");
                Check.True(config.allowUnsignedUpdates, "allowUnsignedUpdates");
                Check.True(config.allowUnsignedJobs, "allowUnsignedJobs");
                Check.Equal(60, config.intervalSeconds, "intervalo");
            });

            TestRunner.Add("config: valores de opt-out sem sentido (texto, numero, nulo) nunca ligam o flag", delegate
            {
                string[] junk = { "\"false\"", "\"0\"", "\"sim\"", "\"\"", "null", "0", "false" };
                foreach (string value in junk)
                {
                    bool enabled;
                    try
                    {
                        AgentConfig config = AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"allowUnsignedJobs\":" + value + ",\"allowUnsignedUpdates\":" + value + "}");
                        enabled = config.allowUnsignedJobs || config.allowUnsignedUpdates;
                    }
                    catch (Exception parseError)
                    {
                        // Config ilegivel derruba a leitura (o agente nao sobe): seguro, nunca liga o opt-out.
                        Check.True(!string.IsNullOrEmpty(parseError.Message), "erro com mensagem");
                        enabled = false;
                    }
                    Check.False(enabled, "valor " + value + " nao pode ligar o opt-out");
                }
            });

            TestRunner.Add("config: serverUrl obrigatorio e intervalo entre 30 e 86400", delegate
            {
                Check.Throws<InvalidOperationException>(delegate { AgentConfigReader.Parse("{}"); }, "sem serverUrl");
                Check.Throws<InvalidOperationException>(delegate { AgentConfigReader.Parse("{\"serverUrl\":\"  \"}"); }, "serverUrl em branco");
                Check.Throws<InvalidOperationException>(delegate { AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"intervalSeconds\":29}"); }, "intervalo 29");
                Check.Throws<InvalidOperationException>(delegate { AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"intervalSeconds\":86401}"); }, "intervalo 86401");
                Check.Equal(30, AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"intervalSeconds\":30}").intervalSeconds, "30 ok");
                Check.Equal(86400, AgentConfigReader.Parse("{\"serverUrl\":\"https://x\",\"intervalSeconds\":86400}").intervalSeconds, "86400 ok");
            });

            TestRunner.Add("config: Load de arquivo ausente falha com mensagem; config.example.json do repositorio e valido", delegate
            {
                Check.Throws<InvalidOperationException>(delegate { AgentConfigReader.Load(Path.Combine(TestPaths.AgentDirectory, "nao-existe.json")); }, "arquivo ausente");
                AgentConfig example = AgentConfigReader.Load(Path.Combine(TestPaths.AgentDirectory, "config.example.json"));
                Check.False(example.allowUnsignedUpdates, "exemplo: allowUnsignedUpdates false");
                Check.False(example.allowUnsignedJobs, "exemplo: allowUnsignedJobs false");
                Check.False(example.enableRemoteScriptExecution, "exemplo: scripts desligados");
                string releaseKey = example.releasePublicKey ?? "";
                string jobKey = example.jobSigningPublicKey ?? "";
                Check.True(releaseKey.Length == 0 || SignatureVerifier.IsValidPublicKey(releaseKey), "exemplo: releasePublicKey vazia ou valida");
                Check.True(jobKey.Length == 0 || SignatureVerifier.IsValidPublicKey(jobKey), "exemplo: jobSigningPublicKey vazia ou valida");
            });
        }
    }

    // ---- log -------------------------------------------------------------------------------------

    internal static class LogTests
    {
        internal static void Register()
        {
            TestRunner.Add("log: BestEffort registra contexto + tipo + mensagem da excecao", delegate
            {
                List<string> lines = new List<string>();
                Log.Sink = delegate(string level, string message) { lines.Add(level + "|" + message); };
                Log.BestEffort("apagar temporario X", new IOException("disco cheio"));
                Check.Equal(1, lines.Count, "uma linha");
                Check.Contains(lines[0], "DEBUG|", "nivel debug por padrao");
                Check.Contains(lines[0], "apagar temporario X", "contexto");
                Check.Contains(lines[0], "IOException", "tipo");
                Check.Contains(lines[0], "disco cheio", "mensagem");
                Log.BestEffort("coletar bateria", new InvalidOperationException("sem dados"), Log.LevelWarn);
                Check.Contains(lines[1], "WARN|", "nivel explicito");
                Log.BestEffort("sem excecao", null);
                Check.Equal(3, lines.Count, "excecao nula nao quebra");
            });

            TestRunner.Add("log: repeticoes identicas sao suprimidas na janela e contadas depois", delegate
            {
                List<string> lines = new List<string>();
                DateTime now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                Log.UtcNow = delegate { return now; };
                Log.Sink = delegate(string level, string message) { lines.Add(message); };
                Exception error = new InvalidOperationException("sem bateria");
                for (int index = 0; index < 5; index++) Log.BestEffort("coletar bateria", error);
                Check.Equal(1, lines.Count, "so a primeira dentro da janela");
                Log.BestEffort("coletar disco", error);
                Check.Equal(2, lines.Count, "contexto diferente nao e suprimido");
                now = now.AddMinutes(31);
                Log.BestEffort("coletar bateria", error);
                Check.Equal(3, lines.Count, "depois da janela escreve de novo");
                Check.Contains(lines[2], "4 ocorrencia", "informa quantas foram suprimidas");
            });

            TestRunner.Add("log: destino que lanca nunca propaga e e contabilizado", delegate
            {
                Log.Sink = delegate { throw new IOException("disco de log cheio"); };
                Log.Warn("qualquer");
                Log.BestEffort("x", new Exception("y"));
                Check.True(Log.SinkFailureCount >= 2, "falhas contabilizadas: " + Log.SinkFailureCount);
            });

            TestRunner.Add("log: mensagem enorme e truncada", delegate
            {
                string captured = null;
                Log.Sink = delegate(string level, string message) { captured = message; };
                Log.Info(new string('x', 10000));
                Check.True(captured.Length < 2100, "truncada: " + captured.Length);
            });
        }
    }

    // ---- higiene do codigo-fonte -----------------------------------------------------------------

    internal static class SourceHygieneTests
    {
        // catch { }, catch (Exception) { }, catch (Exception e) { /* so comentario */ } etc.:
        // corpo composto apenas de espacos, quebras de linha e comentarios.
        internal static readonly Regex EmptyCatch = new Regex(
            @"\bcatch\b\s*(\([^)]*\))?\s*\{(?:\s|//[^\r\n]*|/\*[\s\S]*?\*/)*\}",
            RegexOptions.Compiled);

        internal static List<string> AgentSources()
        {
            List<string> files = new List<string>();
            foreach (string file in Directory.GetFiles(TestPaths.AgentDirectory, "ITGuardian.*.cs"))
            {
                files.Add(file);
            }
            return files;
        }

        internal static void Register()
        {
            TestRunner.Add("higiene: o detector de catch vazio reconhece as variantes (e nao acusa catch com corpo)", delegate
            {
                string[] empty =
                {
                    "try { x(); } catch { }",
                    "try { x(); } catch{}",
                    "catch (Exception) { }",
                    "catch (Exception error) {\n    // ignorado\n}",
                    "catch\n{\n    /* nada */\n}",
                    "catch (IOException)\n{\n    // a\n    // b\n}",
                    "try { Delete(); } catch (System.Exception) {}"
                };
                string[] notEmpty =
                {
                    "catch { Log.BestEffort(\"x\", null); }",
                    "catch (Exception error) { Log.Warn(error.Message); }",
                    "catch (Exception) { return false; }",
                    "catch { throw; }"
                };
                foreach (string sample in empty) Check.True(EmptyCatch.IsMatch(sample), "deveria detectar: " + sample);
                foreach (string sample in notEmpty) Check.False(EmptyCatch.IsMatch(sample), "nao deveria detectar: " + sample);
            });

            TestRunner.Add("higiene: NENHUM catch vazio nos fontes do agente (ITGuardian.*.cs)", delegate
            {
                List<string> files = AgentSources();
                Check.True(files.Count >= 7, "fontes encontrados: " + files.Count);
                List<string> offenders = new List<string>();
                foreach (string file in files)
                {
                    string source = File.ReadAllText(file, Encoding.UTF8);
                    foreach (Match match in EmptyCatch.Matches(source))
                    {
                        int line = 1;
                        for (int index = 0; index < match.Index; index++) if (source[index] == '\n') line++;
                        offenders.Add(Path.GetFileName(file) + ":" + line);
                    }
                }
                Check.True(offenders.Count == 0, "catch vazio em: " + string.Join(", ", offenders.ToArray()));
            });

            TestRunner.Add("integracao: ApplyUpdate consulta o UpdateGate ANTES de qualquer download", delegate
            {
                string source = File.ReadAllText(Path.Combine(TestPaths.AgentDirectory, "ITGuardian.Windows.cs"), Encoding.UTF8);
                int start = source.IndexOf("private static bool ApplyUpdate(", StringComparison.Ordinal);
                Check.True(start > 0, "ApplyUpdate existe");
                string body = source.Substring(start);
                int gate = body.IndexOf("UpdateGate.Evaluate(", StringComparison.Ordinal);
                int download = body.IndexOf("WebRequest.Create(", StringComparison.Ordinal);
                Check.True(gate > 0, "ApplyUpdate usa UpdateGate");
                Check.True(download > 0, "ApplyUpdate baixa");
                Check.True(gate < download, "UpdateGate vem antes do download");
            });

            TestRunner.Add("integracao: execucao de job passa pelo JobGate e registra o jobId antes de executar", delegate
            {
                string source = File.ReadAllText(Path.Combine(TestPaths.AgentDirectory, "ITGuardian.Windows.cs"), Encoding.UTF8);
                int start = source.IndexOf("private static void ExecuteAndReportJob(", StringComparison.Ordinal);
                Check.True(start > 0, "ExecuteAndReportJob existe");
                string body = source.Substring(start);
                int gate = body.IndexOf("JobGate.Evaluate(", StringComparison.Ordinal);
                int record = body.IndexOf(".TryRecord(", StringComparison.Ordinal);
                int execute = body.IndexOf("ExecuteJob(config, job)", StringComparison.Ordinal);
                Check.True(gate > 0 && record > 0 && execute > 0, "gate, registro e execucao presentes");
                Check.True(gate < record && record < execute, "ordem: gate -> registro anti-replay -> execucao");
            });

            TestRunner.Add("integracao: o hash do binario baixado e comparado com o valor ASSINADO e ha limite de tamanho", delegate
            {
                string source = File.ReadAllText(Path.Combine(TestPaths.AgentDirectory, "ITGuardian.Windows.cs"), Encoding.UTF8);
                Check.True(Regex.IsMatch(source, @"string\.Equals\(actualHash, expectedSha256, StringComparison\.OrdinalIgnoreCase\)"), "compara hash");
                Check.True(source.Contains("MinUpdateBinaryBytes") && source.Contains("MaxUpdateBinaryBytes"), "limites de tamanho");
            });
        }
    }
}
