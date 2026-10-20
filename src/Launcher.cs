using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

namespace HydraRetro
{
    static class Program
    {
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
                    serverJs = @"D:\games\HydraRetro\server.js";
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

                // Wait up to 8 seconds for server to listen
                for (int i = 0; i < 80; i++)
                {
                    if (IsPortOpen("127.0.0.1", 38475)) break;
                    Thread.Sleep(100);
                }
            }

            // Launch borderless fullscreen app window using Edge App Mode
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

            // Keep Launcher alive while backend server is running (so Hydra tracks playtime accurately
            // and we never prematurely kill the Node server when msedge delegates its process)
            if (nodeProc != null)
            {
                nodeProc.WaitForExit();
            }
            else
            {
                while (IsPortOpen("127.0.0.1", 38475))
                {
                    Thread.Sleep(2000);
                }
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
