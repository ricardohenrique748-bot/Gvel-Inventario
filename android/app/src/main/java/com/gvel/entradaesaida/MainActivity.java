package com.gvel.entradaesaida;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Com a fonte do sistema aumentada (padrão em vários Xiaomi/POCO), o WebView
        // ampliava todo o texto do app e a tela passava da largura do celular,
        // cortando dos lados. O layout já se ajusta à tela; o texto fica em 100%.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
