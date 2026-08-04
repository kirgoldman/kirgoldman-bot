/**
 * Telegram funnel bot for kirgoldman.com — Cloudflare Worker
 *
 * Flow:
 *  /start -> msg1 (hook) -> [4min/19min reminders if no click]
 *         -> +1h: msg3 (site/company, sent to everyone) -> [3h/+24h reminders if no click]
 *         -> next day 11:00 MSK: msg4 (neuro case, sent to everyone)
 *
 * Clicks are tracked by routing Telegram button URLs through this worker's
 * /go/* endpoints (Telegram does not notify bots about URL-button clicks),
 * which log the click, cancel pending reminders, then 302-redirect to the
 * real destination with UTM params.
 */

const SITE = "https://kirgoldman.com";
const MSK_OFFSET = 3 * 3600; // Moscow is fixed UTC+3

const IMG = {
  hook: `${SITE}/bot/card1.png`,        // msg1
  hookR1: `${SITE}/bot/reminder1-metod.png`, // msg1 reminder 1 (real site screenshot)
  hookR2: `${SITE}/bot/reminder2-keis.png`,  // msg1 reminder 2 (real site screenshot)
  site: `${SITE}/bot/card2.png`,        // msg3 + its reminders
  neuro: `${SITE}/bot/card3.png`,       // msg4
};

const LINKS = {
  case: `${SITE}/case-dophamine-what/?utm_source=telegram&utm_medium=bot&utm_campaign=sliv_keisa&utm_content=poluchit_materialy`,
  site: `${SITE}/?utm_source=telegram&utm_medium=bot&utm_campaign=sliv_keisa&utm_content=posmotret_sait`,
  dm: `https://t.me/kirgoldman`,
  caseNeuro: `${SITE}/?utm_source=telegram&utm_medium=bot&utm_campaign=sliv_keisa&utm_content=case_neuro`,
};

// NOTE: these strings use Telegram HTML formatting (parse_mode: "HTML").
// Allowed tags: <b>, <i>, <u>, <s>, <blockquote>, <a href="">, <code>. Escape & < > if you add raw text.

const MSG1_TEXT = `🔥 <b>СЛИВ КЕЙСА</b>: Как я нашёл лазейку в рекламе для онлайн-школ, которая даёт регистрации по $2,8 с ROMI до 253%

Привет! Я Кир Голдман, таргетолог-маркетолог по трафику для онлайн-школ.

Представьте: вы вкладываете $35 900 и получаете назад $126 727. Звучит нереально?
Именно такой результат мы получили в нише заработка на нейросетях, используя то, что я назвал «<b>Методом Дофаминовой Раскачки</b>» 🧠

Вот что она позволила сделать:
⚡ Снизить стоимость регистрации <b>В 3 РАЗА</b>
⚡ Спокойно наращивать бюджет — без обвала окупаемости на масштабе
⚡ Получить <b>ROMI 253%</b>

Я подготовил полный разбор кейса — как работает эта стратегия, включая:
— Почему большинство таргетологов не знают про этот метод
— Как я случайно нашёл эту лазейку после консультаций с нейробиологами
— Реальные цифры и креативы «было / стало»

<blockquote>❗️ ВАЖНО: это не теория — за методом стоят реальные проекты в нишах нейросетей, нейрофото и крипты, с окупаемостью от 87% до ~400%.</blockquote>

👉 Чтобы получить полный разбор, жми кнопку ниже`;

const MSG1_R1_TEXT = `Кир 👋 Ты ещё не глянул разбор кейса с <b>ROMI 253%</b>? 👀 Там реальные цифры и креативы «было/стало» — 2 минуты чтения, дальше сам решишь, применимо ли к тебе. 👇`;
const MSG1_R2_TEXT = `Последний раз напомню 🙂 Кейс с регистрациями по $2,8 и <b>ROMI до 253%</b> — если интересно разобраться в механике, материал ещё доступен 👇`;

