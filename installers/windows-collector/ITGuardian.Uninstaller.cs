using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyProduct("IT Guardian Uninstaller")]
[assembly: System.Reflection.AssemblyTitle("Desinstalar IT Guardian")]
[assembly: System.Reflection.AssemblyCompany("IT Guardian")]
[assembly: System.Reflection.AssemblyVersion("1.5.0.0")]

internal static class ITGuardianUninstaller
{
    [STAThread]
    private static int Main()
    {
        string uninstaller = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "unins000.exe"
        );

        if (!File.Exists(uninstaller))
        {
            MessageBox.Show(
                "O desinstalador principal do IT Guardian nao foi encontrado.",
                "IT Guardian",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = uninstaller,
                UseShellExecute = true,
                Verb = "runas"
            });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Nao foi possivel iniciar a desinstalacao.\r\n\r\n" + error.Message,
                "IT Guardian",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }
}
