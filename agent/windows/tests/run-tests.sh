#!/usr/bin/env bash
# Compila e roda os testes do agente Windows com Mono (mcs). Nao precisa de Windows nem de NuGet.
#
#   bash agent/windows/tests/run-tests.sh
#
# Compila SOMENTE os fontes sem WinForms/WMI (Logging, Signing, Policy, Config) + o proprio
# ITGuardian.Tests.cs. -langversion:5 reproduz o compilador do .NET Framework 4.x (csc C# 5),
# que e o que gera o agente real: qualquer sintaxe C# 6+ falha aqui tambem.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
agent="$(cd "$here/.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

command -v mcs >/dev/null || { echo "mcs nao encontrado (instale mono-mcs mono-runtime)." >&2; exit 2; }
command -v mono >/dev/null || { echo "mono nao encontrado (instale mono-runtime)." >&2; exit 2; }

mcs -nologo -langversion:5 -warn:4 -warnaserror+ -debug \
  -out:"$out/ITGuardian.Tests.exe" \
  -r:System.dll -r:System.Core.dll -r:System.Numerics.dll -r:System.Web.Extensions.dll \
  "$agent/ITGuardian.Logging.cs" \
  "$agent/ITGuardian.Signing.cs" \
  "$agent/ITGuardian.Policy.cs" \
  "$agent/ITGuardian.Config.cs" \
  "$here/ITGuardian.Tests.cs"

mono --debug "$out/ITGuardian.Tests.exe" "$agent"
