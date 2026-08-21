using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ITGuardian.RemoteAssistanceWebRtc
{
    /// <summary>
    /// Processo auxiliar, isolado do coletor principal (ITGuardian.exe), que
    /// negocia e transmite video real por WebRTC para uma sessao de
    /// assistencia remota. Recebe seus parametros por uma unica linha JSON na
    /// entrada padrao (nunca por argumento de linha de comando, para nao
    /// deixar o token do agente visivel na lista de processos do Windows) e
    /// termina sozinho quando a sessao acaba, a conexao cai ou a captura
    /// falha de forma irrecuperavel. Uma falha aqui nunca afeta o coletor
    /// principal nem o caminho de captura por JPEG ja comprovado em producao
    /// -- os dois transportes sao processos completamente separados.
    /// </summary>
    internal static class Program
    {
        private static async Task<int> Main(string[] args)
        {
            WebRtcSessionParameters parameters;
            try
            {
                string line = Console.In.ReadLine();
                if (string.IsNullOrWhiteSpace(line))
                {
                    Console.Error.WriteLine("Nenhum parametro recebido na entrada padrao.");
                    return 1;
                }
                // Alguns lancadores de processo (inclusive PowerShell ao encanar texto
                // para a entrada padrao) inserem um BOM UTF-8 no primeiro caractere;
                // System.Text.Json rejeita isso, entao removemos antes de parsear.
                line = line.TrimStart('﻿');
                parameters = JsonSerializer.Deserialize<WebRtcSessionParameters>(line, JsonOptions.Default);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Parametros invalidos: " + ex.Message);
                return 1;
            }

            if (parameters == null ||
                string.IsNullOrWhiteSpace(parameters.ServerUrl) ||
                string.IsNullOrWhiteSpace(parameters.SessionId) ||
                string.IsNullOrWhiteSpace(parameters.BearerToken) ||
                string.IsNullOrWhiteSpace(parameters.SessionToken))
            {
                Console.Error.WriteLine("Parametros obrigatorios ausentes (serverUrl/sessionId/bearerToken/sessionToken).");
                return 1;
            }

            using (var cts = new CancellationTokenSource())
            {
                Console.CancelKeyPress += (sender, eventArgs) =>
                {
                    eventArgs.Cancel = true;
                    cts.Cancel();
                };
                using (var session = new WebRtcAgentSession(parameters))
                {
                    return await session.RunAsync(cts.Token).ConfigureAwait(false);
                }
            }
        }
    }

    internal static class JsonOptions
    {
        public static readonly JsonSerializerOptions Default = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }
}
