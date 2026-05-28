// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function : submit-lead
// 1. Insère le lead dans la table public.leads
// 2. Envoie une notification à l'admin (faureytb@gmail.com)
//    — aucun email envoyé au lead, pour rester discret
// ═══════════════════════════════════════════════════════════════════
//
// Déploiement (voir DEPLOY.md) :
//   supabase secrets set EMAIL_FROM=faurebleza06@gmail.com
//   supabase secrets set EMAIL_PASS="sfvm shpl mkfw ejnd"
//   supabase secrets set ADMIN_EMAIL=faureytb@gmail.com
//   supabase functions deploy submit-lead
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM")!;
const EMAIL_PASS = Deno.env.get("EMAIL_PASS")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "faureytb@gmail.com";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
});

// ─── Helpers ─────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]!));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Templates email ─────────────────────────────────────────────────
function leadEmailHtml(firstName: string) {
  const fn = escapeHtml(firstName);
  return `<!DOCTYPE html><html><body style="margin:0;padding:30px 16px;background:#f5f3ef;">
  <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(10,22,40,0.08);">
    <div style="background:#0A1628;padding:42px 30px;text-align:center;">
      <h1 style="margin:0;font-size:26px;color:#FFFFFF;font-weight:500;letter-spacing:-0.01em;font-family:Georgia,serif;">
        Faure <span style="color:#C9A84C;font-style:italic;">BLEZA</span>
      </h1>
      <p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.16em;text-transform:uppercase;font-family:Arial,sans-serif;font-weight:500;">
        Automatisation IA pour avocats
      </p>
    </div>
    <div style="padding:48px 40px;">
      <h2 style="margin:0 0 22px;font-size:28px;color:#0A1628;font-weight:500;letter-spacing:-0.02em;font-family:Georgia,serif;">
        Merci ${fn},
      </h2>
      <p style="font-size:16px;line-height:1.65;color:#374151;margin:0 0 18px;font-family:Arial,sans-serif;">
        Votre demande a bien été enregistrée. Je vous contacte personnellement
        <strong style="color:#A88638;">sous 24 heures</strong> pour comprendre votre cabinet
        et établir un plan précis — sans engagement.
      </p>
      <p style="font-size:16px;line-height:1.65;color:#374151;margin:0 0 26px;font-family:Arial,sans-serif;">
        En attendant, vous pouvez préparer :
      </p>
      <ul style="font-size:15px;line-height:1.85;color:#374151;padding-left:22px;margin:0 0 36px;font-family:Arial,sans-serif;">
        <li>Les <strong>3 tâches</strong> qui vous prennent le plus de temps chaque semaine</li>
        <li>Votre <strong>tarif horaire</strong> moyen</li>
        <li>Le <strong>nombre de dossiers</strong> actifs</li>
      </ul>
      <div style="text-align:center;margin:36px 0 8px;">
        <a href="mailto:faureytb@gmail.com" style="display:inline-block;padding:14px 30px;background:#0A1628;color:#C9A84C;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;font-family:Arial,sans-serif;letter-spacing:0.02em;">
          Me joindre directement →
        </a>
      </div>
      <div style="border-top:1px solid #E5E7EB;padding-top:28px;margin-top:36px;font-family:Arial,sans-serif;">
        <p style="font-size:14px;color:#6B7280;margin:0;line-height:1.6;">
          À très bientôt,<br>
          <strong style="color:#0A1628;font-size:16px;font-family:Georgia,serif;">Faure Automatise</strong>
        </p>
      </div>
    </div>
    <div style="background:#050C18;padding:20px;text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);font-family:Arial,sans-serif;letter-spacing:0.05em;">
        © Faure Automatise — Automatisation IA pour professionnels du droit
      </p>
    </div>
  </div>
</body></html>`;
}

