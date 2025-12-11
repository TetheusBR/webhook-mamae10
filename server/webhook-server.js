/**
 * SERVIDOR DE WEBHOOKS - MAMÃE10
 */

import express from 'express';
import cors from 'cors';           // ← CORREÇÃO AQUI
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- FUNÇÕES DE NEGÓCIO ---

async function updateUserSubscription(email, data) {
  console.log(`[DB] Atualizando usuário ${email}:`, data);
}

async function createNewUser(email) {
  console.log(`[DB] Criando novo usuário ${email}`);
}

// --- WEBHOOKS KIWIFY ---

app.post('/webhooks/kiwify', async (req, res) => {
  try {
    const { event, data } = req.body;
    const email = data?.Customer?.email || data?.email;
    const subscriptionId = data?.Subscription?.id;

    if (!email) {
      return res.status(400).json({ error: "Email não encontrado no payload" });
    }

    console.log(`[KIWIFY] Evento: ${event} | Email: ${email}`);

    const now = new Date();
    const next = new Date();
    next.setUTCDate(now.getUTCDate() + 30);

    switch (event) {
      case "order_approved":
        await createNewUser(email);
        await updateUserSubscription(email, {
          subscriptionStatus: "active",
          subscriptionId,
          subscriptionProvider: "kiwify",
          subscriptionStartDate: now.toISOString(),
          subscriptionEndDate: next.toISOString(),
          subscriptionRenewsAt: next.toISOString()
        });
        break;

      case "subscription_created":
        await updateUserSubscription(email, {
          subscriptionStatus: "active",
          subscriptionId,
          subscriptionRenewsAt: next.toISOString()
        });
        break;

      case "subscription_renewed":
        await updateUserSubscription(email, {
          subscriptionStatus: "active",
          subscriptionEndDate: next.toISOString(),
          subscriptionRenewsAt: next.toISOString()
        });
        break;

      case "subscription_payment_failed":
        await updateUserSubscription(email, {
          subscriptionStatus: "past_due"
        });
        break;

      case "subscription_canceled":
        await updateUserSubscription(email, {
          subscriptionStatus: "canceled"
        });
        break;

      case "subscription_expired":
        await updateUserSubscription(email, {
          subscriptionStatus: "expired"
        });
        break;

      case "order_refunded":
        await updateUserSubscription(email, {
          subscriptionStatus: "refunded",
          subscriptionEndDate: now.toISOString()
        });
        break;

      default:
        console.log(`Evento Kiwify não mapeado: ${event}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error("Erro no webhook Kiwify:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// --- WEBHOOK CACTO ---

app.post("/webhooks/cacto", async (req, res) => {
  try {
    const { event_type, payload } = req.body;
    const email = payload?.customer?.email;

    if (!email) return res.status(400).send("Email missing");

    console.log(`[CACTO] Evento: ${event_type}`);

    if (event_type === "subscription.expired") {
      await updateUserSubscription(email, {
        subscriptionStatus: "expired"
      });
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("Erro no webhook Cacto:", error);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Webhooks rodando na porta ${PORT}`);
});
