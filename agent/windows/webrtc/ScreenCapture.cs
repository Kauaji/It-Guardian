using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ITGuardian.RemoteAssistanceWebRtc
{
    /// <summary>
    /// Captura de tela via GDI+, igual em espirito ao CaptureSelectedMonitor
    /// do coletor principal, mas devolvendo bytes BGR crus e compactados (sem
    /// o padding de stride que o GDI+ adiciona por linha) em vez de JPEG --
    /// e o formato que VideoEncoderEndPoint.ExternalVideoSourceRawSample
    /// espera para codificar em VP8.
    /// </summary>
    internal static class ScreenCapture
    {
        public static Screen FindScreen(string monitorId)
        {
            if (!string.IsNullOrWhiteSpace(monitorId) && monitorId.StartsWith("screen-") &&
                int.TryParse(monitorId.Substring(7), out int index) &&
                index >= 0 && index < Screen.AllScreens.Length)
            {
                return Screen.AllScreens[index];
            }
            return Screen.PrimaryScreen;
        }

        public static (byte[] bgr, int width, int height) CaptureBgr(Screen screen, int maxWidth)
        {
            Rectangle bounds = screen.Bounds;
            int targetWidth = Math.Min(maxWidth, bounds.Width);
            // VP8 exige dimensoes pares.
            targetWidth -= targetWidth % 2;
            int targetHeight = (int)Math.Round(bounds.Height * (targetWidth / (double)bounds.Width));
            targetHeight -= targetHeight % 2;
            if (targetWidth <= 0 || targetHeight <= 0) return (null, 0, 0);

            using Bitmap source = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb);
            using (Graphics sourceGraphics = Graphics.FromImage(source))
            {
                sourceGraphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
            }

            using Bitmap target = new Bitmap(targetWidth, targetHeight, PixelFormat.Format24bppRgb);
            using (Graphics targetGraphics = Graphics.FromImage(target))
            {
                targetGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
                targetGraphics.DrawImage(source, new Rectangle(0, 0, targetWidth, targetHeight));
            }

            BitmapData data = target.LockBits(
                new Rectangle(0, 0, targetWidth, targetHeight),
                ImageLockMode.ReadOnly,
                PixelFormat.Format24bppRgb);
            try
            {
                int rowBytes = targetWidth * 3;
                byte[] packed = new byte[rowBytes * targetHeight];
                for (int y = 0; y < targetHeight; y++)
                {
                    IntPtr rowPointer = IntPtr.Add(data.Scan0, y * data.Stride);
                    Marshal.Copy(rowPointer, packed, y * rowBytes, rowBytes);
                }
                return (packed, targetWidth, targetHeight);
            }
            finally
            {
                target.UnlockBits(data);
            }
        }
    }
}