function adminEmailHtml(data: {
  first_name: string;
  email: string;
  phone: string | null;
  firm: string | null;
  plan_interest: string | null;
}) {
  const fn = escapeHtml(data.first_name);
  const em = escapeHtml(data.email);
  const ph = data.phone ? escapeHtml(data.phone) : "—";
  const fm = data.firm ? escapeHtml(data.firm) : "—";
  const pi = data.plan_interest ? escapeHtml(data.plan_interest) : null;
  const phLink = data.phone ? data.phone.replace(/\s/g, "") : "";
  const planColor = pi && pi.toLowerCase().includes("complet") ? "#A88638" : "#0A1628";
  const planBg = pi && pi.toLowerCase().includes("complet")
    ? "linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.08))"
    : "rgba(10,22,40,0.06)";
  const date = new Date().toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  return `<!DOCTYPE html><html><body style="margin:0;padding:30px 16px;background:#f5f3ef;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(10,22,40,0.08);">
    <div style="background:linear-gradient(135deg,#A88638 0%,#C9A84C 50%,#E0C67A 100%);padding:28px;text-align:center;">
      <h2 style="margin:0;font-size:20px;color:#0A1628;font-weight:700;letter-spacing:-0.01em;">
        🔔 Nouveau prospect
      </h2>
    </div>
    <div style="padding:36px 32px;">
      <h3 style="margin:0 0 28px;font-size:22px;color:#0A1628;font-family:Georgia,serif;font-weight:500;letter-spacing:-0.01em;">
        ${fn}${data.firm ? ' <span style="color:#6B7280;font-weight:400;">— ' + fm + '</span>' : ''}
      </h3>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;width:130px;letter-spacing:0.04em;">Prénom</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;font-weight:600;color:#0A1628;">${fn}</td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;letter-spacing:0.04em;">Email</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;font-weight:600;">
            <a href="mailto:${em}" style="color:#A88638;text-decoration:none;">${em}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;letter-spacing:0.04em;">Téléphone</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;font-weight:600;color:#0A1628;">
            ${data.phone ? `<a href="tel:${phLink}" style="color:#0A1628;text-decoration:none;">${ph}</a>` : ph}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;letter-spacing:0.04em;">Cabinet</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;font-weight:600;color:#0A1628;">${fm}</td>
        </tr>
        ${pi ? `<tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;letter-spacing:0.04em;">Formule pressentie</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;">
            <span style="display:inline-block;padding:5px 12px;border-radius:8px;background:${planBg};color:${planColor};font-weight:600;font-size:13px;letter-spacing:0.01em;">${pi}</span>
          </td>
        </tr>` : `<tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;letter-spacing:0.04em;">Formule pressentie</td>
          <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;color:#9CA3AF;font-style:italic;">non précisée (CTA hero)</td>
        </tr>`}
        <tr>
          <td style="padding:14px 0;color:#6B7280;letter-spacing:0.04em;">Reçu le</td>
          <td style="padding:14px 0;font-weight:600;color:#0A1628;">${date}</td>
        </tr>
      </table>
      <div style="margin-top:36px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;text-align:center;">
        <a href="mailto:${em}?subject=R%C3%A9ponse%20%C3%A0%20votre%20demande%20%E2%80%94%20Faure%20BLEZA" style="display:inline-block;padding:14px 28px;background:#0A1628;color:#C9A84C;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.01em;margin:4px;">
          Répondre par email →
        </a>
        ${data.phone ? `<a href="tel:${phLink}" style="display:inline-block;padding:14px 28px;background:#C9A84C;color:#0A1628;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.01em;margin:4px;">Appeler ${fn} →</a>` : ''}
      </div>
    </div>
  </div>
</body></html>`;
}

// ─── Handler principal ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const first_name = String(body.first_name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim() || null;
    const firm = String(body.firm || "").trim() || null;
    const plan_interest = String(body.plan_interest || "").trim() || null;
    const user_agent = String(body.user_agent || "").slice(0, 500);

    if (first_name.length < 2) return json({ error: "Prénom invalide" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email invalide" }, 400);

    // 1. INSERT en base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("leads")
      .insert([{ first_name, email, phone, firm, plan_interest, user_agent }])
      .select("id")
      .single();

    if (error) {
      console.error("Erreur insert :", error);
      return json({ error: "Database insert failed" }, 500);
    }

    // 2. Envoi des 2 emails en parallèle — n'échoue pas la requête si un email rate
    let adminOk = false;
    try {
      await transporter.sendMail({
        from: `"Site Faure Automatise" <${EMAIL_FROM}>`,
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `🔔 Nouveau prospect : ${first_name}${firm ? " — " + firm : ""}${plan_interest ? " · " + plan_interest : ""}`,
        html: adminEmailHtml({ first_name, email, phone, firm, plan_interest }),
      });
      adminOk = true;
    } catch (err) {
      console.error("Email admin failed:", err);
    }

    return json({
      ok: true,
      id: data.id,
      emails: { admin: adminOk },
    });
  } catch (e) {
    console.error("Erreur fonction :", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