const MSG3_TEXT = `<b>У меня серьёзная контора. Даже сайт есть)</b>

<blockquote>Забавный парадокс: если рекламировать собственные услуги и вести трафик на такой лендинг, то цена заявки будет конская.</blockquote>

Однако, ничто же не мешает дать вам его посмотреть в боте.

Поэтому заботливо приготовил сайт для вас
👇👇👇`;

const MSG3_R1_TEXT = `Кир 👋 Ты уже видел <b>сайт с кейсами</b>? Там честные цифры по разным нишам — стоит глянуть 👇`;
const MSG3_R2_TEXT = `Ещё раз про сайт — если интересно посмотреть, как я веду проекты и какие результаты выдаю клиентам, загляни 👇`;

const MSG4_TEXT = `📊 <b>Кейс: онлайн-школа по нейросетям</b>

<blockquote>Бюджет: $35 900
Выручка: $126 727
ROMI: 253%</blockquote>

Что сделали:
— Сменили посыл в креативах на «Метод Дофаминовой Раскачки» — CTR вырос с 0.4% до 1.5%
— Стоимость регистрации упала в 3 раза
— Бюджет наращивали без просадки окупаемости на масштабе

Это не разовая удача — та же механика дала <b>87% ROMI</b> в нише нейрофото и <b>~400%</b> в крипто-нише.

Ещё кейсы и разборы — на сайте 👇`;

function kb(buttons) {
  // buttons: array of {text, url}
  return { inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))] };
}

async function tg(env, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.log("tg error", method, await res.text());
  }
  return res;
}

function goUrl(env, path, chatId) {
  return `${env.BASE_URL}/go/${path}?u=${chatId}`;
}

async function sendMsg1(env, chatId) {
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: IMG.hook,
    caption: "🔥 Слив кейса: ROMI 253% в нише нейросетей",
  });
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: MSG1_TEXT,
    parse_mode: "HTML",
    reply_markup: kb([{ text: "🎁 Получить материалы 🔥", url: goUrl(env, "case", chatId) }]),
  });
}

async function sendMsg1Reminder(env, chatId, text, image) {
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: image,
    caption: text,
    parse_mode: "HTML",
    reply_markup: kb([{ text: "🎁 Получить материалы 🔥", url: goUrl(env, "case", chatId) }]),
  });
}

async function sendMsg3(env, chatId) {
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: IMG.site,
    caption: MSG3_TEXT,
    parse_mode: "HTML",
    reply_markup: kb([
      { text: "Посмотреть сайт и кейсы", url: goUrl(env, "site", chatId) },
      { text: "Написать в ЛС", url: goUrl(env, "dm", chatId) },
    ]),
  });
}

async function sendMsg3Reminder(env, chatId, text) {
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: IMG.site,
    caption: text,
    parse_mode: "HTML",
    reply_markup: kb([
      { text: "Посмотреть сайт и кейсы", url: goUrl(env, "site", chatId) },
      { text: "Написать в ЛС", url: goUrl(env, "dm", chatId) },
    ]),
  });
}

async function sendMsg4(env, chatId) {
  await tg(env, "sendPhoto", {
    chat_id: chatId,
    photo: IMG.neuro,
    caption: MSG4_TEXT,
    parse_mode: "HTML",
    reply_markup: kb([{ text: "Смотреть кейсы на сайте", url: goUrl(env, "case2", chatId) }]),
  });
}

function nextDay11Msk(nowSec) {
  const nowMskMs = (nowSec + MSK_OFFSET) * 1000;
  const d = new Date(nowMskMs);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const wallClockUtcMs = Date.UTC(y, m, day + 1, 11, 0, 0);
  return Math.floor(wallClockUtcMs / 1000) - MSK_OFFSET;
}

