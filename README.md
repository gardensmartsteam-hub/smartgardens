# Smart Garden Assistant

SMART GARDEN 4.0

const env = require("../config/env");
const { ApiError } = require("../middlewares/error.middleware");

// Proxy do "jardineiro virtual": mantém a ANTHROPIC_API_KEY só no servidor.
// O frontend nunca vê a chave — só manda o histórico de mensagens + contexto da planta selecionada.
async function ask({ messages, plantContext }) {
  if (!env.anthropicApiKey) {
    throw new ApiError(503, "Chat indisponível: configure ANTHROPIC_API_KEY no .env do backend.");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ApiError(400, "Envie ao menos uma mensagem.");
  }

  const context = plantContext
    ? `Planta selecionada agora pelo usuário: ${plantContext.name} (${plantContext.species}). ` +
      `Umidade do solo: ${plantContext.humidity}%. Luminosidade: ${plantContext.light}. ` +
      `Temperatura: ${plantContext.temperature}°C. Nutrientes no solo: ${plantContext.nutrients}%.`
    : "Nenhuma planta específica está selecionada no momento.";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `Você é o jardineiro virtual do app Smart Garden. Converse em português do Brasil, de forma calorosa, prática e breve — como um jardineiro experiente e atencioso falando com o dono das plantas. Dê dicas de cuidado, rega, luz, adubação e pragas quando perguntado. ${context}`,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(502, `Falha ao consultar o assistente (status ${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const reply = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return reply || "Desculpe, não consegui pensar em uma resposta agora. Pode tentar de novo?";
}

module.exports = { ask };

const asyncHandler = require("../utils/asyncHandler");
const chatService = require("../services/chat.service");

// POST /api/chat  { messages: [{role, content}], plantContext?: {...} }
exports.ask = asyncHandler(async (req, res) => {
  const { messages, plantContext } = req.body;
  const reply = await chatService.ask({ messages, plantContext });
  res.json({ role: "assistant", content: reply });
});

const { Router } = require("express");
const ctrl = require("../controllers/chat.controller");
const auth = require("../middlewares/auth.middleware");

const router = Router();
router.use(auth);
router.post("/", ctrl.ask);

module.exports = router;

const { Router } = require("express");

const router = Router();

router.use("/auth", require("./auth.routes"));
router.use("/plants", require("./plant.routes"));
router.use("/device", require("./device.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/alerts", require("./alert.routes"));
router.use("/chat", require("./chat.routes"));
router.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

router.use("/", require("./notification.routes")); // expõe /pdf /email /whatsapp na raiz, como pedido no spec

module.exports = router;

require("dotenv").config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "Smart Garden <no-reply@smartgarden.app>",
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL,
    phoneId: process.env.WHATSAPP_PHONE_ID,
    token: process.env.WHATSAPP_TOKEN,
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};

require("dotenv").config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "Smart Garden <no-reply@smartgarden.app>",
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL,
    phoneId: process.env.WHATSAPP_PHONE_ID,
    token: process.env.WHATSAPP_TOKEN,
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};

bash

cd /home/claude/smart-garden/sg-backend && for f in src/services/sensor.service.js src/repositories/sensor.repository.js src/services/reading.service.js src/controllers/plant.controller.js src/routes/plant.routes.js src/services/chat.service.js src/controllers/chat.controller.js src/routes/chat.routes.js src/routes/index.js src/config/env.js; do echo "-- $f --"; node --check "$f" && echo OK; done
Saída

-- src/services/sensor.service.js --
OK
-- src/repositories/sensor.repository.js --
OK
-- src/services/reading.service.js --
OK
-- src/controllers/plant.controller.js --
OK
-- src/routes/plant.routes.js --
OK
-- src/services/chat.service.js --
OK
-- src/controllers/chat.controller.js --
OK
-- src/routes/chat.routes.js --
OK
-- src/routes/index.js --
OK
-- src/config/env.js --
OK

bash

cd /home/claude/smart-garden/sg-backend && ls node_modules 2>&1 | head -5; echo "---"; npm install --package-lock-only=false --prefer-offline --no-audit --no-fund 2>&1 | tail -10
Saída

ls: cannot access 'node_modules': No such file or directory
---
npm error code E403
npm error 403 403 Forbidden - GET https://registry.npmjs.org/zod/-/zod-3.25.76.tgz
npm error 403 In most cases, you or one of your dependencies are requesting
npm error 403 a package version that is forbidden by your security policy, or
npm error 403 on a server you do not have access to.
npm error A complete log of this run can be found in: /home/claude/.npm/_logs/2026-08-11T18_02_43_549Z-debug-0.log

bash

cd /home/claude/smart-garden && grep -n "DEVICES" SMART_GARDEN_1_0.html
Saída

670:const DEVICES = [{
1677:  const [selected, setSelected] = useState(DEVICES[0].id);
1682:  const device = DEVICES.find(d => d.id === selected) ?? DEVICES[0];
1757:    devices: DEVICES,

bash

cd /home/claude/smart-garden && awk '/^const DEVICES = \[/{print NR": "$0; f=1} f{print NR": "$0} f && /^\];/{exit}' SMART_GARDEN_1_0.html | tail -20
Saída

2246:       }
2247:     });
2248:   }
2249:   return /*#__PURE__*/React.createElement("div", {
2250:     className: "min-h-screen w-full bg-neutral-950 text-neutral-100 flex font-sans"
2251:   }, accountType === "consumer" ? /*#__PURE__*/React.createElement(ConsumerApp, {
2252:     subscription: subscription,
2253:     setSubscription: setSubscription,
2254:     initialView: initialView
2255:   }) : /*#__PURE__*/React.createElement(BusinessApp, null), /*#__PURE__*/React.createElement("button", {
2256:     onClick: () => setAccountType(accountType === "consumer" ? "business" : "consumer"),
2257:     className: "fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-neutral-900 text-xs font-semibold shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:scale-105 hover:shadow-[0_0_28px_rgba(255,255,255,0.4)] transition-all"
2258:   }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
2259:     className: "w-3.5 h-3.5"
2260:   }), accountType === "consumer" ? "Ver como Horto/Floricultura" : "Ver como Pessoa física"));
2261: }
2262: ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(FloraLinkPrototype, null));
2263: </script>
2264: </body>
2265: </html>

bash

cd /home/claude/smart-garden && python3 -c "
import re
with open('SMART_GARDEN_1_0.html') as f:
    lines = f.readlines()
start = 670-1  # 0-indexed
depth = 0
started = False
for i in range(start, len(lines)):
    line = lines[i]
    for ch in line:
        if ch == '[':
            depth += 1
            started = True
        elif ch == ']':
            depth -= 1
    if started and depth == 0:
        print('end line (1-indexed):', i+1)
        break
"
Saída

end line (1-indexed): 730

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smartgardens.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d72cb00d-7ba0-45ef-9dd9-c340cf61e174).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
