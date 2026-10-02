using System;
using System.Globalization;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace ITGuardian.Windows
{
    // Verificacao de assinatura ECDSA P-256 / SHA-256 AUTOCONTIDA.
    //
    // Protocolo (espelha server/src/security/agentSigning.js):
    //  - assinatura IEEE P1363: r||s, 64 bytes, em base64;
    //  - chave publica: base64 de SubjectPublicKeyInfo DER (91 bytes) =
    //    prefixo fixo de 26 bytes + 0x04 + X(32) + Y(32);
    //  - a mensagem e RECONSTRUIDA pelo agente a partir dos campos recebidos.
    //
    // Por que aritmetica propria com BigInteger e nao ECDsa.Create(ECParameters):
    // o mesmo codigo roda no .NET Framework 4.x (Windows) e no Mono (testes no
    // CI Linux), onde ECDsa.Create(ECParameters) nao existe. Aqui so se
    // VERIFICA: todos os dados sao publicos, entao tempo constante nao e
    // requisito; clareza e correcao sao. Desempenho idem (verificacao
    // ocasional).

    internal static class P256Curve
    {
        internal static readonly BigInteger P = Hex("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF");
        internal static readonly BigInteger N = Hex("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
        internal static readonly BigInteger B = Hex("5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B");
        internal static readonly BigInteger Gx = Hex("6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296");
        internal static readonly BigInteger Gy = Hex("4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5");

        // "0" na frente garante inteiro nao negativo (AllowHexSpecifier trata o bit alto como sinal).
        private static BigInteger Hex(string hex)
        {
            return BigInteger.Parse("0" + hex, NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
        }

        /// <summary>Inteiro big-endian NAO NEGATIVO (sem o byte de sinal do BigInteger).</summary>
        internal static BigInteger FromBigEndian(byte[] data, int offset, int count)
        {
            byte[] littleEndian = new byte[count + 1]; // ultimo byte 0 = positivo
            for (int index = 0; index < count; index++)
            {
                littleEndian[index] = data[offset + count - 1 - index];
            }
            return new BigInteger(littleEndian);
        }

        internal static BigInteger Mod(BigInteger value, BigInteger modulus)
        {
            BigInteger result = BigInteger.Remainder(value, modulus);
            return result.Sign < 0 ? result + modulus : result;
        }

        /// <summary>Inverso modular por Fermat (modulo primo): a^(m-2) mod m.</summary>
        internal static BigInteger Invert(BigInteger value, BigInteger primeModulus)
        {
            return BigInteger.ModPow(Mod(value, primeModulus), primeModulus - 2, primeModulus);
        }

        /// <summary>y^2 = x^3 - 3x + b (mod p), com 0 &lt;= x,y &lt; p.</summary>
        internal static bool IsOnCurve(BigInteger x, BigInteger y)
        {
            if (x.Sign < 0 || y.Sign < 0 || x >= P || y >= P) return false;
            BigInteger left = Mod(y * y, P);
            BigInteger right = Mod(x * x * x - 3 * x + B, P);
            return left == right;
        }
    }

    // Ponto em coordenadas Jacobianas (X/Z^2, Y/Z^3). Z == 0 e o ponto no infinito.
    internal struct JacobianPoint
    {
        internal BigInteger X;
        internal BigInteger Y;
        internal BigInteger Z;

        internal bool IsInfinity { get { return Z.IsZero; } }

        internal static JacobianPoint Infinity()
        {
            JacobianPoint point = new JacobianPoint();
            point.X = BigInteger.One;
            point.Y = BigInteger.One;
            point.Z = BigInteger.Zero;
            return point;
        }

        internal static JacobianPoint FromAffine(BigInteger x, BigInteger y)
        {
            JacobianPoint point = new JacobianPoint();
            point.X = x;
            point.Y = y;
            point.Z = BigInteger.One;
            return point;
        }

        // Duplicacao para a = -3 (dbl-2001-b).
        internal static JacobianPoint Double(JacobianPoint point)
        {
            if (point.IsInfinity || point.Y.IsZero) return Infinity();
            BigInteger p = P256Curve.P;
            BigInteger delta = P256Curve.Mod(point.Z * point.Z, p);
            BigInteger gamma = P256Curve.Mod(point.Y * point.Y, p);
            BigInteger beta = P256Curve.Mod(point.X * gamma, p);
            BigInteger alpha = P256Curve.Mod(3 * (point.X - delta) * (point.X + delta), p);
            BigInteger x3 = P256Curve.Mod(alpha * alpha - 8 * beta, p);
            BigInteger yz = point.Y + point.Z;
            BigInteger z3 = P256Curve.Mod(yz * yz - gamma - delta, p);
            BigInteger y3 = P256Curve.Mod(alpha * (4 * beta - x3) - 8 * gamma * gamma, p);
            JacobianPoint result = new JacobianPoint();
            result.X = x3;
            result.Y = y3;
            result.Z = z3;
            return result;
        }

        // Soma geral (add-2007-bl) com tratamento explicito dos casos P+P, P+(-P) e infinito.
        internal static JacobianPoint Add(JacobianPoint left, JacobianPoint right)
        {
            if (left.IsInfinity) return right;
            if (right.IsInfinity) return left;
            BigInteger p = P256Curve.P;
            BigInteger z1z1 = P256Curve.Mod(left.Z * left.Z, p);
            BigInteger z2z2 = P256Curve.Mod(right.Z * right.Z, p);
            BigInteger u1 = P256Curve.Mod(left.X * z2z2, p);
            BigInteger u2 = P256Curve.Mod(right.X * z1z1, p);
            BigInteger s1 = P256Curve.Mod(left.Y * right.Z * z2z2, p);
            BigInteger s2 = P256Curve.Mod(right.Y * left.Z * z1z1, p);
            if (u1 == u2)
            {
                return s1 == s2 ? Double(left) : Infinity();
            }
            BigInteger h = P256Curve.Mod(u2 - u1, p);
            BigInteger twoH = 2 * h;
            BigInteger i = P256Curve.Mod(twoH * twoH, p);
            BigInteger j = P256Curve.Mod(h * i, p);
            BigInteger r = P256Curve.Mod(2 * (s2 - s1), p);
            BigInteger v = P256Curve.Mod(u1 * i, p);
            BigInteger x3 = P256Curve.Mod(r * r - j - 2 * v, p);
            BigInteger y3 = P256Curve.Mod(r * (v - x3) - 2 * s1 * j, p);
            BigInteger zSum = left.Z + right.Z;
            BigInteger z3 = P256Curve.Mod((zSum * zSum - z1z1 - z2z2) * h, p);
            JacobianPoint result = new JacobianPoint();
            result.X = x3;
            result.Y = y3;
            result.Z = z3;
            return result;
        }

        /// <summary>Coordenada X afim; so chamar quando nao e o infinito.</summary>
        internal static BigInteger AffineX(JacobianPoint point)
        {
            BigInteger zInverse = P256Curve.Invert(point.Z, P256Curve.P);
            return P256Curve.Mod(point.X * zInverse * zInverse, P256Curve.P);
        }
    }

    internal static class SignatureVerifier
    {
        // Cabecalho SubjectPublicKeyInfo fixo de uma chave EC P-256 (id-ecPublicKey + prime256v1 + BIT STRING de 66 bytes).
        private static readonly byte[] SpkiPrefix = HexBytes("3059301306072a8648ce3d020106082a8648ce3d030107034200");
        private const int PublicKeyLength = 91;   // 26 + 1 (0x04) + 32 + 32
        private const int SignatureLength = 64;   // r(32) || s(32)

        private static byte[] HexBytes(string hex)
        {
            byte[] bytes = new byte[hex.Length / 2];
            for (int index = 0; index < bytes.Length; index++)
            {
                bytes[index] = byte.Parse(hex.Substring(index * 2, 2), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
            }
            return bytes;
        }

        /// <summary>
        /// Valida e decodifica a chave publica: base64 valido, 91 bytes, prefixo
        /// P-256 exato, ponto nao comprimido e ponto NA curva. Qualquer outra
        /// coisa (outra curva, tamanho, ponto fora da curva) e recusada.
        /// </summary>
        internal static bool TryParsePublicKey(string publicKeyBase64Spki, out BigInteger x, out BigInteger y, out string error)
        {
            x = BigInteger.Zero;
            y = BigInteger.Zero;
            if (string.IsNullOrWhiteSpace(publicKeyBase64Spki))
            {
                error = "chave publica ausente";
                return false;
            }
            byte[] der;
            try
            {
                der = Convert.FromBase64String(publicKeyBase64Spki.Trim());
            }
            catch (FormatException)
            {
                error = "chave publica nao e base64 valido";
                return false;
            }
            if (der.Length != PublicKeyLength)
            {
                error = "chave publica com tamanho invalido (" + der.Length + " bytes; esperado " + PublicKeyLength + ")";
                return false;
            }
            for (int index = 0; index < SpkiPrefix.Length; index++)
            {
                if (der[index] != SpkiPrefix[index])
                {
                    error = "chave publica nao e uma chave EC P-256 em formato SubjectPublicKeyInfo";
                    return false;
                }
            }
            if (der[SpkiPrefix.Length] != 0x04)
            {
                error = "chave publica em formato de ponto nao suportado (esperado nao comprimido)";
                return false;
            }
            x = P256Curve.FromBigEndian(der, SpkiPrefix.Length + 1, 32);
            y = P256Curve.FromBigEndian(der, SpkiPrefix.Length + 33, 32);
            if (!P256Curve.IsOnCurve(x, y))
            {
                error = "ponto da chave publica nao pertence a curva P-256";
                return false;
            }
            error = null;
            return true;
        }

        internal static bool IsValidPublicKey(string publicKeyBase64Spki)
        {
            BigInteger x, y;
            string error;
            return TryParsePublicKey(publicKeyBase64Spki, out x, out y, out error);
        }

        /// <summary>Verifica a assinatura (base64, P1363) de <paramref name="message"/>. Nunca lanca.</summary>
        internal static bool TryVerify(string publicKeyBase64Spki, byte[] message, string signatureBase64, out string error)
        {
            try
            {
                return VerifyCore(publicKeyBase64Spki, message, signatureBase64, out error);
            }
            catch (Exception unexpected)
            {
                error = "falha inesperada na verificacao: " + unexpected.GetType().Name + ": " + unexpected.Message;
                return false;
            }
        }

        /// <summary>Atalho para mensagens de texto (UTF-8 sem BOM, como o Node).</summary>
        internal static bool TryVerifyText(string publicKeyBase64Spki, string message, string signatureBase64, out string error)
        {
            if (message == null)
            {
                error = "mensagem ausente";
                return false;
            }
            return TryVerify(publicKeyBase64Spki, new UTF8Encoding(false).GetBytes(message), signatureBase64, out error);
        }

        private static bool VerifyCore(string publicKeyBase64Spki, byte[] message, string signatureBase64, out string error)
        {
            if (message == null)
            {
                error = "mensagem ausente";
                return false;
            }
            BigInteger qx, qy;
            if (!TryParsePublicKey(publicKeyBase64Spki, out qx, out qy, out error)) return false;

            if (string.IsNullOrWhiteSpace(signatureBase64))
            {
                error = "assinatura ausente";
                return false;
            }
            byte[] signature;
            try
            {
                signature = Convert.FromBase64String(signatureBase64.Trim());
            }
            catch (FormatException)
            {
                error = "assinatura nao e base64 valido";
                return false;
            }
            if (signature.Length != SignatureLength)
            {
                error = "assinatura com tamanho invalido (" + signature.Length + " bytes; esperado " + SignatureLength + ")";
                return false;
            }

            BigInteger n = P256Curve.N;
            BigInteger r = P256Curve.FromBigEndian(signature, 0, 32);
            BigInteger s = P256Curve.FromBigEndian(signature, 32, 32);
            if (r.Sign <= 0 || r >= n || s.Sign <= 0 || s >= n)
            {
                error = "componentes r/s da assinatura fora do intervalo (0, n)";
                return false;
            }

            byte[] digest;
            using (SHA256 sha256 = SHA256.Create())
            {
                digest = sha256.ComputeHash(message);
            }
            BigInteger z = P256Curve.FromBigEndian(digest, 0, digest.Length);

            BigInteger w = P256Curve.Invert(s, n);          // n e primo
            BigInteger u1 = P256Curve.Mod(z * w, n);
            BigInteger u2 = P256Curve.Mod(r * w, n);

            JacobianPoint generator = JacobianPoint.FromAffine(P256Curve.Gx, P256Curve.Gy);
            JacobianPoint publicPoint = JacobianPoint.FromAffine(qx, qy);
            JacobianPoint point = MultiplyAndAdd(u1, generator, u2, publicPoint);
            if (point.IsInfinity)
            {
                error = "assinatura invalida (ponto no infinito)";
                return false;
            }
            BigInteger v = P256Curve.Mod(JacobianPoint.AffineX(point), n);
            if (v != r)
            {
                error = "assinatura invalida";
                return false;
            }
            error = null;
            return true;
        }

        // u1*A + u2*B pelo truque de Shamir (varredura simultanea dos bits).
        private static JacobianPoint MultiplyAndAdd(BigInteger u1, JacobianPoint a, BigInteger u2, JacobianPoint b)
        {
            JacobianPoint sum = JacobianPoint.Add(a, b);
            JacobianPoint result = JacobianPoint.Infinity();
            for (int bit = 255; bit >= 0; bit--)
            {
                result = JacobianPoint.Double(result);
                bool first = !((u1 >> bit) & BigInteger.One).IsZero;
                bool second = !((u2 >> bit) & BigInteger.One).IsZero;
                if (first && second) result = JacobianPoint.Add(result, sum);
                else if (first) result = JacobianPoint.Add(result, a);
                else if (second) result = JacobianPoint.Add(result, b);
            }
            return result;
        }
    }

    internal static class Hashing
    {
        /// <summary>SHA-256 em hexadecimal minusculo do texto codificado em UTF-8 (sem BOM).</summary>
        internal static string Sha256HexOfText(string text)
        {
            return Sha256Hex(new UTF8Encoding(false).GetBytes(text ?? ""));
        }

        internal static string Sha256Hex(byte[] data)
        {
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] hash = sha256.ComputeHash(data);
                StringBuilder builder = new StringBuilder(hash.Length * 2);
                foreach (byte value in hash)
                {
                    builder.Append(value.ToString("x2", CultureInfo.InvariantCulture));
                }
                return builder.ToString();
            }
        }
    }

    // Construtores das mensagens assinadas. Texto UTF-8, linhas separadas por
    // "\n", SEM "\n" final. Campos com CR/LF sao recusados (injecao de campo).
    internal static class SignedMessage
    {
        internal static string Field(string name, string value)
        {
            string text = value ?? "";
            if (text.IndexOf('\r') >= 0 || text.IndexOf('\n') >= 0)
            {
                throw new ArgumentException("Campo " + name + " nao pode conter quebra de linha.");
            }
            return name + "=" + text;
        }
    }

    internal static class UpdateMessage
    {
        internal const string Tag = "ITG-UPDATE-V1";

        internal static string Build(string version, string sha256, string url)
        {
            return string.Join("\n", new string[]
            {
                Tag,
                SignedMessage.Field("version", version),
                SignedMessage.Field("sha256", (sha256 ?? "").ToLowerInvariant()),
                SignedMessage.Field("url", url)
            });
        }
    }

    internal static class JobMessage
    {
        internal const string Tag = "ITG-JOB-V1";

        internal static string Build(
            string jobId,
            string assetId,
            string interpreter,
            long timeoutSeconds,
            string contentSha256,
            long notAfter)
        {
            return string.Join("\n", new string[]
            {
                Tag,
                SignedMessage.Field("jobId", jobId),
                SignedMessage.Field("assetId", assetId),
                SignedMessage.Field("interpreter", interpreter),
                SignedMessage.Field("timeoutSeconds", timeoutSeconds.ToString(CultureInfo.InvariantCulture)),
                SignedMessage.Field("contentSha256", (contentSha256 ?? "").ToLowerInvariant()),
                SignedMessage.Field("notAfter", notAfter.ToString(CultureInfo.InvariantCulture))
            });
        }
    }
}
