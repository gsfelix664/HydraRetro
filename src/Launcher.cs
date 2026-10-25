using System;
using System.Diagnostics;
using System.IO;
using System.Net;
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

        static void Log(string msg)
        {
            try
            {
                string p = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher.log");
                File.AppendAllText(p, "[" + DateTime.Now.ToString("HH:mm:ss.fff") + "] " + msg + "\r\n");
            }
            catch { }
        }

        static bool IsServerReady(string host, int port)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://" + host + ":" + port + "/api/state");
                req.Timeout = 1000;
                req.Method = "GET";
                using (var res = req.GetResponse())
                {
                    return true;
                }
            }
            catch (WebException wex)
            {
                if (wex.Response != null) return true;
                return false;
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            string appRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            Log("=== Starting HydraRetro Launcher ===");

            try
            {
                string serverJs = Path.Combine(appRoot, "server.js");
                if (!File.Exists(serverJs))
                {
                    string srcServerJs = Path.Combine(appRoot, "src", "server.js");
                    if (File.Exists(srcServerJs))
                        serverJs = srcServerJs;
                    else
                        serverJs = @"D:\games\HydraRetro\server.js";
                }
                Log("Resolved serverJs: " + serverJs);

                Process nodeProc = null;
                bool alreadyRunning = IsServerReady("127.0.0.1", 38475);
                Log("Already running: " + alreadyRunning);

                if (!alreadyRunning)
                {
                    string nodeExe = @"C:\Program Files\nodejs\node.exe";
                    if (!File.Exists(nodeExe)) nodeExe = "node.exe";
                    Log("Using node: " + nodeExe);

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
                    Log("Started node PID: " + (nodeProc != null ? nodeProc.Id.ToString() : "null"));

                    for (int i = 0; i < 300; i++)
                    {
                        if (IsServerReady("127.0.0.1", 38475))
                        {
                            Log("Server ready after " + ((i + 1) * 100) + "ms");
                            break;
                        }
                        Thread.Sleep(100);
                    }
                }

                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (!File.Exists(edgePath))
                {
                    edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                }
                if (!File.Exists(edgePath))
                {
                    edgePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                }
                Log("Using browser: " + edgePath);

                string profileDir = Path.Combine(appRoot, "data", "webview_profile");
                Directory.CreateDirectory(profileDir);

                // Clear stale lock file if left over from previous crashes
                try
                {
                    string lockFile = Path.Combine(profileDir, "lockfile");
                    if (File.Exists(lockFile))
                    {
                        File.Delete(lockFile);
                        Log("Deleted stale lockfile");
                    }
                }
                catch (Exception ex)
                {
                    Log("Could not delete lockfile: " + ex.Message);
                }

                ProcessStartInfo uiPsi = new ProcessStartInfo
                {
                    FileName = edgePath,
                    Arguments = "--app=http://127.0.0.1:38475 --start-fullscreen --user-data-dir=\"" + profileDir + "\" --no-first-run --no-default-browser-check --disable-features=Translate",
                    UseShellExecute = false
                };

                Process uiProc = Process.Start(uiPsi);
                Log("Started UI browser PID: " + (uiProc != null ? uiProc.Id.ToString() : "null"));

                // Wait for the UI process to initialize
                Thread.Sleep(2000);

                // Monitor backend server: HydraRetro stays running as long as the server is active
                int failCount = 0;
                while (true)
                {
                    Thread.Sleep(1500);

                    if (IsServerReady("127.0.0.1", 38475))
                    {
                        failCount = 0;
                    }
                    else
                    {
                        failCount++;
                        Log("Server check failed: count=" + failCount);
                        if (failCount >= 8) break;
                    }
                }

                Log("Exiting main loop (failCount >= 8)");

                if (nodeProc != null && !nodeProc.HasExited)
                {
                    try
                    {
                        Log("Killing node process PID " + nodeProc.Id);
                        nodeProc.Kill();
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                Log("Fatal exception: " + ex.ToString());
            }

            Log("=== HydraRetro Launcher Exited ===");
        }
    }
}
