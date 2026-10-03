package com.upay.sathi;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Sathi launcher.
 *
 * The app is a thin Capacitor shell that loads the deployed Next.js app
 * (web/capacitor.config.json → server.url). A bare BridgeActivity gives no
 * feedback when that load fails on a device (blocked network, DNS, SSL,
 * slow carrier link, WebView renderer crash…) — the user just stares at the
 * white launch screen. This activity hardens the shell:
 *
 *  - main-frame load errors  → branded offline page with the REAL reason
 *                              (e.g. net::ERR_NAME_NOT_RESOLVED) + auto retry
 *  - main-frame HTTP >= 400  → same page (deployment hiccup / rate limit)
 *  - slow load               → 25 s timeout, then the retry page
 *  - renderer crash          → activity is recreated instead of leaving a
 *                              dead blank WebView
 */
public class MainActivity extends BridgeActivity {

    /** Must match web/capacitor.config.json → server.url. */
    private static final String APP_URL = "https://sathi-pied.vercel.app/";

    /** Show the retry page if the remote app has not finished loading in this window. */
    private static final long LOAD_TIMEOUT_MS = 25000L;

    private WebView appWebView;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable loadTimeout = new Runnable() {
        @Override
        public void run() {
            showOfflinePage("timeout — the server could not be reached in 25 s");
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appWebView = bridge.getWebView();
        if (appWebView != null) {
            appWebView.setWebViewClient(new SathiWebViewClient());
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(loadTimeout);
        super.onDestroy();
    }

    private void showOfflinePage(String reason) {
        handler.removeCallbacks(loadTimeout);
        final WebView view = appWebView;
        if (view == null) {
            return;
        }
        final String safeReason = sanitize(reason == null ? "" : reason);
        view.post(new Runnable() {
            @Override
            public void run() {
                try {
                    String html = readRawResource(R.raw.offline);
                    html = html.replace("__REASON__", safeReason);
                    // Base URL = the app origin so the retry navigation stays
                    // inside this WebView (Capacitor keeps same-host loads internal).
                    view.loadDataWithBaseURL(APP_URL, html, "text/html", "utf-8", null);
                } catch (Exception ignored) {
                    // Last resort: plain inline message instead of a blank screen.
                    view.loadDataWithBaseURL(
                        APP_URL,
                        "<html><body style=\"font-family:sans-serif;background:#F6F4EE;"
                            + "text-align:center;padding-top:40%\">"
                            + "Could not reach Sathi. Check your internet connection "
                            + "and open the app again.</body></html>",
                        "text/html", "utf-8", null);
                }
            }
        });
    }

    private static String sanitize(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String readRawResource(int resId) throws Exception {
        StringBuilder sb = new StringBuilder();
        BufferedReader reader = null;
        try {
            reader = new BufferedReader(
                new InputStreamReader(getResources().openRawResource(resId), StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (Exception ignored) {
                }
            }
        }
        return sb.toString();
    }

    /** Capacitor's client + Sathi resilience rules. */
    private class SathiWebViewClient extends BridgeWebViewClient {

        SathiWebViewClient() {
            super(bridge);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            handler.removeCallbacks(loadTimeout);
            if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                handler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            handler.removeCallbacks(loadTimeout);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                String reason = (error == null || error.getDescription() == null)
                    ? "network error"
                    : String.valueOf(error.getDescription());
                showOfflinePage(reason);
                return;
            }
            super.onReceivedError(view, request, error);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                        WebResourceResponse errorResponse) {
            if (request != null && request.isForMainFrame()
                && errorResponse != null && errorResponse.getStatusCode() >= 400) {
                showOfflinePage("HTTP " + errorResponse.getStatusCode());
                return;
            }
            super.onReceivedHttpError(view, request, errorResponse);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // A crashed renderer leaves a dead blank WebView; relaunch instead.
            recreate();
            return true;
        }
    }
}
