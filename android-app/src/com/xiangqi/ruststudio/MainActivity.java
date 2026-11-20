package com.xiangqi.ruststudio;

import android.app.Activity;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    static {
        System.loadLibrary("xiangqi_android");
    }

    public static native int startRustServer(int port);

    private WebView webView;
    private static final int PORT = 8124;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startRustServer(PORT);

        webView = new WebView(this);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        ws.setBuiltInZoomControls(true);
        ws.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(final String urlStr, String userAgent, final String contentDisposition, final String mimetype, long contentLength) {
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            String fname = URLUtil.guessFileName(urlStr, contentDisposition, mimetype);
                            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                            if (dir == null) dir = getFilesDir();
                            if (!dir.exists()) dir.mkdirs();
                            final File outFile = new File(dir, fname);

                            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
                            conn.setConnectTimeout(4000);
                            conn.setReadTimeout(8000);
                            try (InputStream in = conn.getInputStream();
                                 FileOutputStream out = new FileOutputStream(outFile)) {
                                byte[] buf = new byte[8192];
                                int n;
                                while ((n = in.read(buf)) > 0) {
                                    out.write(buf, 0, n);
                                }
                            }
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "已保存: " + outFile.getAbsolutePath(), Toast.LENGTH_LONG).show();
                                }
                            });
                        } catch (final Exception e) {
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "导出失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                                }
                            });
                        }
                    }
                }).start();
            }
        });

        setContentView(webView);
        waitForRustAndLoad();
    }

    private void waitForRustAndLoad() {
        final Handler mainHandler = new Handler(Looper.getMainLooper());
        new Thread(new Runnable() {
            @Override
            public void run() {
                for (int i = 0; i < 80; i++) {
                    try {
                        HttpURLConnection conn = (HttpURLConnection) new URL("http://127.0.0.1:" + PORT + "/api/health").openConnection();
                        conn.setConnectTimeout(150);
                        conn.setReadTimeout(150);
                        if (conn.getResponseCode() == 200) {
                            conn.disconnect();
                            break;
                        }
                        conn.disconnect();
                    } catch (Exception ignored) {
                    }
                    try { Thread.sleep(35); } catch (InterruptedException ignored) {}
                }
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null) {
                            webView.loadUrl("http://127.0.0.1:" + PORT + "/studio.html");
                        }
                    }
                });
            }
        }).start();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
