using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace ITGuardian.Windows
{
    /// <summary>
    /// Ponto unico de log do agente. O destino real (arquivo logs\agent.log) e
    /// instalado por Program em <see cref="Sink"/>; sem destino instalado (por
    /// exemplo nos testes) as linhas vao para System.Diagnostics.Trace.
    ///
    /// Existe para que NENHUM catch do agente fique mudo: tudo que e engolido
    /// de proposito (limpeza de arquivo temporario, leituras opcionais de WMI
    /// ou registro, atualizacao de status cosmetico) passa por
    /// <see cref="BestEffort"/> e deixa rastro com contexto e mensagem da
    /// excecao. Para nao inundar o arquivo (o coletor repete as mesmas
    /// leituras a cada heartbeat), repeticoes identicas sao suprimidas por uma
    /// janela de tempo e contadas.
    /// </summary>
    internal static class Log
    {
        internal const string LevelDebug = "DEBUG";
        internal const string LevelInfo = "INFO";
        internal const string LevelWarn = "WARN";
        internal const string LevelError = "ERROR";

        private const int MaxThrottleEntries = 512;
        private const int MaxMessageLength = 2000;
        private static readonly TimeSpan DefaultThrottleWindow = TimeSpan.FromMinutes(30);
        private static readonly object SyncRoot = new object();
        private static readonly Dictionary<string, ThrottleEntry> Throttle =
            new Dictionary<string, ThrottleEntry>(StringComparer.Ordinal);

        // Instalado por Program.Main (escreve em logs\agent.log). Testes
        // substituem para capturar as linhas.
        internal static Action<string, string> Sink;

        // Relogio injetavel: o teste de supressao nao pode depender de sleep.
        internal static Func<DateTime> UtcNow = delegate { return DateTime.UtcNow; };

        // Quantas vezes o proprio destino do log falhou (disco cheio, ACL...).
        internal static long SinkFailureCount;

        private sealed class ThrottleEntry
        {
            internal DateTime LastLoggedUtc;
            internal int Suppressed;
        }

        internal static void Write(string level, string message)
        {
            string text = message ?? "";
            if (text.Length > MaxMessageLength) text = text.Substring(0, MaxMessageLength) + "...";
            Action<string, string> sink = Sink;
            if (sink == null)
            {
                Trace.WriteLine("[" + level + "] " + text);
                return;
            }
            try
            {
                sink(level, text);
            }
            catch (Exception sinkError)
            {
                ReportSinkFailure(sinkError);
            }
        }

        internal static void Debug(string message) { Write(LevelDebug, message); }
        internal static void Info(string message) { Write(LevelInfo, message); }
        internal static void Warn(string message) { Write(LevelWarn, message); }
        internal static void Error(string message) { Write(LevelError, message); }

        /// <summary>
        /// Registra uma excecao que o chamador vai engolir de proposito.
        /// Nunca lanca. <paramref name="context"/> diz O QUE estava sendo feito
        /// ("apagar temporario X", "coletar bateria"), nao onde.
        /// </summary>
        internal static void BestEffort(string context, Exception error, string level = LevelDebug)
        {
            try
            {
                string kind = error == null ? "(sem excecao)" : error.GetType().Name;
                string detail = error == null ? "" : (error.Message ?? "");
                string message = (context ?? "operacao") + " falhou e foi ignorada: " + kind +
                    (detail.Length == 0 ? "" : ": " + detail);
                WriteThrottled(
                    "best-effort|" + context + "|" + kind + "|" + detail,
                    level,
                    message,
                    DefaultThrottleWindow
                );
            }
            catch (Exception loggingError)
            {
                // Registrar nao pode falhar o chamador; contabiliza e segue.
                ReportSinkFailure(loggingError);
            }
        }

        /// <summary>
        /// Escreve no maximo uma vez por janela para a mesma chave; as
        /// repeticoes suprimidas sao contadas e informadas na proxima escrita.
        /// </summary>
        internal static void WriteThrottled(string key, string level, string message, TimeSpan window)
        {
            int suppressed = 0;
            lock (SyncRoot)
            {
                DateTime now = UtcNow();
                ThrottleEntry entry;
                if (Throttle.TryGetValue(key ?? "", out entry))
                {
                    if (now - entry.LastLoggedUtc < window)
                    {
                        entry.Suppressed++;
                        return;
                    }
                    suppressed = entry.Suppressed;
                    entry.Suppressed = 0;
                    entry.LastLoggedUtc = now;
                }
                else
                {
                    if (Throttle.Count >= MaxThrottleEntries) Throttle.Clear();
                    Throttle[key ?? ""] = new ThrottleEntry { LastLoggedUtc = now };
                }
            }
            Write(
                level,
                suppressed > 0
                    ? message + " (" + suppressed + " ocorrencia(s) identica(s) suprimida(s) desde o ultimo registro)"
                    : message
            );
        }

        /// <summary>
        /// Chamado quando o proprio destino do log falha. Nao ha onde mais
        /// registrar: contabiliza e deixa um rastro de diagnostico (Trace /
        /// OutputDebugString), sem nunca propagar.
        /// </summary>
        internal static void ReportSinkFailure(Exception error)
        {
            SinkFailureCount++;
            Trace.WriteLine(
                "[ITGuardian] falha ao registrar log (" + SinkFailureCount + " ate agora): " +
                (error == null ? "" : error.GetType().Name + ": " + error.Message)
            );
        }

        /// <summary>Limpa o estado de supressao (somente testes).</summary>
        internal static void ResetForTests()
        {
            lock (SyncRoot)
            {
                Throttle.Clear();
            }
            SinkFailureCount = 0;
        }
    }
}
