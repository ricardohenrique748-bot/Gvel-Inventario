package com.gvel.entradaesaida;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean keepSplashOnScreen = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> keepSplashOnScreen);
        new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplashOnScreen = false, 600);
        super.onCreate(savedInstanceState);
    }
}
