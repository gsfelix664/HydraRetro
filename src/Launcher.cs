using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace HydraRetro
{
    static class Program
    {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
        [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);

        static bool IsHydraRetroWindowOpen()
        {
            bool open = false;
            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                if (sb.ToString().Contains("HydraRetro"))
                {
                    open = true;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return open;
        }

        [STAThread]
        static void Main(string[] args)
        {
            string appRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string serverJs = Path.Combine(appRoot, "server.js");
            if (!File.Exists(serverJs))
            {
                string srcServerJs = Path.Combine(appRoot, "src", "server.js");
                if (File.Exists(srcServerJs))
                    serverJs = srcServerJs;
                else
                    serverJs = @"C:\games\HydraRetro\server.js";
            }

            Process nodeProc = null;
            bool alreadyRunning = IsPortOpen("127.0.0.1", 38475);

            if (!alreadyRunning)
            {
                string nodeExe = @"C:\Program Files\nodejs\node.exe";
                if (!File.Exists(nodeExe)) nodeExe = "node.exe";

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + serverJs + "\"",
                    WorkingDirectory = Path.GetDirectoryName(serverJs),
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                nodeProc = Process.Start(psi);

                for (int i = 0; i < 80; i++)
                {
                    if (IsPortOpen("127.0.0.1", 38475)) break;
                    Thread.Sleep(100);
                }
            }

            string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edgePath))
            {
                edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            }

            string profileDir = Path.Combine(appRoot, "data", "webview_profile");
            Directory.CreateDirectory(profileDir);

            ProcessStartInfo uiPsi = new ProcessStartInfo
            {
                FileName = edgePath,
                Arguments = "--app=http://127.0.0.1:38475 --start-fullscreen --user-data-dir=\"" + profileDir + "\" --no-first-run --no-default-browser-check --disable-features=Translate",
                UseShellExecute = false
            };

            Process.Start(uiPsi);

            // Wait up to 10 seconds for the HydraRetro window to appear
            for (int i = 0; i < 50; i++)
            {
                if (IsHydraRetroWindowOpen()) break;
                Thread.Sleep(200);
            }

            // Monitor while HydraRetro UI window is open (even when minimized during gameplay)
            while (IsHydraRetroWindowOpen() && IsPortOpen("127.0.0.1", 38475))
            {
                Thread.Sleep(1000);
            }

            if (nodeProc != null && !nodeProc.HasExited)
            {
                try { nodeProc.Kill(); } catch { }
            }
        }

        static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(150));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