async function handleStart(env, chatId) {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO users (id, started_at) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, clicked_msg1 = 0, clicked_msg3 = 0`
  ).bind(chatId, now).run();

  // clear any stale events from a previous /start
  await env.DB.prepare(`DELETE FROM events WHERE user_id = ?`).bind(chatId).run();

  const events = [
    ["msg1_r1", now + 4 * 60],
    ["msg1_r2", now + 19 * 60],
    ["msg3", now + 3600],
    ["msg3_r1", now + 4 * 3600],
    ["msg3_r2", now + 28 * 3600],
    ["msg4", nextDay11Msk(now)],
  ];

  const stmt = env.DB.prepare(`INSERT INTO events (user_id, type, due_at) VALUES (?, ?, ?)`);
  await env.DB.batch(events.map(([type, due]) => stmt.bind(chatId, type, due)));

  await sendMsg1(env, chatId);
}

async function handleGo(env, kind, chatId, redirectUrl) {
  if (chatId) {
    if (kind === "case") {
      await env.DB.prepare(`UPDATE users SET clicked_msg1 = 1 WHERE id = ?`).bind(chatId).run();
      await env.DB.prepare(
        `UPDATE events SET cancelled = 1 WHERE user_id = ? AND type IN ('msg1_r1','msg1_r2') AND sent = 0`
      ).bind(chatId).run();
    } else if (kind === "site" || kind === "dm") {
      await env.DB.prepare(`UPDATE users SET clicked_msg3 = 1 WHERE id = ?`).bind(chatId).run();
      await env.DB.prepare(
        `UPDATE events SET cancelled = 1 WHERE user_id = ? AND type IN ('msg3_r1','msg3_r2') AND sent = 0`
      ).bind(chatId).run();
    }
    // 'case2' (msg4 button) — nothing further scheduled, just a plain log-through
  }
  return Response.redirect(redirectUrl, 302);
}

async function runDueEvents(env) {
  const now = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    `SELECT * FROM events WHERE due_at <= ? AND sent = 0 AND cancelled = 0 ORDER BY due_at ASC LIMIT 200`
  ).bind(now).all();

  for (const ev of results) {
    try {
      switch (ev.type) {
        case "msg1_r1":
          await sendMsg1Reminder(env, ev.user_id, MSG1_R1_TEXT, IMG.hookR1);
          break;
        case "msg1_r2":
          await sendMsg1Reminder(env, ev.user_id, MSG1_R2_TEXT, IMG.hookR2);
          break;
        case "msg3":
          await sendMsg3(env, ev.user_id);
          break;
        case "msg3_r1":
          await sendMsg3Reminder(env, ev.user_id, MSG3_R1_TEXT);
          break;
        case "msg3_r2":
          await sendMsg3Reminder(env, ev.user_id, MSG3_R2_TEXT);
          break;
        case "msg4":
          await sendMsg4(env, ev.user_id);
          break;
      }
      await env.DB.prepare(`UPDATE events SET sent = 1 WHERE id = ?`).bind(ev.id).run();
    } catch (err) {
      console.log("event send failed", ev.id, ev.type, err);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      const update = await request.json();
      const msg = update.message;
      if (msg && msg.text && msg.text.startsWith("/start")) {
        ctx.waitUntil(handleStart(env, msg.chat.id));
      }
      return new Response("ok");
    }

    if (url.pathname.startsWith("/go/")) {
      const kind = url.pathname.split("/")[2]; // case | site | dm | case2
      const chatId = url.searchParams.get("u");
      const dest = { case: LINKS.case, site: LINKS.site, dm: LINKS.dm, case2: LINKS.caseNeuro }[kind];
      if (!dest) return new Response("not found", { status: 404 });
      return handleGo(env, kind, chatId, dest);
    }

    if (url.pathname === "/cron-test") {
      // manual trigger for testing without waiting for the real cron
      await runDueEvents(env);
      return new Response("ran");
    }

    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDueEvents(env));
  },
};
