/**
 * Prueba de envío Wapisimo.
 * Uso: npx tsx scripts/test-wapisimo.ts
 * Requiere .env con WAPISIMO_API_KEY, WAPISIMO_PHONE_ID, ORDER_NOTIFY_WHATSAPP
 */
import "dotenv/config";
import { sendWhatsApp, wapisimoConfigStatus, isConfigured } from "../src/lib/whatsapp/wapisimo";
import { orderNotifyDigits } from "../src/lib/whatsapp/notify-order";

async function main() {
  console.log("Config:", wapisimoConfigStatus());
  console.log("isConfigured:", isConfigured());
  const to = orderNotifyDigits();
  console.log("Destino:", to);
  if (!isConfigured()) {
    console.error("\n❌ Falta WAPISIMO_API_KEY o WAPISIMO_PHONE_ID en .env");
    console.error("   En .env debe verse algo como:");
    console.error('   WAPISIMO_API_KEY="tu_clave_real"');
    console.error('   WAPISIMO_PHONE_ID="0cea982a-4cd8-4fc6-bf1b-b5d7d9bddf90"');
    process.exit(1);
  }
  await sendWhatsApp(
    to,
    "🧪 Prueba Sitios Web Express\n\nSi lees esto, Wapisimo está bien configurado."
  );
  console.log("✅ Envío OK (revisa WhatsApp en", to + ")");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
